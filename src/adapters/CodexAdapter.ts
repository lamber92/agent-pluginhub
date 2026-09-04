import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { IAgentRuntimeAdapter, ResolvedRuntimePaths } from './IAgentRuntimeAdapter';
import { ConcreteAgentRuntime, LocalSkillItem, PluginhubMetadata, PluginScope } from '../types';
import { CodexConfigHelper } from './CodexConfigHelper';
import { sanitizeMarketName } from '../utils/PathSafety';
import { SkillScanner } from '../utils/SkillScanner';

/**
 * 计算文本/Buffer 的 Git Blob SHA-1 哈希指纹
 */
function computeGitBlobSha(content: string | Buffer): string {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  const header = `blob ${buf.length}\0`;
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(header), buf])).digest('hex');
}

/**
 * OpenAI Codex 专有生态适配器 (遵循 OpenAI Codex 官方规范)
 * 支持原生免 CLI 加载：直接操作 ~/.codex/config.toml 与 plugins/cache 目录
 */
export class CodexAdapter implements IAgentRuntimeAdapter {
  public readonly runtime: ConcreteAgentRuntime = 'codex';
  public readonly supportedScopes: PluginScope[] = ['workspace', 'agent', 'global'];

  /**
   * 解析 OpenAI Codex 物理路径 (~/.codex, <WorkspaceRoot>/.codex, ~/.agents)
   */
  public resolvePaths(scope: PluginScope, workspaceRoot?: string): ResolvedRuntimePaths {
    let baseConfigDir: string;
    let pluginsDir: string;
    let activeRootDir: string;

    if (scope === 'agent') {
      baseConfigDir = path.join(os.homedir(), '.codex');
      pluginsDir = path.join(baseConfigDir, 'plugins', 'cache');
      activeRootDir = pluginsDir;
    } else if (scope === 'workspace') {
      const wsRoot = workspaceRoot || process.cwd();
      baseConfigDir = path.join(wsRoot, '.codex');
      pluginsDir = path.join(baseConfigDir, 'plugins', 'cache');
      activeRootDir = pluginsDir;
    } else {
      // global scope: 系统通用 ~/.agents/plugins
      baseConfigDir = path.join(os.homedir(), '.agents');
      pluginsDir = path.join(baseConfigDir, 'plugins');
      activeRootDir = pluginsDir;
    }

    const skillsDir = path.join(baseConfigDir, 'skills');
    const mcpConfigFile = path.join(baseConfigDir, 'mcp.json');
    const pluginsConfigFile = path.join(baseConfigDir, 'config.toml');

    return {
      runtime: this.runtime,
      baseConfigDir,
      pluginsDir,
      skillsDir,
      mcpConfigFile,
      pluginsConfigFile,
      activeRootDir
    };
  }

  /**
   * 确保或生成 100% 符合 OpenAI Codex 通用标准的纯净 plugin.json
   */
  public ensurePluginManifest(
    pluginDir: string,
    pluginName: string,
    description?: string,
    extra?: any
  ): void {
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
    }

    const pluginJsonPath = path.join(pluginDir, 'plugin.json');
    let currentData: any = {};

    if (fs.existsSync(pluginJsonPath)) {
      try {
        currentData = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
      } catch {}
    }

    const cleanData: Record<string, any> = {
      name: pluginName || currentData.name || path.basename(pluginDir),
      description: description || currentData.description || `${pluginName} plugin for OpenAI Codex`,
      version: extra?.version || currentData.version || '1.0.0'
    };

    if (extra?.author || currentData.author) cleanData.author = extra?.author || currentData.author;
    if (extra?.homepage || currentData.homepage) cleanData.homepage = extra?.homepage || currentData.homepage;
    if (extra?.repository || currentData.repository) cleanData.repository = extra?.repository || currentData.repository;
    if (extra?.skills || currentData.skills) cleanData.skills = extra?.skills || currentData.skills;
    if (extra?.mcpServers || currentData.mcpServers) cleanData.mcpServers = extra?.mcpServers || currentData.mcpServers;

    fs.writeFileSync(pluginJsonPath, JSON.stringify(cleanData, null, 2), 'utf-8');
  }

  /**
   * 写入独立的 PluginHub 包管理器版本与来源跟踪元数据文件 (.pluginhub.json)
   */
  public writePluginhubMetadata(pluginDir: string, meta: PluginhubMetadata): void {
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
    }
    const metaPath = path.join(pluginDir, '.pluginhub.json');
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }

  /**
   * 读取 .pluginhub.json 元数据
   */
  public readPluginhubMetadata(dirPath: string): PluginhubMetadata | null {
    const metaPath = path.join(dirPath, '.pluginhub.json');
    if (fs.existsSync(metaPath)) {
      try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * 探测插件目录下存在的 Manifest 路径 (支持 plugin.json, .codex-plugin/plugin.json, .claude-plugin/plugin.json 及其 .disabled 形式)
   */
  public findManifestPaths(dirPath: string): { activePath: string | null; disabledPath: string | null; manifestRelPath: string } {
    const candidateRelPaths = [
      'plugin.json',
      path.join('.codex-plugin', 'plugin.json'),
      path.join('.claude-plugin', 'plugin.json')
    ];

    for (const rel of candidateRelPaths) {
      const active = path.join(dirPath, rel);
      const disabled = path.join(dirPath, `${rel}.disabled`);
      const activeExists = fs.existsSync(active);
      const disabledExists = fs.existsSync(disabled);

      if (activeExists || disabledExists) {
        return {
          activePath: activeExists ? active : null,
          disabledPath: disabledExists ? disabled : null,
          manifestRelPath: rel
        };
      }
    }

    return {
      activePath: null,
      disabledPath: null,
      manifestRelPath: 'plugin.json'
    };
  }

  /**
   * 读取 plugin.json (含 plugin.json.disabled 备份，支持 .codex-plugin/ 等路径)
   */
  public readPluginJson(dirPath: string): any | null {
    const { activePath, disabledPath } = this.findManifestPaths(dirPath);
    const target = activePath || disabledPath;

    if (target) {
      try {
        return JSON.parse(fs.readFileSync(target, 'utf-8'));
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * 从目录路径结构与元数据中提取精准的 pluginName 和 marketplaceName
   */
  public extractMarketplaceAndPluginName(
    pluginPath: string,
    meta?: PluginhubMetadata | null,
    pluginJson?: any | null,
    fallbackMarketplace: string = 'default'
  ): { pluginName: string; marketplaceName: string } {
    let pluginName = pluginJson?.name || meta?.name;
    const normalized = path.resolve(pluginPath);
    const dirName = path.basename(normalized);
    const parentDirName = path.basename(path.dirname(normalized));

    if (!pluginName) {
      if (/^\d+(\.\d+)*(-.+)?$/.test(dirName) || dirName === 'local' || dirName.startsWith('git')) {
        pluginName = parentDirName;
      } else {
        pluginName = dirName;
      }
    }

    let marketplaceName = meta?.sourceName;
    if (!marketplaceName || marketplaceName === 'default') {
      const cacheIdx = normalized.indexOf(path.join('plugins', 'cache'));
      if (cacheIdx !== -1) {
        const afterCache = normalized.slice(cacheIdx + path.join('plugins', 'cache').length).replace(/^[/\\]+/, '');
        const segments = afterCache.split(/[/\\]+/);
        if (segments.length > 0 && segments[0]) {
          marketplaceName = segments[0];
        }
      }
    }

    if (!marketplaceName) {
      marketplaceName = fallbackMarketplace || 'default';
    }

    marketplaceName = sanitizeMarketName(marketplaceName);

    return { pluginName, marketplaceName };
  }

  /**
   * 判断是否为 OpenAI Codex 原生内置/系统捆绑插件 (受保护禁止删除)
   */
  public isNativePlugin(
    marketplaceName: string,
    pluginPath: string,
    lockfile?: PluginhubMetadata | null
  ): boolean {
    if (lockfile?.source === 'builtin' || (lockfile as any)?.isNative === true) {
      return true;
    }
    const nativeMarkets = ['openai-bundled', 'openai-primary-runtime', 'openai-bundled-alpha'];
    if (nativeMarkets.includes(marketplaceName)) {
      return true;
    }
    const normalized = path.resolve(pluginPath).toLowerCase();
    if (
      normalized.includes('openai-bundled') ||
      normalized.includes('openai-primary-runtime') ||
      normalized.includes('bundled-marketplaces')
    ) {
      return true;
    }
    return false;
  }

  /**
   * 双轨扫描 1：扫描托管插件目录 (plugins/cache 或 plugins/)
   */
  public scanPluginsDirectory(
    pluginsDir: string,
    scope: PluginScope,
    workspaceName?: string,
    workspacePath?: string
  ): LocalSkillItem[] {
    const items: LocalSkillItem[] = [];
    if (!fs.existsSync(pluginsDir)) return items;

    const baseConfigDir = this.findBaseConfigDir(pluginsDir, scope, workspacePath);

    // 1. 检查是否为 Codex 原生 plugins/cache 结构：cache/<market>/<plugin>/<version>
    const isCacheDir = pluginsDir.endsWith('cache') || fs.existsSync(path.join(pluginsDir, 'cache'));
    const scanRoot = isCacheDir && !pluginsDir.endsWith('cache') ? path.join(pluginsDir, 'cache') : pluginsDir;

    if (fs.existsSync(scanRoot)) {
      const topEntries = fs.readdirSync(scanRoot, { withFileTypes: true });
      for (const marketEntry of topEntries) {
        if (!marketEntry.isDirectory() || marketEntry.name.startsWith('.')) continue;

        const marketPath = path.join(scanRoot, marketEntry.name);
        const { activePath: topActive, disabledPath: topDisabled } = this.findManifestPaths(marketPath);

        // 如果直接包含 plugin.json，说明是扁平 plugins/<plugin> 结构
        if (topActive || topDisabled || fs.existsSync(path.join(marketPath, '.pluginhub.json'))) {
          const item = this.parsePluginDirectory(marketPath, scope, 'default', baseConfigDir, workspaceName, workspacePath);
          if (item && !items.some((i) => i.path === item.path)) {
            items.push(item);
          }
          continue;
        }

        // 否则视为 market 目录，扫描其下的 plugin 目录
        const pluginEntries = fs.readdirSync(marketPath, { withFileTypes: true });
        for (const pluginEntry of pluginEntries) {
          if (!pluginEntry.isDirectory() || pluginEntry.name.startsWith('.')) continue;

          const pluginBasePath = path.join(marketPath, pluginEntry.name);

          // 寻找具体版本目录 (例如 1.0.0, local)
          const versionDir = this.findActiveVersionDir(pluginBasePath);
          if (versionDir) {
            const item = this.parsePluginDirectory(versionDir, scope, marketEntry.name, baseConfigDir, workspaceName, workspacePath);
            if (item && !items.some((i) => i.path === item.path)) {
              items.push(item);
            }
          }
        }
      }
    }

    // 2. 兼容扫描同级的 plugins 目录 (如果 scanRoot 是 cache)
    const flatPluginsDir = isCacheDir && pluginsDir.endsWith('cache') ? path.dirname(pluginsDir) : null;
    if (flatPluginsDir && fs.existsSync(flatPluginsDir)) {
      const flatEntries = fs.readdirSync(flatPluginsDir, { withFileTypes: true });
      for (const entry of flatEntries) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'cache') continue;
        const pPath = path.join(flatPluginsDir, entry.name);
        const item = this.parsePluginDirectory(pPath, scope, 'default', baseConfigDir, workspaceName, workspacePath);
        if (item && !items.some((i) => i.name === item.name)) {
          items.push(item);
        }
      }
    }

    return items;
  }

  private findBaseConfigDir(pluginsDirOrPluginPath: string, scope: PluginScope, workspacePath?: string): string {
    const normalized = path.resolve(pluginsDirOrPluginPath);
    const codexIdx = normalized.indexOf(path.sep + '.codex');
    if (codexIdx !== -1) {
      return normalized.slice(0, codexIdx + path.sep.length + '.codex'.length);
    }
    const cacheIdx = normalized.indexOf(path.sep + 'plugins' + path.sep + 'cache');
    if (cacheIdx !== -1) {
      return normalized.slice(0, cacheIdx);
    }

    if (scope === 'workspace' && workspacePath) {
      return path.join(workspacePath, '.codex');
    }
    // 对于 Agent 专属级和全局级，Codex 的 config.toml 均统一位于 ~/.codex/
    return path.join(os.homedir(), '.codex');
  }

  private findActiveVersionDir(pluginBasePath: string): string | null {
    const { activePath, disabledPath } = this.findManifestPaths(pluginBasePath);
    if (activePath || disabledPath) {
      return pluginBasePath;
    }

    try {
      const entries = fs.readdirSync(pluginBasePath, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.'));
      if (entries.length === 0) return null;

      // 优先找 local，或者最新的版本目录
      const local = entries.find((e) => e.name === 'local');
      if (local) return path.join(pluginBasePath, local.name);

      // 默认取最后一个版本目录
      return path.join(pluginBasePath, entries[entries.length - 1].name);
    } catch {
      return null;
    }
  }

  /**
   * 双轨扫描 2：扫描本地自建单体技能目录 (skills/) - 纯只读展示
   */
  public scanSkillsDirectory(
    skillsDir: string,
    scope: PluginScope,
    workspaceName?: string,
    workspacePath?: string
  ): LocalSkillItem[] {
    const items: LocalSkillItem[] = [];
    if (!fs.existsSync(skillsDir)) return items;

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(skillsDir, entry.name);

      if (entry.isDirectory()) {
        const hasPluginHub = fs.existsSync(path.join(fullPath, '.pluginhub.json'));
        const { activePath, disabledPath } = this.findManifestPaths(fullPath);
        if (hasPluginHub || activePath || disabledPath) {
          continue;
        }
      }

      let skillName = entry.name;
      let skillMdPath = '';

      if (entry.isDirectory()) {
        const directSkillMd = path.join(fullPath, 'SKILL.md');
        if (fs.existsSync(directSkillMd)) {
          skillMdPath = directSkillMd;
        }
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.skill'))) {
        skillMdPath = fullPath;
        skillName = entry.name.replace(/\.(md|skill)$/, '');
      }

      if (skillMdPath && fs.existsSync(skillMdPath)) {
        let description = `${skillName} (自建技能)`;
        let gitSha: string | undefined;

        try {
          const content = fs.readFileSync(skillMdPath, 'utf-8');
          gitSha = computeGitBlobSha(content);
          const match = content.match(/^description:\s*([^\r\n]+)/m);
          if (match) description = match[1].trim();
        } catch {}

        items.push({
          name: skillName,
          description,
          path: entry.isDirectory() ? fullPath : skillMdPath,
          scope,
          workspaceName,
          workspacePath,
          enabled: true,
          isCustom: true,
          isManaged: false,
          itemType: 'skill',
          gitSha,
          skills: [skillName],
          hasScripts: false,
          hasMcp: false,
          runtime: this.runtime
        });
      }
    }

    return items;
  }

  private parsePluginDirectory(
    pluginPath: string,
    scope: PluginScope,
    marketplaceName: string = 'default',
    baseConfigDir: string,
    workspaceName?: string,
    workspacePath?: string
  ): LocalSkillItem | null {
    const lockfile = this.readPluginhubMetadata(pluginPath);
    const pluginJson = this.readPluginJson(pluginPath);
    const { activePath } = this.findManifestPaths(pluginPath);
    const isManifestEnabled = !!activePath;

    const { pluginName, marketplaceName: resolvedMarket } = this.extractMarketplaceAndPluginName(
      pluginPath,
      lockfile,
      pluginJson,
      marketplaceName
    );

    // 结合 config.toml 中的状态判定
    const pluginKey = `${pluginName}@${resolvedMarket}`;
    const tomlEnabled =
      CodexConfigHelper.getPluginEnabled(baseConfigDir, pluginKey) ??
      CodexConfigHelper.getPluginEnabled(baseConfigDir, pluginName);

    const finalEnabled = tomlEnabled !== null ? tomlEnabled : (lockfile?.enabled !== undefined ? lockfile.enabled : isManifestEnabled);

    const isNative = this.isNativePlugin(resolvedMarket, pluginPath, lockfile);

    const skills = SkillScanner.scanPluginSkills(
      pluginPath,
      lockfile?.skills,
      pluginJson?.skills,
      pluginName
    );

    return {
      name: pluginName,
      description: pluginJson?.description || lockfile?.description || '',
      path: pluginPath,
      scope,
      workspaceName,
      workspacePath,
      enabled: finalEnabled,
      isCustom: !lockfile?.source && !isNative,
      isManaged: true,
      isNative,
      itemType: 'plugin',
      sourceUrl: typeof lockfile?.source === 'string' ? lockfile.source : lockfile?.source?.url,
      sourceName: resolvedMarket,
      version: lockfile?.version || pluginJson?.version || '1.0.0',
      gitSha: lockfile?.gitSha,
      gitTag: lockfile?.gitTag,
      skills,
      hasScripts: fs.existsSync(path.join(pluginPath, 'scripts')),
      hasMcp: !!(pluginJson?.mcpServers || fs.existsSync(path.join(pluginPath, 'mcp.json')) || fs.existsSync(path.join(pluginPath, '.mcp.json'))),
      installedAt: lockfile?.installedAt,
      runtime: this.runtime
    };
  }

    /**
   * 执行插件的原子启停 (Enable / Disable)
   * 在 Codex 中仅修改 config.toml 中的 enabled = true/false，
   * 严格保持 plugin.json 清单文件存在以供 Codex 客户端正常发现与展示。
   * (同时自动愈合可能存在的历史 .disabled 遗留文件)
   */
  public async togglePluginState(
    pluginPath: string,
    enabled: boolean,
    scope: PluginScope,
    workspacePath?: string
  ): Promise<void> {
    // 自动愈合：确保 plugin.json 存在，避免 Codex 客户端丢失插件
    const { disabledPath, manifestRelPath } = this.findManifestPaths(pluginPath);
    if (disabledPath && fs.existsSync(disabledPath)) {
      const targetActive = path.join(pluginPath, manifestRelPath);
      if (!fs.existsSync(targetActive)) {
        try {
          fs.renameSync(disabledPath, targetActive);
        } catch {}
      }
    }

    const meta = this.readPluginhubMetadata(pluginPath);
    if (meta) {
      meta.enabled = enabled;
      this.writePluginhubMetadata(pluginPath, meta);
    }

    // 同步写入 config.toml (Codex 标准生态启停源)
    const baseConfigDir = this.findBaseConfigDir(pluginPath, scope, workspacePath);
    const pluginJson = this.readPluginJson(pluginPath);
    const { pluginName, marketplaceName } = this.extractMarketplaceAndPluginName(pluginPath, meta, pluginJson);
    const pluginKey = `${pluginName}@${marketplaceName}`;

    CodexConfigHelper.setPluginEnabled(baseConfigDir, pluginKey, enabled);
  }

  /**
   * 安全删除托管插件，并从 config.toml 中清除 (原生内置插件禁止删除)
   */
  public async deletePlugin(pluginPath: string, scope: PluginScope, workspacePath?: string): Promise<void> {
    const meta = this.readPluginhubMetadata(pluginPath);
    const pluginJson = this.readPluginJson(pluginPath);
    const { pluginName, marketplaceName } = this.extractMarketplaceAndPluginName(pluginPath, meta, pluginJson);

    // 原生内置插件受保护禁止删除
    if (this.isNativePlugin(marketplaceName, pluginPath, meta)) {
      throw new Error(`原生内置插件 "${pluginName}" 受系统保护，禁止删除`);
    }

    const baseConfigDir = this.findBaseConfigDir(pluginPath, scope, workspacePath);
    const pluginKey = `${pluginName}@${marketplaceName}`;

    // 从 config.toml 中清除
    CodexConfigHelper.removePlugin(baseConfigDir, pluginKey);

    // 删除缓存目录 (如果是在 version 目录下，清理整 plugin 目录)
    const parentDir = path.dirname(pluginPath);
    if (fs.existsSync(pluginPath)) {
      fs.rmSync(pluginPath, { recursive: true, force: true });
    }
    // 如果父目录空了（即 plugin 目录），一并清理
    if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
      try { fs.rmSync(parentDir, { recursive: true, force: true }); } catch {}
    }
  }

  /**
   * 合并配套 MCP 工具链配置到 config.toml [mcp_servers] 与 .codex/mcp.json
   */
  public mergeMcpConfig(
    sourceMcpConfig: Record<string, any>,
    scope: PluginScope,
    workspacePath?: string,
    env?: Record<string, string>
  ): void {
    const paths = this.resolvePaths(scope, workspacePath);
    const baseConfigDir = paths.baseConfigDir;

    const incomingServers = sourceMcpConfig.mcpServers || sourceMcpConfig;
    for (const [serverName, serverDef] of Object.entries(incomingServers)) {
      const clonedDef: any = JSON.parse(JSON.stringify(serverDef));
      if (env && Object.keys(env).length > 0) {
        clonedDef.env = { ...(clonedDef.env || {}), ...env };
      }
      CodexConfigHelper.mergeMcpServer(baseConfigDir, serverName, clonedDef);
    }

    // 同时写一份兼容的 mcp.json
    const targetFile = paths.mcpConfigFile;
    const targetDir = path.dirname(targetFile);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let existingConfig: any = { mcpServers: {} };
    if (fs.existsSync(targetFile)) {
      try {
        existingConfig = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
        if (!existingConfig.mcpServers) existingConfig.mcpServers = {};
      } catch {}
    }

    for (const [serverName, serverDef] of Object.entries(incomingServers)) {
      const clonedDef: any = JSON.parse(JSON.stringify(serverDef));
      if (env && Object.keys(env).length > 0) {
        clonedDef.env = { ...(clonedDef.env || {}), ...env };
      }
      existingConfig.mcpServers[serverName] = clonedDef;
    }

    fs.writeFileSync(targetFile, JSON.stringify(existingConfig, null, 2), 'utf-8');
  }

  /**
   * CLI 外部安装插件的元数据自动愈合
   */
  public synthesizeMissingMetadata(
    pluginDir: string,
    scope: PluginScope,
    workspaceName?: string,
    workspacePath?: string
  ): PluginhubMetadata | null {
    const pluginJson = this.readPluginJson(pluginDir);
    if (!pluginJson) return null;

    const { pluginName, marketplaceName } = this.extractMarketplaceAndPluginName(pluginDir, null, pluginJson);
    const { activePath } = this.findManifestPaths(pluginDir);

    const meta: PluginhubMetadata = {
      name: pluginName,
      description: pluginJson.description || '',
      version: pluginJson.version || '1.0.0',
      runtime: this.runtime,
      sourceName: marketplaceName,
      skills: SkillScanner.scanPluginSkills(pluginDir, null, pluginJson.skills, pluginName),
      installedAt: Date.now(),
      installedScope: scope,
      enabled: !!activePath
    };

    this.writePluginhubMetadata(pluginDir, meta);
    return meta;
  }
}
