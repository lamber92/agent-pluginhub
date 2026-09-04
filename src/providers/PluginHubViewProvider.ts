import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { MessageBridge } from '../bridges/MessageBridge';

/**
 * PluginHub Webview 视图提供者
 * 支持「左侧轻量侧边栏（Sidebar）」与「主编辑区全屏集市（Editor Tab）」双模协同渲染
 */
export class PluginHubViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'agent-pluginhub-view';

  private static activePanel?: vscode.WebviewPanel;
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly messageBridge: MessageBridge
  ) {}

  /**
   * 初始化并解析侧边栏 Webview
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri,
        vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist'),
        vscode.Uri.joinPath(this._extensionUri, 'dist')
      ]
    };

    // 渲染侧边栏模式 HTML
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview, 'sidebar');
    const disposable = this.messageBridge.registerWebview(webviewView.webview);
    webviewView.onDidDispose(() => {
      disposable.dispose();
    });
  }

  /**
   * 在 VS Code 主编辑区打开或聚焦全屏插件集市面板
   * @param extensionUri 插件根目录 URI
   * @param messageBridge IPC 消息桥
   * @param targetTab 可选的目标激活 Tab ('discover' | 'installed' | 'settings')
   */
  public static openInEditor(extensionUri: vscode.Uri, messageBridge: MessageBridge, targetTab?: string) {
    // 若面板已存在，直接聚焦并广播切换 Tab
    if (PluginHubViewProvider.activePanel) {
      PluginHubViewProvider.activePanel.reveal(vscode.ViewColumn.One);
      if (targetTab) {
        messageBridge.broadcastEvent('tab:switch', { tab: targetTab });
      }
      return;
    }

    // 创建全新全屏主编辑区 Webview Panel
    const panel = vscode.window.createWebviewPanel(
      'pluginhubEditor',
      'PluginHub - AI Plugins & Skills',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true, // 后台切标签页保持前端状态不丢失
        localResourceRoots: [
          extensionUri,
          vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist'),
          vscode.Uri.joinPath(extensionUri, 'dist')
        ]
      }
    );

    PluginHubViewProvider.activePanel = panel;

    const provider = new PluginHubViewProvider(extensionUri, messageBridge);
    panel.webview.html = provider.getHtmlForWebview(panel.webview, 'editor');
    const disposable = messageBridge.registerWebview(panel.webview);

    if (targetTab) {
      setTimeout(() => {
        messageBridge.broadcastEvent('tab:switch', { tab: targetTab });
      }, 350);
    }

    panel.onDidDispose(() => {
      disposable.dispose();
      PluginHubViewProvider.activePanel = undefined;
    });
  }

  private getHtmlForWebview(webview: vscode.Webview, mode: 'sidebar' | 'editor'): string {
    const distPath = path.join(this._extensionUri.fsPath, 'webview-ui', 'dist');
    const indexPath = path.join(distPath, 'index.html');

    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf-8');
      const nonce = crypto.randomBytes(16).toString('base64');
      const csp = [
        `default-src 'none'`,
        `script-src 'nonce-${nonce}'`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `img-src ${webview.cspSource} https: data:`,
        `font-src ${webview.cspSource} data:`,
        `connect-src 'none'`
      ].join('; ');
      html = html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`);
      html = html.replace(/<script\b(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`);

      // Inject view mode script before head ends
      const modeScript = `<script nonce="${nonce}">window.__PLUGINHUB_VIEW_MODE__ = "${mode}";</script>`;
      html = html.replace('</head>', `${modeScript}\n</head>`);

      // Replace relative assets with webview URIs
      html = html.replace(/(src|href)="([^"]+)"/g, (_match, attr, assetPath) => {
        if (assetPath.startsWith('http://') || assetPath.startsWith('https://') || assetPath.startsWith('data:')) {
          return `${attr}="${assetPath}"`;
        }
        const cleanPath = assetPath.replace(/^\/+/, '');
        const assetUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, cleanPath)));
        return `${attr}="${assetUri.toString()}"`;
      });

      return html;
    }

    // Fallback development placeholder
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PluginHub</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 24px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      text-align: center;
    }
    .card {
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-widget-border, #333);
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .spinner {
      margin: 16px auto;
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255,255,255,0.2);
      border-radius: 50%;
      border-top-color: var(--vscode-button-background, #007acc);
      animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <h2>✨ PluginHub</h2>
  <div class="card">
    <div class="spinner"></div>
    <p>正在加载 Webview 界面，请确保已执行 <code>npm run build:ui</code> 构建前端资源...</p>
  </div>
</body>
</html>`;
  }
}
