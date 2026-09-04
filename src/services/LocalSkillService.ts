import * as path from 'path';
import * as vscode from 'vscode';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { ConcreteAgentRuntime, LocalSkillItem, PluginScope, TargetAgentRuntime } from '../types';
import { AgentRuntimeDetector } from './AgentRuntimeDetector';
import { ConfigService } from './ConfigService';

function normalizePathKey(p: string): string {
  return path.normalize(p).toLowerCase();
}

/**
 * 本地 AI 插件与技能全生命周期管理服务 (Multi-Agent Universal)
 * 职责：
 * 1. 自动感知各工作区文件夹与全局环境的匹配运行时
 * 2. 调度对应生态适配器执行多轨扫描 (plugins/ 托管插件 + skills/ 自建单体技能)
 * 3. 跨环境无损启停与安全卸载
 */
export class LocalSkillService {
  constructor(
    private context: vscode.ExtensionContext,
    private configService?: ConfigService
  ) {}

  /**
   * 全量多轨扫描已安装的插件与技能（涵盖工作区与全局环境，含启用与禁用状态）
   * @param targetRuntime 可选显式指定的目标运行时
   */
  public async listLocalSkills(targetRuntime?: TargetAgentRuntime): Promise<LocalSkillItem[]> {
    const items: LocalSkillItem[] = [];
    const configuredRuntime = targetRuntime || this.configService?.getSettings().targetAgentRuntime;
    const activeRuntime = AgentRuntimeDetector.resolveEffectiveRuntime(configuredRuntime);
    const activeAdapter = AdapterFactory.getAdapter(activeRuntime);

    // 1. 扫描工作区作用域 (Workspace Scope)
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    for (const folder of workspaceFolders) {
      const wsRoot = folder.uri.fsPath;
      const folderRuntime: ConcreteAgentRuntime = (configuredRuntime && configuredRuntime !== 'auto')
        ? (configuredRuntime as ConcreteAgentRuntime)
        : AgentRuntimeDetector.detectCurrentRuntime(wsRoot);

      const adapter = AdapterFactory.getAdapter(folderRuntime);
      const paths = adapter.resolvePaths('workspace', wsRoot);

      // 1.1 扫描托管插件/技能主目录 (activeRootDir)
      const wsPlugins = adapter.scanPluginsDirectory(paths.activeRootDir, 'workspace', folder.name, wsRoot);
      for (const p of wsPlugins) {
        if (!items.some((it) => normalizePathKey(it.path) === normalizePathKey(p.path))) {
          items.push(p);
        }
      }

      // 1.2 扫描辅助 skills 目录中的插件 (若与 activeRootDir 不同)
      if (paths.skillsDir && paths.skillsDir !== paths.activeRootDir) {
        const wsPluginsInSkills = adapter.scanPluginsDirectory(paths.skillsDir, 'workspace', folder.name, wsRoot);
        for (const p of wsPluginsInSkills) {
          if (!items.some((it) => normalizePathKey(it.path) === normalizePathKey(p.path))) {
            items.push(p);
          }
        }
      }

      // 1.3 扫描用户自建单体技能 (纯只读展示)
      const wsSkills = adapter.scanSkillsDirectory(paths.skillsDir, 'workspace', folder.name, wsRoot);
      for (const s of wsSkills) {
        if (!items.some((it) => normalizePathKey(it.path) === normalizePathKey(s.path))) {
          items.push(s);
        }
      }
    }

    // 2. 扫描 AI Agent 专属能力库 (Agent Scope) - 若当前 Agent 支持
    if (activeAdapter.supportedScopes.includes('agent')) {
      try {
        const agentPaths = activeAdapter.resolvePaths('agent');

        // 2.1 扫描 activeRootDir 中的插件
        const agentPlugins = activeAdapter.scanPluginsDirectory(agentPaths.activeRootDir, 'agent');
        for (const p of agentPlugins) {
          if (!items.some((it) => normalizePathKey(it.path) === normalizePathKey(p.path))) {
            items.push(p);
          }
        }

        // 2.2 扫描 skillsDir 中的托管插件 (如 OpenCode 将插件装在 skills 目录)
        if (agentPaths.skillsDir && agentPaths.skillsDir !== agentPaths.activeRootDir) {
          const pluginsInSkills = activeAdapter.scanPluginsDirectory(agentPaths.skillsDir, 'agent');
          for (const p of pluginsInSkills) {
            if (!items.some((it) => normalizePathKey(it.path) === normalizePathKey(p.path))) {
              items.push(p);
            }
          }
        }

        // 2.3 扫描用户自建单体技能
        const agentSkills = activeAdapter.scanSkillsDirectory(agentPaths.skillsDir, 'agent');
        for (const s of agentSkills) {
          if (!items.some((it) => normalizePathKey(it.path) === normalizePathKey(s.path))) {
            items.push(s);
          }
        }
      } catch (err) {
        console.warn('Failed to scan agent scope:', err);
      }
    }

    // 3. 扫描全局系统级插件目录 (~/.agents/plugins/) - 若当前 Agent 支持
    if (activeAdapter.supportedScopes.includes('global')) {
      try {
        const globalPaths = activeAdapter.resolvePaths('global');

        // 3.1 扫描 activeRootDir 中的插件
        const globalPlugins = activeAdapter.scanPluginsDirectory(globalPaths.activeRootDir, 'global');
        for (const p of globalPlugins) {
          if (!items.some((it) => normalizePathKey(it.path) === normalizePathKey(p.path))) {
            items.push(p);
          }
        }

        // 3.2 扫描 skillsDir 中的插件
        if (globalPaths.skillsDir && globalPaths.skillsDir !== globalPaths.activeRootDir) {
          const globalPluginsInSkills = activeAdapter.scanPluginsDirectory(globalPaths.skillsDir, 'global');
          for (const p of globalPluginsInSkills) {
            if (!items.some((it) => normalizePathKey(it.path) === normalizePathKey(p.path))) {
              items.push(p);
            }
          }
        }

        // 3.3 扫描自建技能
        const globalSkills = activeAdapter.scanSkillsDirectory(globalPaths.skillsDir, 'global');
        for (const s of globalSkills) {
          if (!items.some((it) => normalizePathKey(it.path) === normalizePathKey(s.path))) {
            items.push(s);
          }
        }
      } catch (err) {
        console.warn('Failed to scan global scope:', err);
      }
    }

    return items;
  }

  public async findLocalSkillByPath(skillPath: string): Promise<LocalSkillItem | null> {
    const requestedPath = normalizePathKey(skillPath);
    for (const runtime of ['antigravity', 'opencode', 'codex'] as ConcreteAgentRuntime[]) {
      const match = (await this.listLocalSkills(runtime)).find(
        (item) => normalizePathKey(item.path) === requestedPath
      );
      if (match) return match;
    }
    return null;
  }

  /**
   * 切换托管插件的启用 / 禁用状态
   * 仅对 isManaged === true 的插件生效
   */
  public async toggleSkillState(skill: LocalSkillItem, enabled: boolean): Promise<LocalSkillItem> {
    const trustedSkill = await this.resolveManagedSkill(skill);
    if (!trustedSkill) {
      throw new Error('本地自建单体技能为只读展示项，不支持修改启停状态');
    }

    const wsRoot = trustedSkill.workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const runtime: ConcreteAgentRuntime = trustedSkill.runtime || AgentRuntimeDetector.resolveEffectiveRuntime(
      this.configService?.getSettings().targetAgentRuntime,
      wsRoot
    );

    const adapter = AdapterFactory.getAdapter(runtime);
    await adapter.togglePluginState(trustedSkill.path, enabled, trustedSkill.scope, wsRoot);

    trustedSkill.enabled = enabled;
    return trustedSkill;
  }

  /**
   * 删除/卸载托管插件
   * 仅对 isManaged === true 的插件生效
   */
  public async deleteSkill(skill: LocalSkillItem): Promise<void> {
    const trustedSkill = await this.resolveManagedSkill(skill);
    if (!trustedSkill) {
      throw new Error('本地自建单体技能为只读项，请在本地磁盘中自行管理或删除文件');
    }
    if (trustedSkill.isNative) {
      throw new Error(`原生内置插件 "${trustedSkill.name}" 受系统保护，禁止删除`);
    }

    const wsRoot = trustedSkill.workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const runtime: ConcreteAgentRuntime = trustedSkill.runtime || AgentRuntimeDetector.resolveEffectiveRuntime(
      this.configService?.getSettings().targetAgentRuntime,
      wsRoot
    );

    const adapter = AdapterFactory.getAdapter(runtime);
    const paths = adapter.resolvePaths(trustedSkill.scope, wsRoot);
    const relative = path.relative(path.resolve(paths.activeRootDir), path.resolve(trustedSkill.path));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Refusing to delete a path outside the managed plugin root');
    }
    await adapter.deletePlugin(trustedSkill.path, trustedSkill.scope, wsRoot);
  }

  private async resolveManagedSkill(requested: LocalSkillItem): Promise<LocalSkillItem | null> {
    if (!requested?.path || !requested.runtime) return null;
    const candidates = await this.listLocalSkills(requested.runtime);
    const requestedPath = normalizePathKey(requested.path);
    return candidates.find((item) =>
      item.isManaged === true &&
      item.runtime === requested.runtime &&
      item.scope === requested.scope &&
      normalizePathKey(item.path) === requestedPath
    ) || null;
  }
}
