import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { ConcreteAgentRuntime, InstallSkillOptions, PluginScope } from '../types';
import { ConfigService } from './ConfigService';
import { HttpClient } from '../utils/HttpClient';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { AgentRuntimeDetector } from './AgentRuntimeDetector';
import { RuntimePathResolver, sanitizeMarketName } from './RuntimePathResolver';
import { SecurityAuditor } from './SecurityAuditor';
import { CodexConfigHelper } from '../adapters/CodexConfigHelper';

function githubTokenForUrl(url: string, token?: string): string | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ['api.github.com', 'raw.githubusercontent.com', 'github.com', 'codeload.github.com'].includes(host)
      ? token
      : undefined;
  } catch {
    return undefined;
  }
}

export class DownloadService {
  private static readonly MAX_ARCHIVE_ENTRIES = 5000;
  private static readonly MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;

  constructor(private configService: ConfigService) {}

  private validateArchive(entries: AdmZip.IZipEntry[]): void {
    if (entries.length > DownloadService.MAX_ARCHIVE_ENTRIES) {
      throw new Error(`Archive contains too many entries (${entries.length})`);
    }
    let totalBytes = 0;
    for (const entry of entries) {
      const normalized = entry.entryName.replace(/\\/g, '/');
      if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized) || normalized.split('/').includes('..')) {
        throw new Error(`Unsafe archive path: ${entry.entryName}`);
      }
      totalBytes += entry.header.size || 0;
      if (totalBytes > DownloadService.MAX_ARCHIVE_BYTES) {
        throw new Error('Archive expands beyond the allowed size');
      }
    }
  }

  private auditInstallationDirectory(targetDir: string): void {
    const scripts: { name: string; content?: string }[] = [];
    const scriptsRoot = path.join(targetDir, 'scripts');
    if (fs.existsSync(scriptsRoot)) {
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(fullPath);
          else if (entry.isFile() && fs.statSync(fullPath).size <= 1024 * 1024) {
            scripts.push({ name: entry.name, content: fs.readFileSync(fullPath, 'utf-8') });
          }
        }
      };
      walk(scriptsRoot);
    }
    const skillPath = path.join(targetDir, 'SKILL.md');
    const skillText = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, 'utf-8') : '';
    const warnings = SecurityAuditor.scan(skillText, scripts);
    if (warnings.length > 0) {
      throw new Error(`Security audit blocked installation: ${warnings.join('; ')}`);
    }
  }

  public async installSkill(
    targetDir: string,
    options: InstallSkillOptions
  ): Promise<{ installedFiles: string[] }> {
    if (fs.existsSync(targetDir) && !options.overwrite) {
      throw new Error(`Target plugin directory already exists: ${targetDir}`);
    }

    const parentDir = path.dirname(targetDir);
    fs.mkdirSync(parentDir, { recursive: true });
    const tempDir = fs.mkdtempSync(path.join(parentDir, `.${path.basename(targetDir)}.pluginhub-`));
    const backupDir = `${targetDir}.pluginhub-backup-${Date.now()}`;
    let movedExisting = false;

    try {
      const result = await this.installSkillIntoDirectory(tempDir, options);
      if (fs.existsSync(targetDir)) {
        fs.renameSync(targetDir, backupDir);
        movedExisting = true;
      }
      fs.renameSync(tempDir, targetDir);
      if (movedExisting && fs.existsSync(backupDir)) {
        try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch {}
      }
      return result;
    } catch (error) {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      if (movedExisting && !fs.existsSync(targetDir) && fs.existsSync(backupDir)) {
        fs.renameSync(backupDir, targetDir);
      }
      throw error;
    }
  }

  /**
   * Install a plugin from a remote git repository or direct URL into plugins/<name>/
   */
  private async installSkillIntoDirectory(
    targetDir: string,
    options: InstallSkillOptions
  ): Promise<{ installedFiles: string[] }> {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const installedFiles: string[] = [];
    let gitUrl = typeof options.source === 'string' ? options.source : options.source?.url || '';
    let subdir = typeof options.source === 'object' ? options.source.path || '' : '';
    let ref = typeof options.source === 'object' ? options.source.ref || 'main' : 'main';

    let repoFullName = '';
    const repoMatch = gitUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (repoMatch) {
      repoFullName = `${repoMatch[1]}/${repoMatch[2]}`;
    } else if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(gitUrl.trim())) {
      repoFullName = gitUrl.trim();
    } else if (gitUrl.startsWith('./') || (!gitUrl.startsWith('http') && gitUrl)) {
      repoFullName = 'anthropics/claude-plugins-official';
      subdir = gitUrl.replace(/^\.\//, '');
    }

    if (repoFullName) {
      const subPath = options.skillName ? path.posix.join(subdir, options.skillName) : subdir;
      await this.downloadFromGitHubRepo(repoFullName, subPath, ref, targetDir, installedFiles);
    } else if (gitUrl.startsWith('http://') || gitUrl.startsWith('https://')) {
      await this.downloadDirectUrl(gitUrl, targetDir, installedFiles);
    } else {
      // Fallback: download from official repo using plugin name
      await this.downloadFromGitHubRepo(
        'anthropics/claude-plugins-official',
        `plugins/${options.pluginName}`,
        ref,
        targetDir,
        installedFiles
      );
    }

    // 规范化子技能目录布局：若无 skills/ 子目录但有根 SKILL.md，自动组织进 skills/<name>/SKILL.md
    const rootSkillMd = path.join(targetDir, 'SKILL.md');
    const skillsDir = path.join(targetDir, 'skills');
    const pluginName = options.pluginName || path.basename(targetDir);

    if (fs.existsSync(rootSkillMd) && !fs.existsSync(skillsDir)) {
      const subSkillDir = path.join(skillsDir, pluginName);
      fs.mkdirSync(subSkillDir, { recursive: true });
      const targetSubSkillMd = path.join(subSkillDir, 'SKILL.md');
      fs.copyFileSync(rootSkillMd, targetSubSkillMd);
    }

    this.auditInstallationDirectory(targetDir);

    const version = options.version || (options.gitSha ? `git:${options.gitSha.slice(0, 7)}` : '1.0.0');

    // 提取最准确、最生动的插件描述
    let description = options.description?.trim();
    if (!description) {
      const claudePluginJson = path.join(targetDir, '.claude-plugin', 'plugin.json');
      const packageJson = path.join(targetDir, 'package.json');
      if (fs.existsSync(claudePluginJson)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(claudePluginJson, 'utf-8'));
          if (parsed.description) description = parsed.description.trim();
        } catch {}
      }
      if (!description && fs.existsSync(packageJson)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
          if (parsed.description) description = parsed.description.trim();
        } catch {}
      }
      if (!description && fs.existsSync(rootSkillMd)) {
        try {
          const content = fs.readFileSync(rootSkillMd, 'utf-8');
          const match = content.match(/^description:\s*([^\r\n]+)/m);
          if (match) description = match[1].trim();
        } catch {}
      }
      if (!description) {
        description = `${pluginName} plugin`;
      }
    }

    const effectiveRuntime: ConcreteAgentRuntime = AgentRuntimeDetector.resolveEffectiveRuntime(
      options.targetAgentRuntime,
      options.targetWorkspaceFolder
    );
    const adapter = AdapterFactory.getAdapter(effectiveRuntime);

    // 1. 生成符合目标 AI Agent 官方标准的纯净 plugin.json
    adapter.ensurePluginManifest(targetDir, pluginName, description, {
      skills: options.skills
    });
    installedFiles.push('plugin.json');

    // 2. 写入独立的 .pluginhub.json 包管理元数据文件
    adapter.writePluginhubMetadata(targetDir, {
      name: pluginName,
      description,
      version,
      gitSha: options.gitSha,
      gitTag: options.gitTag,
      runtime: effectiveRuntime,
      source: options.source,
      sourceName: options.sourceName || (effectiveRuntime === 'antigravity' ? 'Antigravity Official Marketplace' : effectiveRuntime === 'codex' ? 'Codex Marketplace' : 'OpenCode Marketplace'),
      skills: options.skills,
      installedAt: Date.now(),
      installedScope: options.scope,
      enabled: true
    });
    installedFiles.push('.pluginhub.json');

    // 3. 若为 OpenAI Codex，自动注册至 config.toml 使得 Codex 核心免 CLI 原生加载
    if (effectiveRuntime === 'codex') {
      try {
        const rawMarket = options.sourceName || 'default';
        const marketplaceName = sanitizeMarketName(rawMarket);
        const safePluginName = RuntimePathResolver.validatePluginName(pluginName);
        const pluginKey = `${safePluginName}@${marketplaceName}`;
        const baseConfigDir = adapter.resolvePaths(options.scope, options.targetWorkspaceFolder).baseConfigDir;
        CodexConfigHelper.setPluginEnabled(baseConfigDir, pluginKey, true);
      } catch (err) {
        console.warn('Failed to register Codex plugin in config.toml:', err);
      }
    }

    this.ensureExecutablePermissions(targetDir);

    return { installedFiles };
  }

  /**
   * 从 GitHub 下载仓库或子目录
   * 策略：
   * 1. 优先尝试 GitHub Zipball 完整压缩包流式拉取（100% 完整保留所有文件与子目录）
   * 2. 备选尝试 GitHub Git Trees API 递归节点拉取
   * 3. 终极备选：多 CDN Raw 镜像并发拉取常用清单
   */
  private async downloadFromGitHubRepo(
    repoFullName: string,
    subdir: string,
    ref: string,
    targetDir: string,
    installedFiles: string[]
  ): Promise<void> {
    const cleanSubdir = subdir.replace(/^\/+|\/+$/g, '');
    const errorDetails: string[] = [];

    // 方案 1：GitHub Zipball 完整无损拉取（最高优先级，支持整个仓库或指定子目录）
    try {
      const success = await this.downloadViaZipball(repoFullName, cleanSubdir, ref, targetDir, installedFiles);
      if (success && installedFiles.length > 0) {
        return;
      }
    } catch (err: any) {
      errorDetails.push(`Zipball 快照下载失败: ${err?.message || err}`);
      console.warn(`Zipball download failed for ${repoFullName}, trying Git Trees API...`, err);
    }

    // 方案 2：Git Trees API
    try {
      const treeUrl = `https://api.github.com/repos/${repoFullName}/git/trees/${ref}?recursive=1`;
      const settings = this.configService.getSettings(true);
      const text = await HttpClient.get(treeUrl, {
        token: settings.githubToken,
        headers: {
          'User-Agent': 'PluginHub-Extension',
          Accept: 'application/vnd.github.v3+json'
        },
        timeoutMs: 10000
      });

      const data = JSON.parse(text) as { tree?: { path: string; type: string; url: string }[] };
      if (data.tree && Array.isArray(data.tree)) {
        const filesInSubdir = data.tree.filter((node) => {
          if (node.type !== 'blob') return false;
          if (!cleanSubdir) return true;
          return node.path === cleanSubdir || node.path.startsWith(`${cleanSubdir}/`);
        });

        if (filesInSubdir.length > 0) {
          const downloadPromises = filesInSubdir.map(async (fileNode) => {
            const relPath = cleanSubdir ? fileNode.path.slice(cleanSubdir.length).replace(/^\/+/, '') : fileNode.path;
            if (!relPath) return;

            const localDest = path.join(targetDir, relPath);
            fs.mkdirSync(path.dirname(localDest), { recursive: true });

            const content = await this.fetchFastRawFile(repoFullName, ref, fileNode.path);
            fs.writeFileSync(localDest, content);
            installedFiles.push(relPath);
          });

          await Promise.all(downloadPromises);
          return;
        }
      }
    } catch (err: any) {
      errorDetails.push(`Git Trees API 遍历失败: ${err?.message || err}`);
      console.warn('GitHub Tree API failed or rate-limited, switching to direct mirror download...', err);
    }

    // 方案 3：常用清单探测拉取
    const standardFiles = [
      'SKILL.md',
      'README.md',
      'mcp_config.json',
      '.mcp.json',
      'plugin.json',
      '.claude-plugin/plugin.json',
      'scripts/run.sh',
      'scripts/run.py',
      'scripts/setup.sh'
    ];

    let downloadedCount = 0;
    const fallbackPromises = standardFiles.map(async (file) => {
      const remoteFilePath = cleanSubdir ? `${cleanSubdir}/${file}` : file;
      try {
        const content = await this.fetchFastRawFile(repoFullName, ref, remoteFilePath);
        if (content.length > 0) {
          const localDest = path.join(targetDir, file);
          fs.mkdirSync(path.dirname(localDest), { recursive: true });
          fs.writeFileSync(localDest, content);
          installedFiles.push(file);
          downloadedCount++;
        }
      } catch {}
    });

    await Promise.all(fallbackPromises);

    if (downloadedCount === 0) {
      const detailStr = errorDetails.length > 0 ? ` (详情: ${errorDetails.join('; ')})` : '';
      throw new Error(`无法从远程仓库 (${repoFullName}${cleanSubdir ? '/' + cleanSubdir : ''}) 下载插件文件。请检查网络连通性或在设置中配置 GitHub Token / 开启镜像加速。${detailStr}`);
    }
  }

  /**
   * 通过 Zipball 流式下载并精准解压目标目录
   */
  private async downloadViaZipball(
    repoFullName: string,
    cleanSubdir: string,
    ref: string,
    targetDir: string,
    installedFiles: string[]
  ): Promise<boolean> {
    const settings = this.configService.getSettings(true);
    const urls: string[] = [];

    // 官方与高速镜像候选通道
    urls.push(`https://codeload.github.com/${repoFullName}/zip/refs/heads/${ref}`);
    urls.push(`https://codeload.github.com/${repoFullName}/zip/${ref}`);
    urls.push(`https://github.com/${repoFullName}/archive/refs/heads/${ref}.zip`);
    urls.push(`https://github.com/${repoFullName}/archive/${ref}.zip`);

    if (settings.mirrorAcceleration) {
      urls.push(`https://download.gitmirror.com/https://github.com/${repoFullName}/archive/refs/heads/${ref}.zip`);
      urls.push(`https://hub.gitmirror.com/https://github.com/${repoFullName}/archive/refs/heads/${ref}.zip`);
      urls.push(`https://ghproxy.net/https://github.com/${repoFullName}/archive/refs/heads/${ref}.zip`);
    }

    let zipBuffer: Buffer | null = null;
    for (const url of urls) {
      try {
        zipBuffer = await HttpClient.getBuffer(url, {
          token: githubTokenForUrl(url, settings.githubToken),
          timeoutMs: 12000
        });
        if (zipBuffer && zipBuffer.length > 500) {
          break;
        }
      } catch {}
    }

    if (!zipBuffer || zipBuffer.length < 500) {
      return false;
    }

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    if (entries.length === 0) return false;
    this.validateArchive(entries);

    // 识别顶层根前缀（如 'superpowers-main/'）
    const firstSlash = entries[0].entryName.indexOf('/');
    const rootPrefix = firstSlash > 0 ? entries[0].entryName.slice(0, firstSlash + 1) : '';

    const targetPrefix = cleanSubdir ? `${rootPrefix}${cleanSubdir}/` : rootPrefix;

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      let relPath = '';
      if (cleanSubdir) {
        if (!entry.entryName.startsWith(targetPrefix)) continue;
        relPath = entry.entryName.slice(targetPrefix.length);
      } else {
        if (!entry.entryName.startsWith(rootPrefix)) continue;
        relPath = entry.entryName.slice(rootPrefix.length);
      }

      if (!relPath) continue;

      const destPath = path.join(targetDir, relPath);
      RuntimePathResolver.assertPathWithin(destPath, targetDir);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, entry.getData());
      installedFiles.push(relPath);
    }

    return installedFiles.length > 0;
  }

  /**
   * Fast concurrent raw file download
   */
  private async fetchFastRawFile(repoFullName: string, ref: string, filePath: string): Promise<Buffer> {
    const settings = this.configService.getSettings(true);
    const officialUrl = `https://raw.githubusercontent.com/${repoFullName}/${ref}/${filePath}`;
    const urls = settings.mirrorAcceleration
      ? [
          `https://fastly.jsdelivr.net/gh/${repoFullName}@${ref}/${filePath}`,
          `https://raw.gitmirror.com/${repoFullName}/${ref}/${filePath}`,
          officialUrl
        ]
      : [officialUrl];

    const fetchPromises = urls.map(async (url) => {
      const content = await HttpClient.getBuffer(url, {
        token: githubTokenForUrl(url, settings.githubToken),
        timeoutMs: 4000
      });
      if (content.length > 0) {
        return content;
      }
      throw new Error('Empty content');
    });

    return await Promise.any(fetchPromises);
  }

  private async downloadDirectUrl(url: string, targetDir: string, installedFiles: string[]): Promise<void> {
    const text = await HttpClient.get(url, { timeoutMs: 8000 });
    const destPath = path.join(targetDir, 'SKILL.md');
    fs.writeFileSync(destPath, text, 'utf-8');
    installedFiles.push('SKILL.md');
  }

  /**
   * Export a local plugin directory to a .zip package cleanly
   */
  public exportSkillToZip(pluginDir: string, outputZipPath: string): void {
    if (!fs.existsSync(pluginDir)) {
      throw new Error(`Plugin directory does not exist: ${pluginDir}`);
    }
    const zip = new AdmZip();

    const entries = fs.readdirSync(pluginDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(pluginDir, entry.name);
      if (entry.isDirectory()) {
        zip.addLocalFolder(fullPath, entry.name);
      } else {
        if (entry.name === 'plugin.json.disabled') {
          const content = fs.readFileSync(fullPath);
          zip.addFile('plugin.json', content);
        } else {
          zip.addLocalFile(fullPath);
        }
      }
    }

    zip.writeZip(outputZipPath);
  }

  /**
   * Import a .zip package into a plugin directory
   */
  public importSkillFromZip(zipFilePath: string, targetDir: string): { skillName: string } {
    if (!fs.existsSync(zipFilePath)) {
      throw new Error(`Zip package does not exist: ${zipFilePath}`);
    }

    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();
    this.validateArchive(zipEntries);

    let rootSubDir = '';
    const firstLevelDirs = new Set<string>();
    for (const entry of zipEntries) {
      const parts = entry.entryName.split(/[\/\\]/);
      if (parts.length > 1 && parts[0]) {
        firstLevelDirs.add(parts[0]);
      }
    }

    if (firstLevelDirs.size === 1) {
      rootSubDir = Array.from(firstLevelDirs)[0];
    }

    const files = zipEntries.filter((entry) => !entry.isDirectory);
    const hasSingleRoot = !!rootSubDir && files.every((entry) => {
      const normalized = entry.entryName.replace(/\\/g, '/');
      return normalized.startsWith(`${rootSubDir}/`);
    });

    const parentDir = path.dirname(targetDir);
    fs.mkdirSync(parentDir, { recursive: true });
    const tempDir = fs.mkdtempSync(path.join(parentDir, `.${path.basename(targetDir)}.import-`));
    try {
      for (const entry of files) {
        const normalized = entry.entryName.replace(/\\/g, '/');
        const relative = hasSingleRoot ? normalized.slice(rootSubDir.length + 1) : normalized;
        if (!relative) continue;
        const destination = path.join(tempDir, relative);
        RuntimePathResolver.assertPathWithin(destination, tempDir);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, entry.getData());
      }
      this.auditInstallationDirectory(tempDir);
      const backupDir = `${targetDir}.pluginhub-backup-${Date.now()}`;
      if (fs.existsSync(targetDir)) fs.renameSync(targetDir, backupDir);
      try {
        fs.renameSync(tempDir, targetDir);
        if (fs.existsSync(backupDir)) {
          try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch {}
        }
      } catch (error) {
        if (!fs.existsSync(targetDir) && fs.existsSync(backupDir)) fs.renameSync(backupDir, targetDir);
        throw error;
      }
    } catch (error) {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      throw error;
    }

    const skillName = path.basename(targetDir);
    return { skillName };
  }

  /**
   * 确保 Unix / macOS 系统下的脚本具备可执行权限 (0o755)
   */

  /**
   * 确保 Unix / macOS 系统下的脚本具备可执行权限 (0o755)
   */
  private ensureExecutablePermissions(targetDir: string): void {
    if (process.platform === 'win32') return;
    try {
      const walk = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (
            entry.isFile() &&
            (entry.name.endsWith('.sh') ||
              entry.name.endsWith('.py') ||
              entry.name.endsWith('.js') ||
              fullPath.replace(/\\/g, '/').includes('/scripts/'))
          ) {
            try {
              fs.chmodSync(fullPath, 0o755);
            } catch {}
          }
        }
      };
      walk(targetDir);
    } catch {}
  }
}
