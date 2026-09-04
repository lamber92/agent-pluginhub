import * as vscode from 'vscode';
import { MarketplaceSourceConfig, TargetAgentRuntime, UserSettings, WorkspaceFolderInfo } from '../types';
import { AgentRuntimeDetector } from './AgentRuntimeDetector';
import { HttpClient } from '../utils/HttpClient';

/**
 * 统一配置与缓存管理服务
 * 负责 VS Code WorkspaceConfiguration、持久化市场源与多助手运行环境配置
 */
export class ConfigService {
  private static readonly SOURCES_KEY = 'pluginhub_marketplace_sources';
  private static readonly CACHE_KEY = 'pluginhub_marketplace_cache';
  private static readonly LANG_KEY = 'pluginhub_language';

  private static readonly RUNTIME_KEY = 'pluginhub_target_agent_runtime';
  private static readonly GITHUB_TOKEN_SECRET = 'pluginhub.githubToken';
  private static readonly SOURCE_TOKEN_PREFIX = 'pluginhub.sourceToken.';

  private githubToken = '';
  private sourceTokens = new Map<string, string>();

  constructor(private context: vscode.ExtensionContext) {}

  public async initialize(): Promise<void> {
    const config = vscode.workspace.getConfiguration('pluginhub');
    HttpClient.setProxyUrl(config.get<string>('proxyUrl', ''));
    const legacyToken = config.get<string>('githubToken', '');
    this.githubToken = (await this.context.secrets.get(ConfigService.GITHUB_TOKEN_SECRET)) || legacyToken;
    if (legacyToken) {
      await this.context.secrets.store(ConfigService.GITHUB_TOKEN_SECRET, legacyToken);
      await config.update('githubToken', undefined, vscode.ConfigurationTarget.Global);
    }

    const saved = this.context.globalState.get<MarketplaceSourceConfig[]>(ConfigService.SOURCES_KEY) || [];
    let needsMigration = false;
    for (const source of saved) {
      const secretKey = `${ConfigService.SOURCE_TOKEN_PREFIX}${source.id}`;
      const token = (await this.context.secrets.get(secretKey)) || source.token;
      if (token) {
        this.sourceTokens.set(source.id, token);
        if (source.token) {
          await this.context.secrets.store(secretKey, token);
          needsMigration = true;
        }
      }
    }
    if (needsMigration) {
      await this.context.globalState.update(
        ConfigService.SOURCES_KEY,
        saved.map(({ token: _token, ...source }) => source)
      );
    }
  }

  public getLanguage(): 'zh' | 'en' {
    return this.context.globalState.get<'zh' | 'en'>(ConfigService.LANG_KEY) || 'zh';
  }

  public async setLanguage(lang: 'zh' | 'en'): Promise<void> {
    await this.context.globalState.update(ConfigService.LANG_KEY, lang);
  }

  public getSettings(includeSecrets = false): UserSettings {
    const config = vscode.workspace.getConfiguration('pluginhub');
    const runtimeFromGlobal = this.context.globalState.get<TargetAgentRuntime>(ConfigService.RUNTIME_KEY);
    const targetAgentRuntime: TargetAgentRuntime = runtimeFromGlobal || config.get<TargetAgentRuntime>('targetAgentRuntime', 'auto') || 'auto';

    return {
      githubToken: includeSecrets ? this.githubToken : '',
      hasGithubToken: !!this.githubToken,
      mirrorAcceleration: config.get<boolean>('mirrorAcceleration', true),
      proxyUrl: config.get<string>('proxyUrl', ''),
      defaultInstallScope: config.get<'ask' | 'workspace' | 'global'>('defaultInstallScope', 'ask'),
      targetAgentRuntime,
      detectedRuntime: AgentRuntimeDetector.detectCurrentRuntime()
    };
  }

  public async updateSettings(settings: Partial<UserSettings>): Promise<void> {
    const config = vscode.workspace.getConfiguration('pluginhub');
    if (settings.githubToken !== undefined) {
      this.githubToken = settings.githubToken;
      if (settings.githubToken) {
        await this.context.secrets.store(ConfigService.GITHUB_TOKEN_SECRET, settings.githubToken);
      } else {
        await this.context.secrets.delete(ConfigService.GITHUB_TOKEN_SECRET);
      }
      await config.update('githubToken', undefined, vscode.ConfigurationTarget.Global);
    }
    if (settings.mirrorAcceleration !== undefined) {
      await config.update('mirrorAcceleration', settings.mirrorAcceleration, vscode.ConfigurationTarget.Global);
    }
    if (settings.proxyUrl !== undefined) {
      HttpClient.setProxyUrl(settings.proxyUrl);
      await config.update('proxyUrl', settings.proxyUrl, vscode.ConfigurationTarget.Global);
    }
    if (settings.defaultInstallScope !== undefined) {
      await config.update('defaultInstallScope', settings.defaultInstallScope, vscode.ConfigurationTarget.Global);
    }
    if (settings.targetAgentRuntime !== undefined) {
      await this.context.globalState.update(ConfigService.RUNTIME_KEY, settings.targetAgentRuntime);
      try {
        await config.update('targetAgentRuntime', settings.targetAgentRuntime, vscode.ConfigurationTarget.Global);
      } catch (e) {
        console.warn('config.update targetAgentRuntime fallback to globalState:', e);
      }
    }
  }

  public getSources(includeSecrets = false): MarketplaceSourceConfig[] {
    const saved = this.context.globalState.get<MarketplaceSourceConfig[]>(ConfigService.SOURCES_KEY);
    if (saved && saved.length > 0) {
      return saved.map((source) => ({
        ...source,
        token: includeSecrets ? this.sourceTokens.get(source.id) : undefined
      }));
    }

    // Default Official Source
    const defaultSource: MarketplaceSourceConfig = {
      id: 'official-claude-plugins',
      name: 'Anthropic Official Marketplace',
      type: 'official',
      location: 'anthropics/claude-plugins-official',
      branch: 'main',
      enabled: true,
      isDefault: true
    };
    return [defaultSource];
  }

  public async saveSources(sources: MarketplaceSourceConfig[]): Promise<void> {
    await this.context.globalState.update(
      ConfigService.SOURCES_KEY,
      sources.map(({ token: _token, ...source }) => source)
    );
  }

  public async addOrUpdateSource(source: MarketplaceSourceConfig): Promise<void> {
    const sources = this.getSources();
    if (source.token !== undefined) {
      const secretKey = `${ConfigService.SOURCE_TOKEN_PREFIX}${source.id}`;
      if (source.token) {
        this.sourceTokens.set(source.id, source.token);
        await this.context.secrets.store(secretKey, source.token);
      } else {
        this.sourceTokens.delete(source.id);
        await this.context.secrets.delete(secretKey);
      }
    }
    const sourceWithoutToken = { ...source, token: undefined };
    const existingIndex = sources.findIndex((s) => s.id === source.id);
    if (existingIndex >= 0) {
      sources[existingIndex] = { ...sources[existingIndex], ...sourceWithoutToken };
    } else {
      sources.push(sourceWithoutToken);
    }
    await this.saveSources(sources);
  }

  public async removeSource(sourceId: string): Promise<void> {
    const sources = this.getSources().filter((s) => s.id !== sourceId);
    await this.saveSources(sources);
    this.sourceTokens.delete(sourceId);
    await this.context.secrets.delete(`${ConfigService.SOURCE_TOKEN_PREFIX}${sourceId}`);
  }

  public async toggleSource(sourceId: string, enabled: boolean): Promise<void> {
    const sources = this.getSources().map((s) => {
      if (s.id === sourceId) {
        return { ...s, enabled };
      }
      return s;
    });
    await this.saveSources(sources);
  }

  public getCachedData<T>(key: string): { data: T; timestamp: number } | null {
    const cache = this.context.globalState.get<{ [key: string]: { data: T; timestamp: number } }>(ConfigService.CACHE_KEY) || {};
    return cache[key] || null;
  }

  public async setCachedData<T>(key: string, data: T): Promise<void> {
    const cache = this.context.globalState.get<{ [key: string]: { data: T; timestamp: number } }>(ConfigService.CACHE_KEY) || {};
    cache[key] = { data, timestamp: Date.now() };
    await this.context.globalState.update(ConfigService.CACHE_KEY, cache);
  }

  public async clearCache(): Promise<void> {
    await this.context.globalState.update(ConfigService.CACHE_KEY, {});
  }

  public getWorkspaceFolders(): WorkspaceFolderInfo[] {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return [];
    return folders.map((f) => ({
      name: f.name,
      path: f.uri.fsPath
    }));
  }
}
