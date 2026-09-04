import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigService } from '../services/ConfigService';
import { DownloadService } from '../services/DownloadService';
import { LocalSkillService } from '../services/LocalSkillService';
import { MarketplaceService } from '../services/MarketplaceService';
import { McpService } from '../services/McpService';
import { RuntimePathResolver } from '../services/RuntimePathResolver';
import { AgentRuntimeDetector } from '../services/AgentRuntimeDetector';
import { AdapterFactory } from '../adapters/AdapterFactory';
import {
  BridgeEvent,
  BridgeRequest,
  BridgeResponse,
  ConcreteAgentRuntime,
  InstallSkillOptions,
  LocalSkillItem,
  MarketplacePlugin,
  MarketplaceSourceConfig,
  TargetAgentRuntime,
  UserSettings
} from '../types';

/**
 * 前后端 IPC 强类型通信总线 (MessageBridge)
 * 负责接收 Webview 发送的指令并分发到具体服务，同时支持向所有活动视图广播全局事件
 */
export class MessageBridge {
  private webviews: Set<vscode.Webview> = new Set();

  constructor(
    private configService: ConfigService,
    private marketplaceService: MarketplaceService,
    private localSkillService: LocalSkillService,
    private downloadService: DownloadService,
    private mcpService: McpService
  ) {}

  private get isEnglish(): boolean {
    return (
      this.configService.getLanguage() === 'en' ||
      (typeof vscode.env.language === 'string' && vscode.env.language.startsWith('en'))
    );
  }

  private resolveWorkspaceFolder(requested?: string): string | undefined {
    const folders = vscode.workspace.workspaceFolders || [];
    if (!requested) return folders[0]?.uri.fsPath;
    const requestedKey = path.resolve(requested).toLowerCase();
    const match = folders.find((folder) => path.resolve(folder.uri.fsPath).toLowerCase() === requestedKey);
    if (!match) throw new Error('Target workspace folder is not part of the current VS Code workspace');
    return match.uri.fsPath;
  }

  /**
   * 注册 Webview 实例以监听其双向 IPC 消息
   * @param webview VS Code Webview 实例
   */
  public registerWebview(webview: vscode.Webview): vscode.Disposable {
    this.webviews.add(webview);

    const messageListener = webview.onDidReceiveMessage(async (message: BridgeRequest) => {
      try {
        const responseData = await this.handleMessage(message.action, message.payload);
        const response: BridgeResponse = {
          id: message.id,
          success: true,
          data: responseData
        };
        this.safePostMessage(webview, response);
      } catch (err: any) {
        console.error(`Bridge error for action [${message.action}]:`, err);
        const errorMsg = err?.message || '未知错误';
        const isEn = this.isEnglish;

        // 操作失败时直接弹出 VS Code 宿主错误通知弹窗，确保用户第一时间看到具体失败原因
        if (message.action === 'installSkill') {
          const pluginName = message.payload?.pluginName || message.payload?.skillName || (isEn ? 'Plugin' : '插件');
          vscode.window.showErrorMessage(isEn ? `Failed to install/download plugin "${pluginName}": ${errorMsg}` : `插件 "${pluginName}" 安装/下载失败: ${errorMsg}`);
        } else if (message.action === 'deleteSkill') {
          const pluginName = message.payload?.skill?.name || (isEn ? 'Plugin' : '插件');
          vscode.window.showErrorMessage(isEn ? `Failed to uninstall plugin "${pluginName}": ${errorMsg}` : `插件 "${pluginName}" 卸载失败: ${errorMsg}`);
        } else if (message.action === 'toggleSkillState') {
          const pluginName = message.payload?.skill?.name || (isEn ? 'Plugin' : '插件');
          vscode.window.showErrorMessage(isEn ? `Failed to toggle plugin "${pluginName}": ${errorMsg}` : `插件 "${pluginName}" 启停切换失败: ${errorMsg}`);
        }

        const response: BridgeResponse = {
          id: message.id,
          success: false,
          error: errorMsg
        };
        this.safePostMessage(webview, response);
      }
    });

    return {
      dispose: () => {
        messageListener.dispose();
        this.webviews.delete(webview);
      }
    };
  }

  /**
   * 向所有注册并处于活跃状态的 Webview 广播全局异步事件（如 skills:changed、sources:changed、tab:switch）
   */
  public broadcastEvent<T>(eventName: string, data: T) {
    const event: BridgeEvent<T> = {
      event: eventName,
      data
    };
    for (const webview of this.webviews) {
      this.safePostMessage(webview, event);
    }
  }

  /**
   * 安全地向 Webview 发送消息，对无法序列化的深层对象进行安全脱敏
   */
  private safePostMessage(webview: vscode.Webview, message: any) {
    try {
      const sanitized = JSON.parse(JSON.stringify(message));
      webview.postMessage(sanitized);
    } catch (e) {
      console.error('Failed to postMessage to webview:', e);
    }
  }

  /**
   * 核心 IPC 请求分发路由器
   */
  private async handleMessage(action: string, payload: any): Promise<any> {
    switch (action) {
      // Marketplace
      case 'getMarketplacePlugins': {
        const { sourceId, forceRefresh } = (payload || {}) as { sourceId?: string; forceRefresh?: boolean };
        return await this.marketplaceService.fetchMarketplace(sourceId, forceRefresh);
      }

      case 'getSkillDetail': {
        const { plugin, skillSubPath, skillPath } = (payload || {}) as {
          plugin?: MarketplacePlugin;
          skillSubPath?: string;
          skillPath?: string;
        };
        if (skillPath && fs.existsSync(skillPath) && await this.localSkillService.findLocalSkillByPath(skillPath)) {
          return await this.marketplaceService.fetchLocalSkillDetail(skillPath);
        }
        if (plugin) {
          return await this.marketplaceService.fetchSkillDetail(plugin, skillSubPath);
        }
        throw new Error('Missing plugin or skillPath for getSkillDetail');
      }

      // Local Skills & Plugins
      case 'getLocalSkills': {
        const { targetRuntime } = (payload || {}) as { targetRuntime?: TargetAgentRuntime };
        return await this.localSkillService.listLocalSkills(targetRuntime);
      }

      case 'toggleSkillState': {
        const { skill, enabled } = payload as { skill: LocalSkillItem; enabled: boolean };
        await this.localSkillService.toggleSkillState(skill, enabled);
        this.broadcastEvent('skills:changed', {});
        const isEn = this.isEnglish;
        vscode.window.showInformationMessage(
          isEn
            ? `Plugin "${skill.name}" ${enabled ? 'enabled' : 'disabled'} (takes effect after opening a new session or restarting client)`
            : `插件 "${skill.name}" 已${enabled ? '启用' : '禁用'}（开启新对话或重启客户端后生效）`
        );
        return { success: true };
      }

      case 'deleteSkill': {
        const { skill } = payload as { skill: LocalSkillItem };
        const trustedSkill = await this.localSkillService.findLocalSkillByPath(skill.path);
        if (!trustedSkill || !trustedSkill.runtime || trustedSkill.scope !== skill.scope) {
          throw new Error('Plugin is not a currently managed installation');
        }
        const trustedAdapter = AdapterFactory.getAdapter(trustedSkill.runtime);
        const metadata = trustedAdapter.readPluginhubMetadata(trustedSkill.path);
        if (metadata?.mcpServers?.length) {
          this.mcpService.removeMcpServers(
            metadata.mcpServers,
            trustedSkill.scope,
            trustedSkill.runtime,
            trustedSkill.workspacePath,
            metadata.mcpPrevious
          );
        }
        await this.localSkillService.deleteSkill(trustedSkill);
        this.broadcastEvent('skills:changed', {});
        const isEn = this.isEnglish;
        vscode.window.showInformationMessage(
          isEn
            ? `Plugin "${skill.name}" uninstalled successfully (takes effect after opening a new session or restarting client)`
            : `插件 "${skill.name}" 已成功卸载（开启新对话或重启客户端后生效）`
        );
        return { success: true };
      }

      // Install & Download
      case 'installSkill': {
        const options = payload as InstallSkillOptions;
        if (!options || !['workspace', 'agent', 'global'].includes(options.scope)) {
          throw new Error('Invalid installation scope');
        }
        const wsFolder = this.resolveWorkspaceFolder(options.targetWorkspaceFolder);

        if (options.scope === 'workspace' && !wsFolder) {
          throw new Error('未打开工作区，无法安装到 Workspace');
        }

        const effectiveRuntime: ConcreteAgentRuntime = AgentRuntimeDetector.resolveEffectiveRuntime(
          options.targetAgentRuntime,
          wsFolder
        );

        const pluginName = options.pluginName || options.skillName || 'unnamed-plugin';
        const marketplaceName = options.sourceName || 'default';
        const version = options.version || '1.0.0';
        const resolved = RuntimePathResolver.resolve(
          pluginName,
          options.scope,
          wsFolder,
          effectiveRuntime,
          marketplaceName,
          version
        );
        const targetDir = resolved.pluginDir;
        const runtimeAdapter = AdapterFactory.getAdapter(effectiveRuntime);
        const previousMetadata = runtimeAdapter.readPluginhubMetadata(targetDir);

        const result = await this.downloadService.installSkill(targetDir, {
          ...options,
          pluginName,
          targetAgentRuntime: effectiveRuntime,
          overwrite: true
        });

        // 自动合并配套 MCP 服务器配置
        if (options.installMcp) {
          const downloadedMcp = path.join(targetDir, effectiveRuntime === 'antigravity' ? 'mcp_config.json' : 'mcp.json');
          const legacyMcp = path.join(targetDir, '.mcp.json');
          const mcpFile = fs.existsSync(downloadedMcp) ? downloadedMcp : fs.existsSync(legacyMcp) ? legacyMcp : null;
          if (mcpFile) {
              const mcpJson = JSON.parse(fs.readFileSync(mcpFile, 'utf-8'));
              const mergedMcp = this.mcpService.mergeMcpServers(
                 mcpJson,
                options.scope,
                effectiveRuntime,
                wsFolder,
                options.mcpEnv
              );
              for (const name of mergedMcp.names) {
                if (previousMetadata?.mcpServers?.includes(name) && previousMetadata.mcpPrevious?.[name]) {
                  mergedMcp.previous[name] = previousMetadata.mcpPrevious[name];
                }
              }
              const removedNames = (previousMetadata?.mcpServers || []).filter((name) => !mergedMcp.names.includes(name));
              if (removedNames.length > 0) {
                this.mcpService.removeMcpServers(
                  removedNames,
                  options.scope,
                  effectiveRuntime,
                  wsFolder,
                  previousMetadata?.mcpPrevious
                );
              }
              const metadata = runtimeAdapter.readPluginhubMetadata(targetDir);
              if (metadata) {
                metadata.mcpServers = mergedMcp.names;
                metadata.mcpPrevious = mergedMcp.previous;
                runtimeAdapter.writePluginhubMetadata(targetDir, metadata);
              }
          } else if (previousMetadata?.mcpServers?.length) {
            this.mcpService.removeMcpServers(
              previousMetadata.mcpServers,
              options.scope,
              effectiveRuntime,
              wsFolder,
              previousMetadata.mcpPrevious
            );
          }
        } else if (previousMetadata?.mcpServers?.length) {
          this.mcpService.removeMcpServers(
            previousMetadata.mcpServers,
            options.scope,
            effectiveRuntime,
            wsFolder,
            previousMetadata.mcpPrevious
          );
        }

        this.broadcastEvent('skills:changed', {});
        const isEn = this.isEnglish;
        vscode.window.showInformationMessage(
          isEn
            ? `Plugin "${pluginName}" installed/updated successfully (takes effect after opening a new session or restarting client)`
            : `插件 "${pluginName}" 安装/更新成功（开启新对话或重启客户端后生效）`
        );
        return result;
      }

      // Sources & Settings
      case 'getSources': {
        return this.configService.getSources();
      }

      case 'addOrUpdateSource': {
        await this.configService.addOrUpdateSource(payload as MarketplaceSourceConfig);
        this.broadcastEvent('sources:changed', {});
        return { success: true };
      }

      case 'removeSource': {
        await this.configService.removeSource(payload.sourceId);
        this.broadcastEvent('sources:changed', {});
        return { success: true };
      }

      case 'toggleSource': {
        const { sourceId, enabled } = payload as { sourceId: string; enabled: boolean };
        await this.configService.toggleSource(sourceId, enabled);
        this.broadcastEvent('sources:changed', {});
        return { success: true };
      }

      case 'getSettings': {
        const settings = this.configService.getSettings();
        const detectedRuntime = AgentRuntimeDetector.detectCurrentRuntime();
        return {
          ...settings,
          detectedRuntime
        };
      }

      case 'getRuntimeInfo': {
        const detectedRuntime = AgentRuntimeDetector.detectCurrentRuntime();
        const settings = this.configService.getSettings();
        const configuredRuntime = settings.targetAgentRuntime || 'auto';
        const effectiveRuntime = AgentRuntimeDetector.resolveEffectiveRuntime(configuredRuntime);
        const antigravityGlobalPath = RuntimePathResolver.getAgentPluginsDir('antigravity');
        const opencodeGlobalPath = RuntimePathResolver.getAgentPluginsDir('opencode');
        const codexGlobalPath = RuntimePathResolver.getGlobalPluginsDir();
        return {
          detectedRuntime,
          configuredRuntime,
          effectiveRuntime,
          antigravityGlobalPath,
          opencodeGlobalPath,
          codexGlobalPath
        };
      }

      case 'saveSettings':
        case 'updateSettings': {
          const updatePayload = ((payload && (payload as any).settings) ? (payload as any).settings : payload) as Partial<UserSettings>;
          await this.configService.updateSettings(updatePayload);
          const currentSettings = this.configService.getSettings();
          const detectedRuntime = AgentRuntimeDetector.detectCurrentRuntime();
          this.broadcastEvent('settings:changed', { ...currentSettings, detectedRuntime });
          this.broadcastEvent('skills:changed', {});
          return { success: true, settings: { ...currentSettings, detectedRuntime } };
        }

      case 'getLanguage': {
        return { lang: this.configService.getLanguage() };
      }

      case 'setLanguage': {
        const { lang } = payload as { lang: 'zh' | 'en' };
        if (lang === 'zh' || lang === 'en') {
          await this.configService.setLanguage(lang);
          this.broadcastEvent('lang:changed', { lang });
        }
        return { success: true };
      }

      case 'getWorkspaceFolders': {
        return this.configService.getWorkspaceFolders();
      }

      // ZIP Import / Export
      case 'exportSkillZip': {
        const { skillPath, skillName, defaultName } = (payload || {}) as {
          skillPath: string;
          skillName?: string;
          defaultName?: string;
        };
        const baseName = skillName || defaultName || path.basename(skillPath) || 'skill';
        const exportSkill = await this.localSkillService.findLocalSkillByPath(skillPath);
        if (!exportSkill) throw new Error('Only installed PluginHub entries can be exported');

        let defaultDir: string;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          defaultDir = workspaceFolders[0].uri.fsPath;
        } else {
          defaultDir = path.join(os.homedir(), 'Desktop');
          if (!fs.existsSync(defaultDir)) {
            defaultDir = os.homedir();
          }
        }

        const defaultSavePath = path.join(defaultDir, `${baseName}.zip`);
        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(defaultSavePath),
          filters: { 'Zip Archive (*.zip)': ['zip'] },
          title: `导出 "${baseName}" 为离线 Zip 包`
        });
        if (saveUri) {
          this.downloadService.exportSkillToZip(skillPath, saveUri.fsPath);
          const isEn = this.isEnglish;
          vscode.window.showInformationMessage(
            isEn
              ? `Plugin "${baseName}" offline package exported to: ${saveUri.fsPath}`
              : `插件 "${baseName}" 离线包已导出至: ${saveUri.fsPath}`
          );
          return { exportedPath: saveUri.fsPath };
        }
        return { cancelled: true };
      }

      case 'importSkillZip': {
        const { scope, targetWorkspaceFolder, targetAgentRuntime } = payload as {
          scope: 'workspace' | 'global';
          targetWorkspaceFolder?: string;
          targetAgentRuntime?: TargetAgentRuntime;
        };
        const fileUris = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: { 'Zip Files': ['zip'] },
          title: this.isEnglish ? 'Select Plugin Offline Zip Package to Import' : '选择要导入的插件离线 Zip 包'
        });

        if (!fileUris || fileUris.length === 0) {
          return { cancelled: true };
        }

        const zipPath = fileUris[0].fsPath;
        const zipBaseName = path.basename(zipPath, '.zip');
        const wsFolder = this.resolveWorkspaceFolder(targetWorkspaceFolder);

        if (scope === 'workspace' && !wsFolder) {
          throw new Error(this.isEnglish ? 'No workspace folder opened' : '未打开工作区');
        }

        const effectiveRuntime: ConcreteAgentRuntime = AgentRuntimeDetector.resolveEffectiveRuntime(
          targetAgentRuntime,
          wsFolder
        );

        const resolved = RuntimePathResolver.resolve(zipBaseName, scope, wsFolder, effectiveRuntime);
        const targetDir = resolved.pluginDir;

        const result = this.downloadService.importSkillFromZip(zipPath, targetDir);
        this.broadcastEvent('skills:changed', {});
        const isEn = this.isEnglish;
        vscode.window.showInformationMessage(
          isEn
            ? `Plugin "${result.skillName}" offline package imported successfully (takes effect after opening a new session or restarting client)`
            : `插件 "${result.skillName}" 离线包导入成功（开启新对话或重启客户端后生效）`
        );
        return result;
      }

      // Utilities
      case 'openInOS':
      case 'openPath': {
        const targetPath = (payload?.path || payload?.filePath) as string;
        if (!targetPath) return { success: false };
        let actualPath = targetPath;
        if (!fs.existsSync(actualPath) && fs.existsSync(`${targetPath}.disabled`)) {
          actualPath = `${targetPath}.disabled`;
        }
        const uri = vscode.Uri.file(actualPath);
        await vscode.commands.executeCommand('revealFileInOS', uri);
        return { success: true };
      }

      case 'openInEditor': {
        try {
          const targetPath = (payload?.filePath || payload?.path) as string;
          if (!targetPath) return { success: false };
          let actualPath = path.normalize(targetPath);

          if (!fs.existsSync(actualPath) && fs.existsSync(`${actualPath}.disabled`)) {
            actualPath = `${actualPath}.disabled`;
          }

          // If path is a folder, try to find SKILL.md or README.md inside it
          if (fs.existsSync(actualPath) && fs.statSync(actualPath).isDirectory()) {
            const candidates = ['SKILL.md', 'README.md', 'skill.md', 'readme.md', 'package.json'];
            for (const f of candidates) {
              const p = path.join(actualPath, f);
              if (fs.existsSync(p)) {
                actualPath = p;
                break;
              }
            }
          }

          if (!fs.existsSync(actualPath)) {
            vscode.window.showWarningMessage(`目标文件不存在: ${actualPath}`);
            return { success: false, error: 'File not found' };
          }

          const uri = vscode.Uri.file(actualPath);
          if (actualPath.toLowerCase().endsWith('.md')) {
            try {
              await vscode.commands.executeCommand('markdown.showPreview', uri);
              return { success: true };
            } catch {
              // Fallback to text document if markdown preview command fails
            }
          }

          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, {
            preview: false,
            preserveFocus: false
          });
          return { success: true };
        } catch (err: any) {
          console.error('[PluginHub] Failed to open in editor:', err);
          vscode.window.showErrorMessage(`无法在编辑器中打开文件: ${err?.message || err}`);
          return { success: false, error: String(err) };
        }
      }

      case 'openFullMarketplace': {
        const { targetTab } = payload || {};
        await vscode.commands.executeCommand('pluginhub.open', targetTab);
        return { success: true };
      }

      case 'openExternal': {
        const value = String(payload?.url || '');
        const url = new URL(value);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          throw new Error('Only HTTP(S) external links are allowed');
        }
        await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
        return { success: true };
      }

      default:
        throw new Error(`Unknown bridge action: ${action}`);
    }
  }
}
