import * as path from 'path';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { ResolvedRuntimePaths } from '../adapters/IAgentRuntimeAdapter';
import { ConcreteAgentRuntime, PluginScope } from '../types';
import { assertPathWithin, validatePluginName, sanitizeMarketName, sanitizeVersion } from '../utils/PathSafety';

export { sanitizeMarketName, sanitizeVersion };

/**
 * 物理路径解析与路由协调器
 * 统一委托 AdapterFactory 分发各 Agent 生态的物理路径
 */
export class RuntimePathResolver {
  public static validatePluginName(pluginName: string): string {
    return validatePluginName(pluginName);
  }

  public static assertPathWithin(candidate: string, parent: string): void {
    assertPathWithin(candidate, parent);
  }

  public static getGlobalPluginsDir(): string {
    const adapter = AdapterFactory.getAdapter('codex');
    return adapter.resolvePaths('global').activeRootDir;
  }

  public static getAgentPluginsDir(runtime: ConcreteAgentRuntime = 'antigravity'): string {
    const adapter = AdapterFactory.getAdapter(runtime);
    if (adapter.supportedScopes.includes('agent')) {
      return adapter.resolvePaths('agent').activeRootDir;
    }
    return adapter.resolvePaths('global').activeRootDir;
  }

  public static getWorkspacePluginsDir(workspaceRoot: string, runtime: ConcreteAgentRuntime = 'antigravity'): string {
    const adapter = AdapterFactory.getAdapter(runtime);
    return adapter.resolvePaths('workspace', workspaceRoot).activeRootDir;
  }

  /**
   * 解析具体插件的目标物理路径与配置文件
   */
  public static resolve(
    pluginName: string,
    scope: PluginScope,
    workspaceRoot?: string,
    runtime: ConcreteAgentRuntime = 'antigravity',
    marketplaceName: string = 'default',
    version: string = '1.0.0'
  ): ResolvedRuntimePaths & { pluginDir: string; skillDir: string; activeDir: string } {
    const safePluginName = this.validatePluginName(pluginName);
    const adapter = AdapterFactory.getAdapter(runtime);
    if (!adapter.supportedScopes.includes(scope)) {
      throw new Error(`${runtime} does not support ${scope} scope`);
    }
    const resolved = adapter.resolvePaths(scope, workspaceRoot);

    let activeDir: string;
    // 当为 OpenAI Codex 且处于 Agent 或 Workspace 级时，严格按照 Codex 原生规范落地为 plugins/cache/<market>/<plugin>/<version>
    if (runtime === 'codex' && (scope === 'agent' || scope === 'workspace')) {
      const safeMarket = sanitizeMarketName(marketplaceName || 'default');
      const safeVer = sanitizeVersion(version || '1.0.0');
      activeDir = path.join(resolved.activeRootDir, safeMarket, safePluginName, safeVer);
    } else {
      activeDir = path.join(resolved.activeRootDir, safePluginName);
    }

    const pluginDir = activeDir;
    const skillDir = path.join(resolved.skillsDir, safePluginName);
    this.assertPathWithin(pluginDir, resolved.activeRootDir);
    this.assertPathWithin(skillDir, resolved.skillsDir);

    return {
      ...resolved,
      pluginDir,
      skillDir,
      activeDir
    };
  }
}
