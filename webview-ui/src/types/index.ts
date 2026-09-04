/**
 * PluginHub Frontend Type Definitions (Universal AI Plugin & Skill Manager)
 */

export type SourceType = 'official' | 'git' | 'url' | 'local';

export type TargetAgentRuntime = 'auto' | 'antigravity' | 'opencode' | 'codex';
export type ConcreteAgentRuntime = 'antigravity' | 'opencode' | 'codex';

export type PluginScope = 'workspace' | 'agent' | 'global';

export interface MarketplaceSourceConfig {
  id: string;
  name: string;
  type: SourceType;
  location: string;
  branch?: string;
  token?: string;
  enabled: boolean;
  isDefault?: boolean;
  lastUpdated?: number;
}

export interface MarketplacePluginSource {
  source: 'url' | 'git-subdir' | string;
  url?: string;
  path?: string;
  ref?: string;
  sha?: string;
}

export interface MarketplacePlugin {
  name: string;
  description: string;
  version?: string;
  gitSha?: string;
  gitTag?: string;
  category?: string;
  author?: {
    name: string;
    email?: string;
    url?: string;
  };
  homepage?: string;
  source: string | MarketplacePluginSource;
  sourceId?: string;
  sourceName?: string;
  skills?: string[];
  tags?: string[];
  installed?: boolean;
  installedScope?: PluginScope;
  installedVersion?: string;
  latestVersion?: string;
  hasUpdate?: boolean;
  mcpServers?: Record<string, any>;
}

export interface MarketplaceManifest {
  name: string;
  description: string;
  plugins: MarketplacePlugin[];
}

export interface SubSkillItem {
  name: string;
  description: string;
  path: string;
}

export interface PluginDetail {
  name: string;
  description: string;
  version?: string;
  gitSha?: string;
  gitTag?: string;
  installedAt?: number;
  path?: string;
  content: string; // Raw or markdown body
  frontmatter: Record<string, any>;
  hasScripts: boolean;
  scripts: { name: string; path: string; content?: string }[];
  hasMcp: boolean;
  mcpConfig?: Record<string, any>;
  hasReferences: boolean;
  references: string[];
  sourceUrl?: string;
  sourceName?: string;
  category?: string;
  author?: string;
  homepage?: string;
  warningScripts?: string[];
  skills?: string[];
  skillItems?: SubSkillItem[];
}

export type SkillDetail = PluginDetail;

export interface LocalSkillItem {
  name: string;
  description: string;
  path: string;
  scope: PluginScope;
  workspacePath?: string;
  workspaceName?: string;
  enabled: boolean;
  isCustom: boolean;
  isManaged?: boolean;
  isNative?: boolean;
  itemType?: 'skill' | 'plugin';
  sourceUrl?: string;
  sourceName?: string;
  version?: string;
  gitSha?: string;
  gitTag?: string;
  latestVersion?: string;
  hasUpdate?: boolean;
  hasScripts: boolean;
  hasMcp: boolean;
  installedAt?: number;
  updatedAt?: number;
  files?: string[];
  skills?: string[];
  runtime?: ConcreteAgentRuntime;
}

export interface InstallSkillOptions {
  pluginName: string;
  skillName?: string;
  description?: string;
  scope: PluginScope;
  targetWorkspaceFolder?: string;
  targetAgentRuntime?: TargetAgentRuntime;
  source: string | MarketplacePluginSource;
  sourceName?: string;
  version?: string;
  gitSha?: string;
  gitTag?: string;
  installMcp?: boolean;
  overwrite?: boolean;
  mcpEnv?: Record<string, string>;
  skills?: string[];
}

export interface UserSettings {
  githubToken: string;
  hasGithubToken?: boolean;
  mirrorAcceleration: boolean;
  proxyUrl?: string;
  defaultInstallScope: 'workspace' | 'agent' | 'global' | 'ask';
  targetAgentRuntime?: TargetAgentRuntime;
  detectedRuntime?: ConcreteAgentRuntime;
  installedSkillsExclude?: string[];
}

export interface WorkspaceFolderInfo {
  name: string;
  path: string;
}
