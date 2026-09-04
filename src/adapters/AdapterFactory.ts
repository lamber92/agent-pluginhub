import { ConcreteAgentRuntime } from '../types';
import { AntigravityAdapter } from './AntigravityAdapter';
import { IAgentRuntimeAdapter } from './IAgentRuntimeAdapter';
import { OpenCodeAdapter } from './OpenCodeAdapter';
import { CodexAdapter } from './CodexAdapter';

/**
 * 运行时适配器工厂 (Adapter Factory)
 * 统一分发与管理各 AI Agent 生态的单例适配器实例
 */
export class AdapterFactory {
  private static antigravityAdapter = new AntigravityAdapter();
  private static openCodeAdapter = new OpenCodeAdapter();
  private static codexAdapter = new CodexAdapter();

  /**
   * 根据目标具体运行时获取对应的适配器实例
   */
  public static getAdapter(runtime: ConcreteAgentRuntime): IAgentRuntimeAdapter {
    switch (runtime) {
      case 'antigravity':
        return this.antigravityAdapter;
      case 'opencode':
        return this.openCodeAdapter;
      case 'codex':
        return this.codexAdapter;
      default:
        return this.antigravityAdapter;
    }
  }

  /**
   * 获取所有支持的运行时适配器列表
   */
  public static getAllAdapters(): IAgentRuntimeAdapter[] {
    return [this.antigravityAdapter, this.openCodeAdapter, this.codexAdapter];
  }
}
