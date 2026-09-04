import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { IAgentRuntimeAdapter, ResolvedRuntimePaths } from './IAgentRuntimeAdapter';
import { AntigravityPluginJson, ConcreteAgentRuntime, LocalSkillItem, PluginhubMetadata, PluginScope } from '../types';
import { SkillScanner } from '../utils/SkillScanner';

/**
 * 计算文本/Buffer 的 Git Blob SHA-1 哈希指纹
 */
export function computeGitBlobSha(content: string | Buffer): string {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  const header = `blob ${buf.length}\0`;
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(header), buf])).digest('hex');
}

/**
 * Google Antigravity 专有生态适配器
 */
export class AntigravityAdapter implements IAgentRuntimeAdapter {
  public readonly runtime: ConcreteAgentRuntime = 'antigravity';
  public readonly supportedScopes: PluginScope[] = ['workspace', 'agent'];
  public static readonly OFFICIAL_SCHEMA = 'https://antigravity.google/schemas/v1/plugin.json';

  /**
   * 解析 Antigravity 物理路径
   */
  public resolvePaths(scope: PluginScope, workspaceRoot?: string): ResolvedRuntimePaths {
    if (scope === 'global') {
      throw new Error('Google Antigravity does not support global scope (~/.agents/plugins)');
    }
    const isWs = scope === 'workspace' && !!workspaceRoot;
    const baseConfigDir = isWs ? path.join(workspaceRoot!, '.agents') : path.join(os.homedir(), '.gemini', 'config');

    const pluginsDir = path.join(baseConfigDir, 'plugins');
    const skillsDir = path.join(baseConfigDir, 'skills');
    const mcpConfigFile = path.join(baseConfigDir, 'mcp_config.json');
    const pluginsConfigFile = path.join(baseConfigDir, 'plugins.json');
    const skillsConfigFile = path.join(baseConfigDir, 'skills.json');

    return {
      runtime: this.runtime,
      baseConfigDir,
      pluginsDir,
      skillsDir,
      mcpConfigFile,
      pluginsConfigFile,
      skillsConfigFile,
      activeRootDir: pluginsDir
    };
  }

  /**
   * 确保或生成 100% 符合 Antigravity 官方标准的纯净 plugin.json
   */
  public ensurePluginManifest(
    pluginDir: string,
    pluginName: string,
    description?: string,
    extra?: Partial<AntigravityPluginJson>
  ): void {
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
    }

    const pluginJsonPath = path.join(pluginDir, 'plugin.json');
    let currentData: Partial<AntigravityPluginJson> = {};

    if (fs.existsSync(pluginJsonPath)) {
      try {
        currentData = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
      } catch {}
    }

    const cleanData: AntigravityPluginJson = {
      $schema: AntigravityAdapter.OFFICIAL_SCHEMA,
      name: pluginName || currentData.name || path.basename(pluginDir),
      description: description || currentData.description || `${pluginName} plugin for Antigravity`
    };

    if (extra?.author || currentData.author) cleanData.author = extra?.author || currentData.author;
    if (extra?.homepage || currentData.homepage) cleanData.homepage = extra?.homepage || currentData.homepage;
    if (extra?.repository || currentData.repository) cleanData.repository = extra?.repository || currentData.repository;
    if (extra?.skills || currentData.skills) cleanData.skills = extra?.skills || currentData.skills;
    if (extra?.mcpConfig || currentData.mcpConfig) cleanData.mcpConfig = extra?.mcpConfig || currentData.mcpConfig;
    if (extra?.hooks || currentData.hooks) cleanData.hooks = extra?.hooks || currentData.hooks;
    if (extra?.rules || currentData.rules) cleanData.rules = extra?.rules || currentData.rules;

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
   * 读取 plugin.json (含 plugin.json.disabled 备选)
   */
  public readPluginJson(dirPath: string): AntigravityPluginJson | null {
    const activePath = path.join(dirPath, 'plugin.json');
    const disabledPath = path.join(dirPath, 'plugin.json.disabled');
    const target = fs.existsSync(activePath) ? activePath : fs.existsSync(disabledPath) ? disabledPath : null;

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
   * 双轨扫描 1：扫描托管插件目录 (plugins/)
   */
  public scanPluginsDirectory(
    pluginsDir: string,
    scope: PluginScope,
    workspaceName?: string,
    workspacePath?: string
  ): LocalSkillItem[] {
    const items: LocalSkillItem[] = [];
    if (!fs.existsSync(pluginsDir)) return items;

    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      const pluginPath = path.join(pluginsDir, entry.name);
      const pluginItem = this.parsePluginDirectory(pluginPath, scope, workspaceName, workspacePath);
      if (pluginItem) {
        items.push(pluginItem);
      }
    }

    return items;
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

  /**
   * 解析单个插件目录
   */
  private parsePluginDirectory(
    pluginPath: string,
    scope: PluginScope,
    workspaceName?: string,
    workspacePath?: string
  ): LocalSkillItem | null {
    const pluginName = path.basename(pluginPath);
    let meta = this.readPluginhubMetadata(pluginPath);
    const pluginJson = this.readPluginJson(pluginPath);

    // 若缺失 .pluginhub.json，执行自动愈合推断
    if (!meta) {
      meta = this.synthesizeMissingMetadata(pluginPath, scope, workspaceName, workspacePath);
    }

    const activeManifestExists = fs.existsSync(path.join(pluginPath, 'plugin.json'));
    const disabledManifestExists = fs.existsSync(path.join(pluginPath, 'plugin.json.disabled'));

    if (!activeManifestExists && !disabledManifestExists && !meta) {
      return null;
    }

    let isEnabled = true;
    if (disabledManifestExists && !activeManifestExists) {
      isEnabled = false;
    } else if (meta?.enabled !== undefined) {
      isEnabled = meta.enabled;
    }

    // 检查 Antigravity 专有的 plugins.json 排除项状态
    const paths = this.resolvePaths(scope, workspacePath);
    if (paths.pluginsConfigFile && fs.existsSync(paths.pluginsConfigFile)) {
      try {
        const pluginsConfig = JSON.parse(fs.readFileSync(paths.pluginsConfigFile, 'utf-8'));
        if (Array.isArray(pluginsConfig?.entries)) {
          const hasExclusion = pluginsConfig.entries.some((entry: any) => {
            return (
              Array.isArray(entry?.exclude) &&
              entry.exclude.some((pattern: string) => {
                const clean = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const reg = new RegExp(pattern.includes('.*') || pattern.includes('*') ? pattern : `^${clean}$`);
                return reg.test(pluginName);
              })
            );
          });
          if (hasExclusion) {
            isEnabled = false;
          }
        }
      } catch {}
    }

    const hasScripts = fs.existsSync(path.join(pluginPath, 'scripts'));
    const hasMcp = fs.existsSync(path.join(pluginPath, '.mcp.json'));

    const description = meta?.description || pluginJson?.description || `${pluginName} plugin for Antigravity`;

    const scannedSkills = SkillScanner.scanPluginSkills(
      pluginPath,
      meta?.skills,
      pluginJson?.skills,
      pluginName
    );

    return {
      name: pluginName,
      description,
      path: pluginPath,
      scope,
      workspaceName,
      workspacePath,
      enabled: isEnabled,
      isCustom: false,
      isManaged: true,
      itemType: 'plugin',
      sourceName: meta?.sourceName || 'Antigravity Managed Plugin',
      version: meta?.version || (pluginJson as any)?.version || '1.0.0',
      gitSha: meta?.gitSha,
      gitTag: meta?.gitTag,
      installedAt: meta?.installedAt,
      skills: scannedSkills.length > 0 ? scannedSkills : [pluginName],
      hasScripts,
      hasMcp,
      runtime: this.runtime
    };
  }

  /**
   * CLI 外部安装插件的元数据自动愈合与反向推断
   */
  public synthesizeMissingMetadata(
    pluginPath: string,
    scope: PluginScope,
    workspaceName?: string,
    workspacePath?: string
  ): PluginhubMetadata | null {
    try {
      const pluginName = path.basename(pluginPath);
      const pluginJson = this.readPluginJson(pluginPath);

      const subSkills: string[] = [];
      const skillsSubDir = path.join(pluginPath, 'skills');
      if (fs.existsSync(skillsSubDir)) {
        try {
          const subEntries = fs.readdirSync(skillsSubDir, { withFileTypes: true });
          for (const sub of subEntries) {
            if (sub.isDirectory() && fs.existsSync(path.join(skillsSubDir, sub.name, 'SKILL.md'))) {
              subSkills.push(sub.name);
            }
          }
        } catch {}
      }

      let gitSha: string | undefined;
      const gitHeadPath = path.join(pluginPath, '.git', 'HEAD');
      if (fs.existsSync(gitHeadPath)) {
        try {
          const headContent = fs.readFileSync(gitHeadPath, 'utf-8').trim();
          if (headContent.startsWith('ref:')) {
            const refRelative = headContent.replace(/^ref:\s*/, '');
            const refPath = path.join(pluginPath, '.git', refRelative);
            if (fs.existsSync(refPath)) {
              gitSha = fs.readFileSync(refPath, 'utf-8').trim();
            }
          } else {
            gitSha = headContent;
          }
        } catch {}
      }

      const meta: PluginhubMetadata = {
        name: pluginName,
        description: pluginJson?.description || `${pluginName} plugin for Antigravity`,
        version: (pluginJson as any)?.version || '1.0.0',
        gitSha,
        runtime: this.runtime,
        source: 'local',
        sourceName: 'CLI / 外部安装',
        skills: subSkills.length > 0 ? subSkills : pluginJson?.skills || [pluginName],
        installedAt: Date.now(),
        installedScope: scope,
        enabled: !fs.existsSync(path.join(pluginPath, 'plugin.json.disabled'))
      };

      try {
        this.writePluginhubMetadata(pluginPath, meta);
      } catch (writeErr) {
        console.warn(`[AntigravityAdapter] Write .pluginhub.json fallback to in-memory for ${pluginName}:`, writeErr);
      }

      return meta;
    } catch (err) {
      console.warn(`[AntigravityAdapter] Failed to synthesize metadata for ${pluginPath}:`, err);
      return null;
    }
  }

  /**
   * 执行插件原子无损启停 (Enable / Disable)
   */
  public async togglePluginState(
    pluginPath: string,
    enabled: boolean,
    scope: PluginScope,
    workspacePath?: string
  ): Promise<void> {
    const pluginName = path.basename(pluginPath);
    const activePath = path.join(pluginPath, 'plugin.json');
    const disabledPath = path.join(pluginPath, 'plugin.json.disabled');

    if (enabled) {
      if (fs.existsSync(disabledPath)) {
        fs.renameSync(disabledPath, activePath);
      } else if (!fs.existsSync(activePath)) {
        this.ensurePluginManifest(pluginPath, pluginName);
      }
    } else {
      if (fs.existsSync(activePath)) {
        fs.renameSync(activePath, disabledPath);
      }
    }

    const meta = this.readPluginhubMetadata(pluginPath);
    if (meta) {
      meta.enabled = enabled;
      this.writePluginhubMetadata(pluginPath, meta);
    }

    const paths = this.resolvePaths(scope, workspacePath);
    if (paths.pluginsConfigFile) {
      this.syncPluginsJsonExclusion(paths.pluginsConfigFile, pluginName, !enabled);
    }
  }

  /**
   * 同步 Antigravity 专有的 plugins.json 排除项配置
   */
  private syncPluginsJsonExclusion(pluginsConfigPath: string, pluginName: string, exclude: boolean): void {
    try {
      const configDir = path.dirname(pluginsConfigPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      let config: any = { entries: [{ source: './plugins', exclude: [] }] };
      if (fs.existsSync(pluginsConfigPath)) {
        try {
          config = JSON.parse(fs.readFileSync(pluginsConfigPath, 'utf-8'));
        } catch {
          config = { entries: [{ source: './plugins', exclude: [] }] };
        }
      }

      if (!Array.isArray(config.entries) || config.entries.length === 0) {
        config.entries = [{ source: './plugins', exclude: [] }];
      }

      const mainEntry = config.entries[0];
      if (!Array.isArray(mainEntry.exclude)) {
        mainEntry.exclude = [];
      }

      const existsIndex = mainEntry.exclude.indexOf(pluginName);
      if (exclude && existsIndex === -1) {
        mainEntry.exclude.push(pluginName);
      } else if (!exclude && existsIndex !== -1) {
        mainEntry.exclude.splice(existsIndex, 1);
      }

      fs.writeFileSync(pluginsConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
      console.warn(`[AntigravityAdapter] Failed to sync ${pluginsConfigPath}:`, err);
    }
  }

  /**
   * 安全删除托管插件并清理关联配置
   */
  public async deletePlugin(pluginPath: string, scope: PluginScope, workspacePath?: string): Promise<void> {
    const pluginName = path.basename(pluginPath);
    if (fs.existsSync(pluginPath)) {
      fs.rmSync(pluginPath, { recursive: true, force: true });
    }

    const paths = this.resolvePaths(scope, workspacePath);
    if (paths.pluginsConfigFile && fs.existsSync(paths.pluginsConfigFile)) {
      this.syncPluginsJsonExclusion(paths.pluginsConfigFile, pluginName, false);
    }
  }

  /**
   * 合并配套 MCP 工具链配置到 Antigravity 的 mcp_config.json 中
   */
  public mergeMcpConfig(
    sourceMcpConfig: Record<string, any>,
    scope: PluginScope,
    workspacePath?: string,
    env?: Record<string, string>
  ): void {
    const paths = this.resolvePaths(scope, workspacePath);
    const targetConfigPath = paths.mcpConfigFile;
    const targetDir = path.dirname(targetConfigPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 首次修改前自动生成 .bak 备份
    if (fs.existsSync(targetConfigPath) && !fs.existsSync(`${targetConfigPath}.bak`)) {
      try {
        fs.copyFileSync(targetConfigPath, `${targetConfigPath}.bak`);
      } catch {}
    }

    let existingConfig: { mcpServers?: Record<string, any> } = { mcpServers: {} };
    if (fs.existsSync(targetConfigPath)) {
      try {
        existingConfig = JSON.parse(fs.readFileSync(targetConfigPath, 'utf-8'));
      } catch (error) {
        throw new Error(`Cannot merge MCP config because ${targetConfigPath} is invalid JSON: ${String(error)}`);
      }
    }

    if (!existingConfig.mcpServers) {
      existingConfig.mcpServers = {};
    }

    const serversToMerge = sourceMcpConfig.mcpServers || sourceMcpConfig;
    for (const [serverName, serverDef] of Object.entries(serversToMerge)) {
      if (typeof serverDef === 'object' && serverDef !== null) {
        const mergedDef = { ...(serverDef as any) };
        if (env && Object.keys(env).length > 0) {
          mergedDef.env = { ...(mergedDef.env || {}), ...env };
        }
        existingConfig.mcpServers[serverName] = mergedDef;
      }
    }

    fs.writeFileSync(targetConfigPath, JSON.stringify(existingConfig, null, 2), 'utf-8');
  }
}
