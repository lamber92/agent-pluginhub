import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConcreteAgentRuntime, TargetAgentRuntime } from '../types';

/**
 * AI Agent 运行环境级联智能探测引擎
 * 职责：
 * 1. 宿主 IDE 品牌探测 (最高优先级)
 * 2. VS Code 已安装扩展探测
 * 3. 工作区特征目录探测 (.agents / .codex / .opencode)
 * 4. 全局已有插件生态探测 (~/.gemini vs ~/.codex vs ~/.config/opencode)
 * 5. 默认安全回退 (Antigravity / OpenCode)
 */
export class AgentRuntimeDetector {
  /**
   * 自动探测当前宿主与工作区环境匹配的 AI Agent 运行时
   * @param workspaceRoot 可选的特定工作区根路径（支持多根工作区按文件夹精准感知）
   */
  public static detectCurrentRuntime(workspaceRoot?: string): ConcreteAgentRuntime {
    const appName = (vscode.env.appName || '').toLowerCase();

    // 1. 宿主 IDE 品牌特征探测 (最高优先级)
    if (appName.includes('antigravity') || appName.includes('gemini')) {
      return 'antigravity';
    }
    if (appName.includes('codex') || appName.includes('openai')) {
      return 'codex';
    }
    if (appName.includes('opencode')) {
      return 'opencode';
    }

    // 2. VS Code 已安装扩展探测
    const codexExtensions = [
      'openai.codex',
      'openai.chatgpt',
      'openai.openai-codex'
    ];
    for (const extId of codexExtensions) {
      if (vscode.extensions.getExtension(extId)) {
        return 'codex';
      }
    }

    const opencodeExtensions = [
      'opencode.opencode',
      'opencode-ai.opencode',
      'opencode-ide.opencode'
    ];
    for (const extId of opencodeExtensions) {
      if (vscode.extensions.getExtension(extId)) {
        return 'opencode';
      }
    }

    // 3. 当前工作区特征目录探测
    const checkDir = (dir: string): ConcreteAgentRuntime | null => {
      if (fs.existsSync(path.join(dir, '.agents'))) return 'antigravity';
      if (fs.existsSync(path.join(dir, '.codex')) || fs.existsSync(path.join(dir, '.openai'))) return 'codex';
      if (fs.existsSync(path.join(dir, '.opencode'))) return 'opencode';
      return null;
    };

    if (workspaceRoot) {
      const match = checkDir(workspaceRoot);
      if (match) return match;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      for (const folder of workspaceFolders) {
        const match = checkDir(folder.uri.fsPath);
        if (match) return match;
      }
    }

    // 4. 全局已有插件生态特征探测 (检查用户家目录下是否有已有生态的插件)
    try {
      const home = os.homedir();
      const agGlobal = path.join(home, '.gemini', 'config', 'plugins');
      const ocGlobal = path.join(home, '.config', 'opencode', 'plugins');
      const cxGlobal = path.join(home, '.agents', 'plugins');

      const hasAg = fs.existsSync(agGlobal) && fs.readdirSync(agGlobal).filter((f) => !f.startsWith('.')).length > 0;
      const hasOc = fs.existsSync(ocGlobal) && fs.readdirSync(ocGlobal).filter((f) => !f.startsWith('.')).length > 0;
      const hasCx = fs.existsSync(cxGlobal) && fs.readdirSync(cxGlobal).filter((f) => !f.startsWith('.')).length > 0;

      if (hasCx && !hasAg && !hasOc) return 'codex';
      if (hasAg && !hasOc && !hasCx) return 'antigravity';
      if (hasOc && !hasAg && !hasCx) return 'opencode';
    } catch {}

    // 5. 默认回退：在标准 VS Code 纯净环境下默认采用 Antigravity
    return 'antigravity';
  }

  /**
   * 综合用户偏好配置与自动探测，解析出最终生效的具体运行时
   */
  public static resolveEffectiveRuntime(
    configuredRuntime?: TargetAgentRuntime,
    workspaceRoot?: string
  ): ConcreteAgentRuntime {
    if (configuredRuntime && configuredRuntime !== 'auto') {
      return configuredRuntime;
    }
    return this.detectCurrentRuntime(workspaceRoot);
  }
}
