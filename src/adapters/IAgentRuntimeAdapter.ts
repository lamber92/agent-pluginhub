import { ConcreteAgentRuntime, LocalSkillItem, PluginhubMetadata, PluginScope } from '../types';

export interface ResolvedRuntimePaths {
  runtime: ConcreteAgentRuntime;
  baseConfigDir: string;
  pluginsDir: string;
  skillsDir: string;
  mcpConfigFile: string;
  pluginsConfigFile?: string; // Antigravity 专有 plugins.json
  skillsConfigFile?: string;
  activeRootDir: string;
}

export interface IAgentRuntimeAdapter {
  readonly runtime: ConcreteAgentRuntime;

  /**
   * 解析指定作用域下的物理路径配置
   */
  readonly supportedScopes: PluginScope[];
  resolvePaths(scope: PluginScope, workspaceRoot?: string): ResolvedRuntimePaths;

  /**
   * 确保插件根目录下存在符合该 Agent 标准的纯净 Manifest 文件 (plugin.json)
   */
  ensurePluginManifest(pluginDir: string, pluginName: string, description?: string, extra?: any): void;

  /**
   * 写入包管理器锁定元数据 (.pluginhub.json)
   */
  writePluginhubMetadata(pluginDir: string, meta: PluginhubMetadata): void;

  /**
   * 读取包管理器锁定元数据 (.pluginhub.json)
   */
  readPluginhubMetadata(pluginDir: string): PluginhubMetadata | null;

  /**
   * 读取插件 Manifest (支持 plugin.json 与 plugin.json.disabled)
   */
  readPluginJson(pluginDir: string): Record<string, any> | null;

  /**
   * 双轨扫描 1：扫描托管插件目录 (plugins/)
   */
  scanPluginsDirectory(pluginsDir: string, scope: PluginScope, wsName?: string, wsPath?: string): LocalSkillItem[];

  /**
   * 双轨扫描 2：扫描用户自建单体技能目录 (skills/) - 纯只读展示
   */
  scanSkillsDirectory(skillsDir: string, scope: PluginScope, wsName?: string, wsPath?: string): LocalSkillItem[];

  /**
   * 执行插件的原子无损启停 (Enable / Disable)
   */
  togglePluginState(pluginPath: string, enabled: boolean, scope: PluginScope, wsPath?: string): Promise<void>;

  /**
   * 安全删除托管插件并清理关联配置
   */
  deletePlugin(pluginPath: string, scope: PluginScope, wsPath?: string): Promise<void>;

  /**
   * 合并配套 MCP 工具链配置到目标 Agent 的配置文件中
   */
  mergeMcpConfig(sourceMcpConfig: Record<string, any>, scope: PluginScope, wsPath?: string, env?: Record<string, string>): void;

  /**
   * CLI 外部安装插件的元数据自动愈合与反向推断
   */
  synthesizeMissingMetadata(pluginDir: string, scope: PluginScope, wsName?: string, wsPath?: string): PluginhubMetadata | null;
}

