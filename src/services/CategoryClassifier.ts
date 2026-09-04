import { MarketplacePlugin } from '../types';

/**
 * 智能分类特征推断引擎
 * 采用 100% 本地确定性关键词特征匹配，零 LLM 依赖、零 Token 消耗、零网络延迟
 */
export class CategoryClassifier {
  /**
   * 根据 Plugin 的名称、描述与标签多维特征，自动推断所属标准分类
   * @param plugin 插件元数据对象
   * @returns 标准分类键名 ('development' | 'data' | 'devops' | 'security' | 'productivity' | 'general')
   */
  public static inferCategory(plugin: Partial<MarketplacePlugin>): string {
    const text = `${plugin.name || ''} ${plugin.description || ''} ${(plugin.tags || []).join(' ')}`.toLowerCase();

    // 1. 开发与调试
    if (text.includes('test') || text.includes('debug') || text.includes('code') || text.includes('git') || text.includes('lint')) {
      return 'development';
    }
    // 2. 数据与数据库
    if (text.includes('data') || text.includes('sql') || text.includes('db') || text.includes('postgres') || text.includes('mongo')) {
      return 'data';
    }
    // 3. 运维与容器
    if (text.includes('docker') || text.includes('k8s') || text.includes('aws') || text.includes('cloud') || text.includes('deploy')) {
      return 'devops';
    }
    // 4. 安全与合规
    if (text.includes('security') || text.includes('auth') || text.includes('audit') || text.includes('vuln')) {
      return 'security';
    }
    // 5. 生产力提升
    if (text.includes('doc') || text.includes('note') || text.includes('search') || text.includes('chat') || text.includes('summary')) {
      return 'productivity';
    }
    // 6. 兜底通用分类
    return 'general';
  }
}
