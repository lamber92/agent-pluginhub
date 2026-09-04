import * as fs from 'fs';
import * as path from 'path';
import { MarketplaceManifest, MarketplacePlugin, MarketplaceSourceConfig, SkillDetail, PluginDetail, SubSkillItem } from '../types';
import { ConfigService } from './ConfigService';
import { computeGitBlobSha, AntigravityPluginService } from './AntigravityPluginService';
import { HttpClient } from '../utils/HttpClient';
import { GitMetadataService } from './GitMetadataService';
import { CategoryClassifier } from './CategoryClassifier';
import { SecurityAuditor } from './SecurityAuditor';

function githubTokenForUrl(url: string, token?: string): string | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'api.github.com' || host === 'raw.githubusercontent.com' || host === 'github.com'
      ? token
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 市场聚合业务编排门面服务
 * 负责调度 GitMetadataService、SecurityAuditor、CategoryClassifier 与 HttpClient，拉取并聚合各市场源的 Plugins 列表与富文本详情
 */
export class MarketplaceService {
  private static readonly CACHE_TTL_MS = 60 * 60 * 1000; // 缓存有效期 1 小时

  constructor(private configService: ConfigService) { }

  /**
   * 拉取所有已启用市场源或指定源的 Skill / Plugin 列表
   * @param sourceId 可选的指定源 ID
   * @param forceRefresh 是否强制跳过缓存重新从网络拉取
   */
  public async fetchMarketplace(sourceId?: string, forceRefresh = false): Promise<MarketplacePlugin[]> {
    const sources = this.configService.getSources(true).filter((s) => s.enabled);
    const targetSources = sourceId ? sources.filter((s) => s.id === sourceId) : sources;

    let allPlugins: MarketplacePlugin[] = [];

    for (const source of targetSources) {
      try {
        const plugins = await this.fetchSourcePlugins(source, forceRefresh);
        allPlugins = allPlugins.concat(plugins);
      } catch (err: any) {
        console.error(`Failed to fetch source ${source.name}:`, err);
      }
    }

    return allPlugins;
  }

  /**
   * 拉取并解析单个市场源的插件清单（支持 1小时 本地内存/磁盘缓存）
   */
  public async fetchSourcePlugins(source: MarketplaceSourceConfig, forceRefresh = false): Promise<MarketplacePlugin[]> {
    const cacheKey = `marketplace_v8_${source.id}`;
    if (!forceRefresh) {
      const cached = this.configService.getCachedData<MarketplacePlugin[]>(cacheKey);
      if (cached && Date.now() - cached.timestamp < MarketplaceService.CACHE_TTL_MS) {
        return cached.data;
      }
    }

    let manifest: MarketplaceManifest;

    switch (source.type) {
      case 'official':
      case 'git': {
        manifest = await this.fetchFromGitSource(source);
        break;
      }
      case 'url': {
        manifest = await this.fetchFromUrl(source.location, source.token);
        break;
      }
      case 'local': {
        manifest = await this.fetchFromLocalPath(source.location);
        break;
      }
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }

    const cleanLocation = source.location.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');

    // Cache repo metadata queries during one batch
    const repoMetaCache = new Map<string, { commitSha: string; latestTag?: string; commitTagMap: Map<string, string> }>();

    const getMeta = async (repo: string) => {
      if (repoMetaCache.has(repo)) return repoMetaCache.get(repo)!;
      const meta = await GitMetadataService.fetchGitRepoMeta(repo, source.token);
      repoMetaCache.set(repo, meta);
      return meta;
    };

    const plugins = await Promise.all(
      (manifest.plugins || []).map(async (plugin) => {
        let resolvedSource: any = plugin.source;

        // If source is a relative path or string, resolve it to git-subdir object
        if (typeof plugin.source === 'string') {
          if (plugin.source.startsWith('./') || !plugin.source.startsWith('http')) {
            resolvedSource = {
              source: 'git-subdir',
              url: `https://github.com/${cleanLocation}`,
              path: plugin.source.replace(/^\.\//, ''),
              ref: source.branch || 'main'
            };
          } else {
            resolvedSource = {
              source: 'url',
              url: plugin.source
            };
          }
        }

        // Determine actual target GitHub repository (e.g. obra/superpowers)
        let targetRepo = cleanLocation;
        if (resolvedSource && resolvedSource.url) {
          const match = resolvedSource.url.match(/github\.com\/([^/]+\/[^/#?]+)/);
          if (match) {
            targetRepo = match[1].replace(/\.git$/, '');
          }
        }

        const meta = await getMeta(targetRepo);
        const pinnedSha = typeof plugin.source === 'object' && plugin.source?.sha ? plugin.source.sha.slice(0, 7) : undefined;
        let effectiveSha = pinnedSha || meta.commitSha;
        if (!effectiveSha) {
          effectiveSha = computeGitBlobSha(`${plugin.name}:${plugin.description || ''}:${targetRepo}`).slice(0, 7);
        }

        const matchedTag = meta.latestTag || meta.commitTagMap.get(effectiveSha);

        let version = plugin.version;
        if (!version) {
          if (matchedTag) {
            version = matchedTag.startsWith('v') || matchedTag.startsWith('V') ? matchedTag : `tag:${matchedTag}`;
          } else {
            version = `git:${effectiveSha}`;
          }
        }

        return {
          ...plugin,
          version,
          gitSha: effectiveSha,
          gitTag: matchedTag,
          source: resolvedSource,
          sourceId: source.id,
          sourceName: source.name,
          skills: plugin.skills,
          category: plugin.category || CategoryClassifier.inferCategory(plugin)
        };
      })
    );

    await this.configService.setCachedData(cacheKey, plugins);
    return plugins;
  }

  /**
   * 直接从本地文件系统深度读取已安装 Plugin / Skill 的完整运行时全景信息
   * 包含：.skillhub.json 元数据、skills/ 内所有子技能摘要与路径、.mcp.json、scripts/、安全扫描报告
   */
  public async fetchLocalSkillDetail(skillDir: string): Promise<PluginDetail> {
    const skillName = path.basename(skillDir);
    const skillMd = path.join(skillDir, 'SKILL.md');
    const skillMdDisabled = path.join(skillDir, 'SKILL.md.disabled');
    const readmeMd = path.join(skillDir, 'README.md');
    const targetMd = fs.existsSync(skillMd)
      ? skillMd
      : fs.existsSync(skillMdDisabled)
      ? skillMdDisabled
      : fs.existsSync(readmeMd)
      ? readmeMd
      : null;

    let rawContent = '';
    if (targetMd && fs.existsSync(targetMd)) {
      rawContent = fs.readFileSync(targetMd, 'utf-8');
    }

    const { frontmatter, body } = this.parseFrontmatter(rawContent);

    // 1. 读取 .pluginhub.json 记录的精准元数据
    const meta = AntigravityPluginService.readPluginhubMetadata(skillDir);

    // 2. 深度扫描并解析内部所有子技能 (skills/ 目录)
    const skillItems: SubSkillItem[] = [];
    const skillsSubDir = path.join(skillDir, 'skills');
    if (fs.existsSync(skillsSubDir)) {
      try {
        const entries = fs.readdirSync(skillsSubDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const subSkillMdPath = path.join(skillsSubDir, entry.name, 'SKILL.md');
            let subDesc = 'No description provided.';
            let subName = entry.name;
            if (fs.existsSync(subSkillMdPath)) {
              try {
                const subContent = fs.readFileSync(subSkillMdPath, 'utf-8');
                const subParsed = this.parseFrontmatter(subContent);
                if (subParsed.frontmatter.name) subName = subParsed.frontmatter.name;
                if (subParsed.frontmatter.description) {
                  subDesc = subParsed.frontmatter.description;
                } else if (subParsed.body) {
                  const firstLine = subParsed.body.split('\n').find((l) => l.trim() && !l.startsWith('#'));
                  if (firstLine) subDesc = firstLine.trim();
                }
              } catch {}
            }
            skillItems.push({
              name: subName,
              description: subDesc,
              path: subSkillMdPath
            });
          }
        }
      } catch {}
    }

    // 3. 读取 MCP 配置文件 (支持 mcp_config.json 与 .mcp.json)
    const mcpPath = path.join(skillDir, 'mcp_config.json');
    const legacyMcpPath = path.join(skillDir, '.mcp.json');
    let mcpConfig: any = undefined;
    if (fs.existsSync(mcpPath)) {
      try {
        mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
      } catch {}
    } else if (fs.existsSync(legacyMcpPath)) {
      try {
        mcpConfig = JSON.parse(fs.readFileSync(legacyMcpPath, 'utf-8'));
      } catch {}
    }

    // 读取 plugin.json 补充基础元数据
    const pluginJson = AntigravityPluginService.readPluginJson(skillDir);

    // 4. 读取 scripts/ 目录与执行高危扫描
    const scriptsDir = path.join(skillDir, 'scripts');
    const scripts: any[] = [];
    if (fs.existsSync(scriptsDir)) {
      try {
        const walkScripts = (dir: string, prefix = 'scripts') => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = `${prefix}/${entry.name}`;
            if (entry.isDirectory()) {
              walkScripts(fullPath, relativePath);
            } else if (entry.isFile()) {
              const size = fs.statSync(fullPath).size;
              const content = size <= 1024 * 1024 ? fs.readFileSync(fullPath, 'utf-8') : undefined;
              scripts.push({ name: entry.name, path: relativePath, content });
            }
          }
        };
        walkScripts(scriptsDir);
      } catch {}
    }

    const warningScripts = SecurityAuditor.scan(rawContent, scripts);

    return {
      name: frontmatter.name || meta?.name || skillName,
      description: frontmatter.description || (meta?.skills ? `Includes ${meta.skills.length} skills` : 'Local Installed Plugin'),
      version: meta?.version || frontmatter.version || (meta?.gitSha ? `git:${meta.gitSha.slice(0, 7)}` : '1.0.0'),
      gitSha: meta?.gitSha,
      gitTag: meta?.gitTag,
      installedAt: meta?.installedAt,
      path: skillDir,
      content: body || rawContent || `# ${skillName}\n暂无文档内容。`,
      frontmatter,
      hasScripts: scripts.length > 0,
      scripts,
      hasMcp: !!mcpConfig,
      mcpConfig,
      hasReferences: false,
      references: [],
      sourceUrl: typeof meta?.source === 'string' ? meta.source : meta?.source?.url || '',
      sourceName: meta?.sourceName || (meta ? 'Official Marketplace' : 'Local Custom'),
      category: frontmatter.category || (meta?.skills ? 'development' : 'custom'),
      author: frontmatter.author || (typeof pluginJson?.author === 'string' ? pluginJson.author : pluginJson?.author?.name),
      homepage: frontmatter.homepage || pluginJson?.homepage,
      warningScripts,
      skills: meta?.skills || (skillItems.length > 0 ? skillItems.map((s) => s.name) : undefined),
      skillItems
    };
  }

  /**
   * 从远程 Git 仓库或本地源拉取指定 Plugin 的 SKILL.md 文档、并执行高危指令安全扫描
   */
  public async fetchSkillDetail(plugin: MarketplacePlugin, skillSubPath?: string): Promise<SkillDetail> {
    let rawSkillMd = '';
    const scripts: { name: string; path: string; content?: string }[] = [];
    const references: string[] = [];
    let mcpConfig: Record<string, any> | undefined = undefined;

    const sourceObj = typeof plugin.source === 'string' ? { source: 'url', url: plugin.source } : plugin.source;

    // Resolve URL for raw SKILL.md
    if (sourceObj && (sourceObj.source === 'git-subdir' || sourceObj.source === 'url' || typeof plugin.source === 'string')) {
      const gitUrl = sourceObj.url || (typeof plugin.source === 'string' ? plugin.source : '');
      const subdir = sourceObj.path || '';
      const ref = sourceObj.ref || 'main';

      rawSkillMd = await this.fetchRawSkillMdFromGit(gitUrl, subdir, skillSubPath, ref);
    } else if (plugin.sourceId) {
      const sourceConfig = this.configService.getSources(true).find((s) => s.id === plugin.sourceId);
      if (sourceConfig && sourceConfig.type === 'local') {
        const localPluginDir = path.join(sourceConfig.location, 'plugins', plugin.name);
        const skillMdPath = path.join(localPluginDir, 'skills', skillSubPath || '', 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
          rawSkillMd = fs.readFileSync(skillMdPath, 'utf-8');
        } else {
          const altMd = path.join(localPluginDir, 'SKILL.md');
          if (fs.existsSync(altMd)) {
            rawSkillMd = fs.readFileSync(altMd, 'utf-8');
          }
        }
      }
    }

    const { frontmatter, body } = this.parseFrontmatter(rawSkillMd);

    // Static security audit using dedicated SecurityAuditor
    const warningScripts = SecurityAuditor.scan(rawSkillMd, scripts);

    return {
      name: frontmatter.name || plugin.name,
      description: frontmatter.description || plugin.description,
      content: body || rawSkillMd,
      frontmatter,
      hasScripts: scripts.length > 0,
      scripts,
      hasMcp: !!mcpConfig,
      mcpConfig,
      hasReferences: references.length > 0,
      references,
      sourceUrl: typeof plugin.source === 'string' ? plugin.source : plugin.source?.url,
      category: plugin.category || CategoryClassifier.inferCategory(plugin),
      author: plugin.author?.name,
      homepage: plugin.homepage,
      warningScripts
    };
  }

  private async fetchFromGitSource(source: MarketplaceSourceConfig): Promise<MarketplaceManifest> {
    const rawUrls = this.getRawGitUrls(source.location, source.branch || 'main', '.claude-plugin/marketplace.json');
    const settings = this.configService.getSettings(true);
    const token = source.token || settings.githubToken;

    for (const url of rawUrls) {
      try {
        const text = await HttpClient.get(url, { token: githubTokenForUrl(url, token), timeoutMs: 6000 });
        return JSON.parse(text);
      } catch {
        // Try fallback
      }
    }

    // Try fallback to root marketplace.json
    const rootUrls = this.getRawGitUrls(source.location, source.branch || 'main', 'marketplace.json');
    for (const url of rootUrls) {
      try {
        const text = await HttpClient.get(url, { token: githubTokenForUrl(url, token), timeoutMs: 6000 });
        return JSON.parse(text);
      } catch {
        // Try fallback
      }
    }

    throw new Error(`Could not fetch marketplace manifest from ${source.location}`);
  }

  private async fetchFromUrl(url: string, token?: string): Promise<MarketplaceManifest> {
    const text = await HttpClient.get(url, { token, timeoutMs: 8000 });
    return JSON.parse(text);
  }

  private async fetchFromLocalPath(dirPath: string): Promise<MarketplaceManifest> {
    const candidatePaths = [
      path.join(dirPath, '.claude-plugin', 'marketplace.json'),
      path.join(dirPath, 'marketplace.json')
    ];

    for (const candidate of candidatePaths) {
      if (fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate, 'utf-8');
        return JSON.parse(content);
      }
    }

    throw new Error(`No marketplace.json found in local path ${dirPath}`);
  }

  /**
   * Concurrently fetch SKILL.md documentation using fastest mirror racing
   */
  private async fetchRawSkillMdFromGit(gitUrl: string, subdir: string, skillSubPath?: string, ref = 'main'): Promise<string> {
    let repoPath = '';
    const repoMatch = gitUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (repoMatch) {
      repoPath = `${repoMatch[1]}/${repoMatch[2]}`;
    } else if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(gitUrl.trim())) {
      repoPath = gitUrl.trim();
    } else if (gitUrl.startsWith('http://') || gitUrl.startsWith('https://')) {
      return await HttpClient.get(gitUrl, { timeoutMs: 6000 });
    } else {
      repoPath = 'anthropics/claude-plugins-official';
      if (!subdir && gitUrl) subdir = gitUrl.replace(/^\.\//, '');
    }

    const sub = skillSubPath || subdir || '';
    const possiblePaths = [
      path.posix.join(sub, 'SKILL.md'),
      path.posix.join(sub, 'skills', 'SKILL.md'),
      path.posix.join(sub, 'README.md'),
      'SKILL.md',
      'README.md'
    ].filter(Boolean);

    for (const p of possiblePaths) {
      try {
        const content = await this.fetchFastRawFile(repoPath, ref, p);
        if (content && content.trim().length > 0) {
          return content;
        }
      } catch {
        // try next candidate path
      }
    }

    return `# ${repoPath}\nNo SKILL.md documentation found.`;
  }

  private async fetchFastRawFile(repoFullName: string, ref: string, filePath: string): Promise<string> {
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
      const text = await HttpClient.get(url, {
        token: githubTokenForUrl(url, settings.githubToken),
        timeoutMs: 3500
      });
      if (text && text.trim().length > 0) {
        return text;
      }
      throw new Error('Empty content');
    });

    return await Promise.any(fetchPromises);
  }

  private getRawGitUrls(repoPath: string, branch: string, filePath: string): string[] {
    const cleanRepo = repoPath.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
    const officialUrl = `https://raw.githubusercontent.com/${cleanRepo}/${branch}/${filePath}`;
    if (!this.configService.getSettings().mirrorAcceleration) return [officialUrl];
    return [
      `https://fastly.jsdelivr.net/gh/${cleanRepo}@${branch}/${filePath}`,
      `https://raw.gitmirror.com/${cleanRepo}/${branch}/${filePath}`,
      officialUrl
    ];
  }

  private parseFrontmatter(markdown: string): { frontmatter: Record<string, any>; body: string } {
    const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) {
      return { frontmatter: {}, body: markdown };
    }

    const [, yamlBlock, body] = match;
    const frontmatter: Record<string, any> = {};

    const lines = yamlBlock.split(/\r?\n/);
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        let val = line.slice(colonIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        frontmatter[key] = val;
      }
    }

    return { frontmatter, body };
  }
}
