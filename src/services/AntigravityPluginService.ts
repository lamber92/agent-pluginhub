import { AntigravityAdapter, computeGitBlobSha } from '../adapters/AntigravityAdapter';
import { AntigravityPluginJson, LocalSkillItem, PluginhubMetadata } from '../types';

export { computeGitBlobSha };

/**
 * AntigravityPluginService 向后兼容代理门面 (Forwarding to AntigravityAdapter)
 */
export class AntigravityPluginService {
  private static adapter = new AntigravityAdapter();
  public static readonly OFFICIAL_SCHEMA = AntigravityAdapter.OFFICIAL_SCHEMA;

  public static ensureStandardPluginJson(
    pluginDir: string,
    name: string,
    description?: string,
    extra?: Partial<AntigravityPluginJson>
  ): void {
    this.adapter.ensurePluginManifest(pluginDir, name, description, extra);
  }

  public static writePluginhubMetadata(pluginDir: string, meta: PluginhubMetadata): void {
    this.adapter.writePluginhubMetadata(pluginDir, meta);
  }

  public static readPluginhubMetadata(dirPath: string): PluginhubMetadata | null {
    return this.adapter.readPluginhubMetadata(dirPath);
  }

  public static readPluginJson(dirPath: string): AntigravityPluginJson | null {
    return this.adapter.readPluginJson(dirPath);
  }

  public static scanPluginsDirectory(
    pluginsDir: string,
    scope: 'workspace' | 'global',
    workspaceName?: string,
    workspacePath?: string
  ): LocalSkillItem[] {
    return this.adapter.scanPluginsDirectory(pluginsDir, scope, workspaceName, workspacePath);
  }

  public static scanSkillsDirectory(
    skillsDir: string,
    scope: 'workspace' | 'global',
    workspaceName?: string,
    workspacePath?: string
  ): LocalSkillItem[] {
    return this.adapter.scanSkillsDirectory(skillsDir, scope, workspaceName, workspacePath);
  }

  public static async togglePluginState(
    pluginPath: string,
    enabled: boolean,
    scope: 'workspace' | 'global',
    workspacePath?: string
  ): Promise<void> {
    return this.adapter.togglePluginState(pluginPath, enabled, scope, workspacePath);
  }

  public static async deletePlugin(
    pluginPath: string,
    scope: 'workspace' | 'global',
    workspacePath?: string
  ): Promise<void> {
    return this.adapter.deletePlugin(pluginPath, scope, workspacePath);
  }
}
