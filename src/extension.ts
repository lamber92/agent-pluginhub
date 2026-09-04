import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { MessageBridge } from './bridges/MessageBridge';
import { PluginHubViewProvider } from './providers/PluginHubViewProvider';
import { ConfigService } from './services/ConfigService';
import { DownloadService } from './services/DownloadService';
import { LocalSkillService } from './services/LocalSkillService';
import { MarketplaceService } from './services/MarketplaceService';
import { McpService } from './services/McpService';

/**
 * PluginHub 插件主入口文件
 * 负责插件激活、核心单例服务初始化、IPC 消息总线装配、命令注册与全局/工作区双层文件变动监听
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('PluginHub extension is now activating...');

  // 1. 初始化核心业务服务实例 (单例模式)
  const configService = new ConfigService(context);
  await configService.initialize();
  const marketplaceService = new MarketplaceService(configService);
  const localSkillService = new LocalSkillService(context, configService);
  const downloadService = new DownloadService(configService);
  const mcpService = new McpService();

  // 2. 初始化前后端双向强类型 IPC 通信桥 (MessageBridge)
  const messageBridge = new MessageBridge(
    configService,
    marketplaceService,
    localSkillService,
    downloadService,
    mcpService
  );

  // 3. 注册活动栏左侧轻量侧边栏视图提供者 (Webview View Provider)
  const viewProvider = new PluginHubViewProvider(context.extensionUri, messageBridge);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PluginHubViewProvider.viewType, viewProvider)
  );

  // 4. 注册全屏主集市唤起命令 (主命令 pluginhub.open)
  const handleOpen = (targetTab?: string) => {
    PluginHubViewProvider.openInEditor(context.extensionUri, messageBridge, targetTab);
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('pluginhub.open', handleOpen)
  );

  // 5. 注册手动刷新缓存与插件状态命令 (主命令 pluginhub.refresh)
  const handleRefresh = async () => {
    await configService.clearCache();
    messageBridge.broadcastEvent('skills:changed', {});
    messageBridge.broadcastEvent('sources:changed', {});
    const isEn = configService.getLanguage() === 'en' || (typeof vscode.env.language === 'string' && vscode.env.language.startsWith('en'));
    vscode.window.showInformationMessage(isEn ? 'PluginHub plugins and sources refreshed' : 'PluginHub 插件与市场源已刷新');
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('pluginhub.refresh', handleRefresh)
  );

  // 6. 注册工作区文件变动监听器 (支持 Antigravity .agents 与 OpenCode .opencode)
  const workspaceWatcher = vscode.workspace.createFileSystemWatcher('**/{.agents,.opencode,.codex}/**/*.{md,json,disabled}');
  workspaceWatcher.onDidCreate(() => messageBridge.broadcastEvent('skills:changed', {}));
  workspaceWatcher.onDidChange(() => messageBridge.broadcastEvent('skills:changed', {}));
  workspaceWatcher.onDidDelete(() => messageBridge.broadcastEvent('skills:changed', {}));
  context.subscriptions.push(workspaceWatcher);

  // 7. 注册全局目录变动监听 (支持 ~/.gemini/config/plugins 与 ~/.config/opencode/skills)
  const globalDirsToWatch = [
    path.join(os.homedir(), '.gemini', 'config', 'plugins'),
    path.join(os.homedir(), '.config', 'opencode', 'skills'),
    path.join(os.homedir(), '.config', 'opencode', 'plugins'),
    path.join(os.homedir(), '.agents', 'skills'),
    path.join(os.homedir(), '.agents', 'plugins')
  ];

  let debounceTimer: NodeJS.Timeout | null = null;
  const triggerDebouncedSkillsChange = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      messageBridge.broadcastEvent('skills:changed', {});
    }, 300);
  };

  for (const globalDir of globalDirsToWatch) {
    try {
      if (!fs.existsSync(globalDir)) continue;
      const watcher = fs.watch(globalDir, { recursive: true }, () => {
        triggerDebouncedSkillsChange();
      });
      context.subscriptions.push({
        dispose: () => {
          try {
            watcher.close();
          } catch {}
        }
      });
    } catch (err) {
      console.warn(`[PluginHub] Could not watch global directory ${globalDir}:`, err);
    }
  }

  // 8. 窗口聚焦自动静默轻量对齐 (CLI 操作切回 IDE 时自动刷新)
  const windowStateWatcher = vscode.window.onDidChangeWindowState((state) => {
    if (state.focused) {
      triggerDebouncedSkillsChange();
    }
  });
  context.subscriptions.push(windowStateWatcher);

  console.log('PluginHub extension activated successfully.');
}

/**
 * 插件停用清理回调
 */
export function deactivate() {
  console.log('PluginHub extension deactivated.');
}
