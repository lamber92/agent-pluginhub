import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { bridge } from '../services/bridgeClient';
import {
  MarketplacePlugin,
  LocalSkillItem,
  MarketplaceSourceConfig,
  SkillDetail,
  UserSettings,
  WorkspaceFolderInfo,
  TargetAgentRuntime,
  ConcreteAgentRuntime
} from '../types';
import { compareVersions, formatVersion, stripVersionPrefix } from '../utils/version';

// Re-export types and version utilities for backward compatibility
export * from '../types';
export * from '../utils/version';

/**
 * Pinia 全局状态与多维筛选中心 (useSkillStore)
 * 统一管理技能集市、本地已安装技能、市场源、用户配置与各模态框状态
 */
export const useSkillStore = defineStore('skills', () => {
  // 1. 视图与导航状态
  const activeTab = ref<'installed' | 'discover' | 'settings'>('installed');
  const searchQuery = ref('');
  const selectedCategory = ref<string>('all');
  const selectedSourceId = ref<string>('');

  // 2. 核心数据源状态
  const marketplacePlugins = ref<MarketplacePlugin[]>([]);
  const localSkills = ref<LocalSkillItem[]>([]);
  const sources = ref<MarketplaceSourceConfig[]>([]);
  const settings = ref<UserSettings>({
    githubToken: '',
    mirrorAcceleration: true,
    defaultInstallScope: 'workspace',
    installedSkillsExclude: []
  });
  const workspaceFolders = ref<WorkspaceFolderInfo[]>([]);

  // 3. 模态框与详情交互状态
  const isLoading = ref(false);
  const isDetailLoading = ref(false);
  const activeDetailSkill = ref<SkillDetail | null>(null);
  const activeInstallPlugin = ref<MarketplacePlugin | null>(null);
  const isSourceModalOpen = ref(false);
  const editingSource = ref<MarketplaceSourceConfig | null>(null);
  const skillToDelete = ref<LocalSkillItem | null>(null);

  // 4. 市场发现多维筛选计算属性
  const filteredPlugins = computed(() => {
    if (!Array.isArray(marketplacePlugins.value)) return [];
    return marketplacePlugins.value.filter((p) => {
      // 市场源过滤
      if (selectedSourceId.value && p.sourceId !== selectedSourceId.value) {
        return false;
      }
      // 分类过滤
      if (selectedCategory.value !== 'all' && p.category !== selectedCategory.value) {
        return false;
      }
      // 搜索关键词过滤 (名称、描述、标签)
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDesc = (p.description || '').toLowerCase().includes(q);
        const matchTags = (p.tags || []).some((t) => t.toLowerCase().includes(q));
        return matchName || matchDesc || matchTags;
      }
      return true;
    });
  });

  // 5. 已安装技能筛选状态
  const installedStatusFilter = ref<'all' | 'enabled' | 'disabled' | 'hasUpdate'>('all');
  const installedScopeFilter = ref<'all' | 'workspace' | 'agent' | 'global'>('all');
  const installedCategoryFilter = ref<string>('all');
  const installedSearchQuery = ref('');

  // 6. 已安装技能多维组合筛选计算属性
  const filteredLocalSkills = computed(() => {
    if (!Array.isArray(localSkills.value)) return [];
    return localSkills.value.filter((s) => {
      // 作用域过滤 (workspace / global)
      if (installedScopeFilter.value !== 'all' && s.scope !== installedScopeFilter.value) {
        return false;
      }
      // 运行状态过滤 (enabled / disabled / hasUpdate)
      if (installedStatusFilter.value === 'enabled' && !s.enabled) return false;
      if (installedStatusFilter.value === 'disabled' && s.enabled) return false;
      if (installedStatusFilter.value === 'hasUpdate' && !s.hasUpdate) return false;

      // 分类过滤
      if (installedCategoryFilter.value !== 'all') {
        const matching = marketplacePlugins.value.find((p) => p.name.toLowerCase() === s.name.toLowerCase());
        const cat = matching?.category || (s.isCustom ? 'custom' : 'general');
        if (cat !== installedCategoryFilter.value) {
          return false;
        }
      }

      // 关键词搜索过滤
      if (installedSearchQuery.value.trim()) {
        const q = installedSearchQuery.value.toLowerCase().trim();
        const matchName = s.name.toLowerCase().includes(q);
        const matchDesc = (s.description || '').toLowerCase().includes(q);
        return matchName || matchDesc;
      }
      return true;
    });
  });

  // Grouped Local Skills (3-Tier Scope: Workspace, Agent, Global)
  const workspaceSkills = computed(() => localSkills.value.filter((s) => s.scope === 'workspace'));
  const agentSkills = computed(() => localSkills.value.filter((s) => s.scope === 'agent'));
  const globalSkills = computed(() => localSkills.value.filter((s) => s.scope === 'global'));

  const filteredWorkspaceSkills = computed(() => filteredLocalSkills.value.filter((s) => s.scope === 'workspace'));
  const filteredAgentSkills = computed(() => filteredLocalSkills.value.filter((s) => s.scope === 'agent'));
  const filteredGlobalSkills = computed(() => filteredLocalSkills.value.filter((s) => s.scope === 'global'));

  // Actions
  const loadMarketplace = async (forceRefresh = false) => {
    try {
      isLoading.value = true;
      const plugins = await bridge.invoke<MarketplacePlugin[]>('getMarketplacePlugins', {
        forceRefresh
      });
      if (Array.isArray(plugins)) {
        marketplacePlugins.value = plugins;
        await syncInstalledStatus();
      } else {
        marketplacePlugins.value = [];
      }
    } catch (err) {
      console.error('Failed to load marketplace:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const loadLocalSkills = async () => {
    try {
      const skills = await bridge.invoke<LocalSkillItem[]>('getLocalSkills', {
        targetRuntime: targetAgentRuntime.value
      });
      if (Array.isArray(skills)) {
        skills.sort((a, b) => {
          if (a.scope !== b.scope) return a.scope === 'workspace' ? -1 : 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
        });
        localSkills.value = skills;
        await syncInstalledStatus();
      } else {
        localSkills.value = [];
      }
    } catch (err) {
      console.error('Failed to load local skills:', err);
    }
  };

  const loadSources = async () => {
    try {
      const res = await bridge.invoke<MarketplaceSourceConfig[]>('getSources');
      if (Array.isArray(res)) sources.value = res;
    } catch (err) {
      console.error('Failed to load sources:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const cfg = await bridge.invoke<UserSettings>('getSettings');
      if (cfg) settings.value = cfg;
      const ws = await bridge.invoke('getWorkspaceFolders');
      if (ws) workspaceFolders.value = ws;
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const syncInstalledStatus = async () => {
    if (!Array.isArray(marketplacePlugins.value) || !Array.isArray(localSkills.value)) return;
    const scopeRank: Record<string, number> = { workspace: 0, agent: 1, global: 2 };
    const localMap = new Map<string, LocalSkillItem>();
    for (const skill of [...localSkills.value].sort((a, b) => scopeRank[a.scope] - scopeRank[b.scope])) {
      const key = `${skill.runtime || effectiveAgentRuntime.value}:${skill.name.toLowerCase()}`;
      if (!localMap.has(key)) localMap.set(key, skill);
    }

    for (const plugin of marketplacePlugins.value) {
      const local = localMap.get(`${effectiveAgentRuntime.value}:${plugin.name.toLowerCase()}`);
      const isInst = !!local;
      plugin.installed = isInst;
      
      const latestVer = plugin.version || (plugin.gitTag ? (plugin.gitTag.startsWith('v') ? plugin.gitTag : `tag:${plugin.gitTag}`) : (plugin.gitSha ? `git:${plugin.gitSha.slice(0, 7)}` : ''));
      plugin.latestVersion = latestVer;

      if (local) {
        plugin.installedScope = local.scope;
        
        // Auto-associate gitTag for existing installed skills
        if (!local.gitTag && plugin.gitTag) {
          local.gitTag = plugin.gitTag;
        }

        const installedVer = local.version || (local.gitTag ? (local.gitTag.startsWith('v') ? local.gitTag : `tag:${local.gitTag}`) : (local.gitSha ? `git:${local.gitSha.slice(0, 7)}` : ''));
        plugin.installedVersion = installedVer;
        
        const hasUpdate = compareVersions(latestVer, installedVer) > 0;
        plugin.hasUpdate = hasUpdate;
        local.latestVersion = latestVer;
        local.hasUpdate = hasUpdate;
        if (plugin.sourceName) {
          local.sourceName = plugin.sourceName;
        }
      } else {
        plugin.installedVersion = undefined;
        plugin.hasUpdate = false;
      }
    }

    for (const local of localSkills.value) {
      const found = marketplacePlugins.value.find((p) => p.name.toLowerCase() === local.name.toLowerCase());
      if (found) {
        if (!local.gitTag && found.gitTag) {
          local.gitTag = found.gitTag;
        }
        if (found.description && (!local.description || local.description.startsWith('Antigravity plugin for') || local.description === 'Antigravity Plugin')) {
          local.description = found.description;
        }
        const foundVer = found.version || (found.gitTag ? (found.gitTag.startsWith('v') ? found.gitTag : `tag:${found.gitTag}`) : (found.gitSha ? `git:${found.gitSha.slice(0, 7)}` : ''));
        const localVer = local.version || (local.gitTag ? (local.gitTag.startsWith('v') ? local.gitTag : `tag:${local.gitTag}`) : (local.gitSha ? `git:${local.gitSha.slice(0, 7)}` : ''));
        local.latestVersion = foundVer;
        const hasUpdate = compareVersions(foundVer, localVer) > 0;
        local.hasUpdate = hasUpdate;
        if (found.sourceName) local.sourceName = found.sourceName;
      } else if (!local.latestVersion) {
        local.latestVersion = local.version || (local.gitTag ? `tag:${local.gitTag}` : (local.gitSha ? `git:${local.gitSha.slice(0, 7)}` : '1.0.0'));
        local.hasUpdate = false;
      }
    }
  };

  const fetchSkillDetail = async (plugin: MarketplacePlugin) => {
    try {
      isDetailLoading.value = true;
      const detail = await bridge.invoke<SkillDetail>('getSkillDetail', { plugin });
      activeDetailSkill.value = detail;
    } catch (err) {
      console.error('Failed to fetch skill detail:', err);
    } finally {
      isDetailLoading.value = false;
    }
  };

  const fetchLocalSkillDetail = async (skill: LocalSkillItem) => {
    try {
      isDetailLoading.value = true;
      const detail = await bridge.invoke<SkillDetail>('getSkillDetail', { skillPath: skill.path });
      if (detail) {
        if (!detail.installedAt && skill.installedAt) {
          detail.installedAt = skill.installedAt;
        }
        if (!detail.path) {
          detail.path = skill.path;
        }
        activeDetailSkill.value = detail;
      }
    } catch (err) {
      console.error('Failed to fetch local skill detail:', err);
    } finally {
      isDetailLoading.value = false;
    }
  };

  const toggleSkill = async (skill: LocalSkillItem, enabled: boolean) => {
    try {
      skill.enabled = enabled;
      const updated = await bridge.invoke<LocalSkillItem>('toggleSkillState', { skill, enabled });
      if (updated && updated.path) {
        skill.path = updated.path;
      }
    } catch (err) {
      console.error('Failed to toggle skill:', err);
      skill.enabled = !enabled; // revert
    }
  };

  const deleteSkill = (skill: LocalSkillItem) => {
    skillToDelete.value = skill;
  };

  const executeDeleteSkill = async () => {
    if (!skillToDelete.value) return;
    const target = skillToDelete.value;
    try {
      await bridge.invoke('deleteSkill', { skill: target });
      localSkills.value = localSkills.value.filter((s) => s.path !== target.path);
      await syncInstalledStatus();
    } catch (err) {
      console.error('Failed to delete skill:', err);
    } finally {
      skillToDelete.value = null;
    }
  };

  const installSkill = async (options: any) => {
    await bridge.invoke('installSkill', options);
    await loadLocalSkills();
  };

  const exportZip = async (skill: LocalSkillItem) => {
    try {
      await bridge.invoke('exportSkillZip', {
        skillPath: skill.path,
        skillName: skill.name,
        defaultName: skill.name
      });
    } catch (err) {
      console.error('Failed to export zip:', err);
    }
  };

  const importZip = async (scope: 'workspace' | 'global') => {
    try {
      await bridge.invoke('importSkillZip', { scope });
      await loadLocalSkills();
    } catch (err) {
      console.error('Failed to import zip:', err);
    }
  };

  const openInOS = async (fsPath: string) => {
    await bridge.invoke('openInOS', { path: fsPath });
  };

  const openInEditor = async (filePath: string) => {
    await bridge.invoke('openInEditor', { filePath });
  };

  const openExternal = async (url: string) => {
    await bridge.invoke('openExternal', { url });
  };

  // Setup Event Listeners from Extension Backend
  bridge.on('settings:changed', (newSettings: any) => {
    if (newSettings) {
      settings.value = { ...settings.value, ...newSettings };
    }
  });

  bridge.on('skills:changed', () => {
    loadLocalSkills();
  });

  bridge.on('sources:changed', () => {
    loadSources();
    loadMarketplace();
  });

  
  // Target runtime management & switch modal
  const targetAgentRuntime = computed<TargetAgentRuntime>(() => settings.value.targetAgentRuntime || 'auto');
  const effectiveAgentRuntime = computed<ConcreteAgentRuntime>(() => {
    const target = settings.value.targetAgentRuntime;
    if (target && target !== 'auto') {
      return target as ConcreteAgentRuntime;
    }
    return (settings.value.detectedRuntime as ConcreteAgentRuntime) || 'antigravity';
  });
  const isRuntimeSwitchModalOpen = ref(false);
  const pendingRuntime = ref<TargetAgentRuntime | null>(null);
  const isSwitchingRuntime = ref(false);

  const promptRuntimeSwitch = (runtime: TargetAgentRuntime) => {
    if (isSwitchingRuntime.value) return;
    if (runtime === (settings.value.targetAgentRuntime || 'auto')) return;
    pendingRuntime.value = runtime;
    isRuntimeSwitchModalOpen.value = true;
  };

  const cancelRuntimeSwitch = () => {
    if (isSwitchingRuntime.value) return;
    isRuntimeSwitchModalOpen.value = false;
    pendingRuntime.value = null;
  };

  const confirmRuntimeSwitch = async () => {
    if (!pendingRuntime.value || isSwitchingRuntime.value) return;
    const newRuntime = pendingRuntime.value;
    isRuntimeSwitchModalOpen.value = false;
    pendingRuntime.value = null;

    settings.value = {
      ...settings.value,
      targetAgentRuntime: newRuntime
    };

    try {
      isSwitchingRuntime.value = true;
      await bridge.invoke('updateSettings', {
        targetAgentRuntime: newRuntime
      });
      await loadSettings();
      await Promise.all([loadLocalSkills(), loadMarketplace(true)]);
    } catch (err) {
      console.error('Failed to switch runtime:', err);
    } finally {
      isSwitchingRuntime.value = false;
    }
  };

return {
    targetAgentRuntime,
    effectiveAgentRuntime,
    isRuntimeSwitchModalOpen,
    pendingRuntime,
    isSwitchingRuntime,
    promptRuntimeSwitch,
    cancelRuntimeSwitch,
    confirmRuntimeSwitch,
    activeTab,
    searchQuery,
    selectedCategory,
    selectedSourceId,
    marketplacePlugins,
    localSkills,
    sources,
    settings,
    workspaceFolders,
    isLoading,
    isDetailLoading,
    activeDetailSkill,
    activeInstallPlugin,
    isSourceModalOpen,
    editingSource,
    skillToDelete,
    filteredPlugins,
    workspaceSkills,
    agentSkills,
    globalSkills,
    installedStatusFilter,
    installedScopeFilter,
    installedCategoryFilter,
    installedSearchQuery,
    filteredLocalSkills,
    filteredWorkspaceSkills,
    filteredAgentSkills,
    filteredGlobalSkills,
    loadMarketplace,
    loadLocalSkills,
    loadSources,
    loadSettings,
    fetchSkillDetail,
    fetchLocalSkillDetail,
    toggleSkill,
    deleteSkill,
    executeDeleteSkill,
    installSkill,
    exportZip,
    importZip,
    openInOS,
    openInEditor,
    openExternal
  };
});
