import * as fs from 'fs';
import * as path from 'path';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { AgentRuntimeDetector } from './AgentRuntimeDetector';
import { PluginScope, TargetAgentRuntime } from '../types';

/**
 * MCP (Model Context Protocol) 工具链配置合并服务
 * 统一根据目标运行时委托对应适配器执行 MCP 配置合并与环境变量注入
 */
export class McpService {
  /**
   * 检查指定技能/插件目录是否存在 .mcp.json
   */
  public hasMcpConfig(pluginDir: string): boolean {
    return fs.existsSync(path.join(pluginDir, '.mcp.json'));
  }

  /**
   * 读取插件目录下的 .mcp.json 配置
   */
  public readMcpConfig(pluginDir: string): Record<string, any> | null {
    const configPath = path.join(pluginDir, '.mcp.json');
    if (!fs.existsSync(configPath)) return null;
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * 将插件的 MCP Servers 智能合并到目标 AI 助手的配置文件中
   * @param sourceMcpConfig 待合并的 MCP 配置
   * @param scope 作用域 ('workspace' | 'global')
   * @param targetRuntime 目标运行时 ('auto' | 'antigravity' | 'opencode')
   * @param workspaceRoot 当前工作区根目录
   * @param customEnv 用户自定义环境变量键值对
   */
  public mergeMcpServers(
    sourceMcpConfig: Record<string, any>,
    scope: PluginScope,
    targetRuntime?: TargetAgentRuntime,
    workspaceRoot?: string,
    customEnv?: Record<string, string>
  ): { names: string[]; previous: Record<string, { existed: boolean; value?: any }> } {
    const effectiveRuntime = AgentRuntimeDetector.resolveEffectiveRuntime(targetRuntime, workspaceRoot);
    const adapter = AdapterFactory.getAdapter(effectiveRuntime);
    const names = Object.keys(sourceMcpConfig.mcpServers || sourceMcpConfig);
    const configPath = adapter.resolvePaths(scope, workspaceRoot).mcpConfigFile;
    let existingServers: Record<string, any> = {};
    if (fs.existsSync(configPath)) {
      const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      existingServers = existingConfig.mcpServers || {};
    }
    const previous: Record<string, { existed: boolean; value?: any }> = {};
    for (const name of names) {
      previous[name] = Object.prototype.hasOwnProperty.call(existingServers, name)
        ? { existed: true, value: existingServers[name] }
        : { existed: false };
    }
    adapter.mergeMcpConfig(sourceMcpConfig, scope, workspaceRoot, customEnv);
    return { names, previous };
  }

  public removeMcpServers(
    serverNames: string[],
    scope: PluginScope,
    targetRuntime?: TargetAgentRuntime,
    workspaceRoot?: string,
    previous?: Record<string, { existed: boolean; value?: any }>
  ): void {
    if (serverNames.length === 0) return;
    const effectiveRuntime = AgentRuntimeDetector.resolveEffectiveRuntime(targetRuntime, workspaceRoot);
    const paths = AdapterFactory.getAdapter(effectiveRuntime).resolvePaths(scope, workspaceRoot);
    if (!fs.existsSync(paths.mcpConfigFile)) return;
    const config = JSON.parse(fs.readFileSync(paths.mcpConfigFile, 'utf-8'));
    if (!config.mcpServers || typeof config.mcpServers !== 'object') return;
    for (const name of serverNames) {
      if (previous?.[name]?.existed) config.mcpServers[name] = previous[name].value;
      else delete config.mcpServers[name];
    }
    fs.writeFileSync(paths.mcpConfigFile, JSON.stringify(config, null, 2), 'utf-8');
  }
}
