<template>
  <div
    v-if="store.activeInstallPlugin"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    @click.self="closeModal"
  >
    <div class="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-white/10 space-y-5 bg-[#181822] max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-white/10 pb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-base shrink-0">
            <Download class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <h3 class="text-sm font-bold text-white">{{ t('installModal.title') }}</h3>
            <p class="text-xs text-gray-400 mt-0.5 truncate">
              {{ t('installModal.installing') }}: <span class="text-white font-medium">{{ plugin?.name }}</span>
              <span v-if="plugin?.version" class="text-gray-500 font-mono ml-1">v{{ plugin?.version }}</span>
            </p>
          </div>
        </div>

        <button
          @click="closeModal"
          class="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5 cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- 1. Target AI Agent Runtime Selector -->
      <div class="space-y-1.5 relative z-20">
        <label class="text-xs font-semibold text-gray-300 flex items-center justify-between">
          <span>{{ t('installModal.targetRuntime') }}</span>
          <span class="text-[11px] font-normal text-indigo-400">
            {{ t('runtimes.currentEffective') }}: {{ effectiveRuntimeName }}
          </span>
        </label>

        <!-- Dropdown Trigger Button -->
        <div class="relative">
          <button
            type="button"
            @click="isDropdownOpen = !isDropdownOpen"
            class="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-left flex items-center justify-between gap-2 hover:border-white/20 transition-all cursor-pointer"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-5 h-5 flex items-center justify-center shrink-0">
                <Bot v-if="targetAgentRuntime === 'auto'" class="w-4 h-4 text-indigo-400 shrink-0" />
                <img v-else-if="targetAgentRuntime === 'antigravity'" :src="antigravityIcon" alt="Antigravity" class="w-4 h-4 object-contain shrink-0" />
                <img v-else-if="targetAgentRuntime === 'opencode'" :src="opencodeIcon" alt="OpenCode" class="w-4 h-4 object-contain shrink-0 rounded-sm" />
                <img v-else-if="targetAgentRuntime === 'codex'" :src="codexIcon" alt="OpenAI Codex" class="w-4 h-4 object-contain shrink-0" />
              </div>
              <span class="text-xs text-white font-medium truncate">
                <template v-if="targetAgentRuntime === 'auto'">{{ t('runtimes.auto') }} ({{ effectiveRuntimeName }})</template>
                <template v-else-if="targetAgentRuntime === 'antigravity'">Google Antigravity</template>
                <template v-else-if="targetAgentRuntime === 'opencode'">OpenCode</template>
                <template v-else-if="targetAgentRuntime === 'codex'">OpenAI Codex</template>
              </span>
            </div>
            <ChevronDown class="w-4 h-4 text-gray-400 transition-transform duration-200" :class="{ 'rotate-180 text-white': isDropdownOpen }" />
          </button>

          <!-- Dropdown List -->
          <div
            v-if="isDropdownOpen"
            class="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#16161f] border border-white/20 rounded-xl shadow-2xl overflow-hidden py-1 divide-y divide-white/10 animate-fade-in"
          >
            <button
              type="button"
              @click="selectRuntime('auto')"
              class="w-full px-3 py-2.5 text-left transition-colors flex items-center justify-between gap-2.5 hover:bg-[#222230] cursor-pointer"
              :class="{ 'bg-indigo-600/20': targetAgentRuntime === 'auto' }"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-5 h-5 flex items-center justify-center shrink-0"><Bot class="w-4 h-4 text-indigo-400 shrink-0" /></div>
                <span class="text-xs text-white">{{ t('runtimes.auto') }} ({{ effectiveRuntimeName }})</span>
              </div>
              <Check v-if="targetAgentRuntime === 'auto'" class="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            </button>

            <button
              type="button"
              @click="selectRuntime('antigravity')"
              class="w-full px-3 py-2.5 text-left transition-colors flex items-center justify-between gap-2.5 hover:bg-[#222230] cursor-pointer"
              :class="{ 'bg-blue-600/20': targetAgentRuntime === 'antigravity' }"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-5 h-5 flex items-center justify-center shrink-0"><img :src="antigravityIcon" alt="Antigravity" class="w-4 h-4 object-contain shrink-0" /></div>
                <span class="text-xs text-white">Google Antigravity</span>
              </div>
              <Check v-if="targetAgentRuntime === 'antigravity'" class="w-3.5 h-3.5 text-blue-400 shrink-0" />
            </button>

            <button
              type="button"
              @click="selectRuntime('opencode')"
              class="w-full px-3 py-2.5 text-left transition-colors flex items-center justify-between gap-2.5 hover:bg-[#222230] cursor-pointer"
              :class="{ 'bg-orange-600/20': targetAgentRuntime === 'opencode' }"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-5 h-5 flex items-center justify-center shrink-0"><img :src="opencodeIcon" alt="OpenCode" class="w-4 h-4 object-contain shrink-0 rounded-sm" /></div>
                <span class="text-xs text-white">OpenCode</span>
              </div>
              <Check v-if="targetAgentRuntime === 'opencode'" class="w-3.5 h-3.5 text-orange-400 shrink-0" />
            </button>

            <button
              type="button"
              @click="selectRuntime('codex')"
              class="w-full px-3 py-2.5 text-left transition-colors flex items-center justify-between gap-2.5 hover:bg-[#222230] cursor-pointer"
              :class="{ 'bg-emerald-600/20': targetAgentRuntime === 'codex' }"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-5 h-5 flex items-center justify-center shrink-0"><img :src="codexIcon" alt="OpenAI Codex" class="w-4 h-4 object-contain shrink-0" /></div>
                <span class="text-xs text-white">OpenAI Codex</span>
              </div>
              <Check v-if="targetAgentRuntime === 'codex'" class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </button>
          </div>
        </div>
      </div>

      <!-- 2. Scope Selection (Dynamic Radios strictly based on Agent Capability Matrix) -->
      <div class="space-y-3">
        <label class="text-xs font-semibold text-gray-300 block">
          {{ t('installModal.targetScope') }}
        </label>
        <div class="space-y-2.5">
          <!-- 1. Workspace Scope Radio (Universal) -->
          <label
            :class="[
              'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all',
              targetScope === 'workspace'
                ? 'bg-indigo-600/15 border-indigo-500/50 text-white shadow-sm'
                : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/20'
            ]"
          >
            <input
              type="radio"
              name="scope"
              value="workspace"
              v-model="targetScope"
              class="sr-only"
            />
            <div
              :class="[
                'mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0',
                targetScope === 'workspace'
                  ? 'border-indigo-500 bg-indigo-600 shadow-sm shadow-indigo-500/50'
                  : 'border-white/20 bg-black/40'
              ]"
            >
              <div v-if="targetScope === 'workspace'" class="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <div class="text-xs flex-1 min-w-0">
              <div class="font-semibold text-gray-200">{{ t('installModal.workspaceScopeTitle') }}</div>
              <div class="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{{ t('installModal.workspaceScopeDesc') }}</div>
              <div class="text-[10.5px] text-blue-300/90 font-mono mt-1 bg-black/30 px-2 py-1 rounded border border-white/5 truncate">
                {{ workspacePathPreview }}
              </div>
            </div>
          </label>

          <!-- 2. AI Agent Scope Radio (Supported for Antigravity & OpenCode) -->
          <label
            v-if="isAgentScopeSupported"
            :class="[
              'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all',
              targetScope === 'agent'
                ? 'bg-purple-600/15 border-purple-500/50 text-white shadow-sm'
                : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/20'
            ]"
          >
            <input
              type="radio"
              name="scope"
              value="agent"
              v-model="targetScope"
              class="sr-only"
            />
            <div
              :class="[
                'mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0',
                targetScope === 'agent'
                  ? 'border-purple-500 bg-purple-600 shadow-sm shadow-purple-500/50'
                  : 'border-white/20 bg-black/40'
              ]"
            >
              <div v-if="targetScope === 'agent'" class="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <div class="text-xs flex-1 min-w-0">
              <div class="font-semibold text-gray-200">{{ t('installModal.agentScopeTitle') }}</div>
              <div class="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{{ t('installModal.agentScopeDesc') }}</div>
              <div class="text-[10.5px] text-purple-300/90 font-mono mt-1 bg-black/30 px-2 py-1 rounded border border-white/5 truncate">
                {{ agentPathPreview }}
              </div>
            </div>
          </label>

          <!-- 3. Global System Scope Radio (Supported for Codex & OpenCode) -->
          <label
            v-if="isGlobalScopeSupported"
            :class="[
              'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all',
              targetScope === 'global'
                ? 'bg-emerald-600/15 border-emerald-500/50 text-white shadow-sm'
                : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/20'
            ]"
          >
            <input
              type="radio"
              name="scope"
              value="global"
              v-model="targetScope"
              class="sr-only"
            />
            <div
              :class="[
                'mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0',
                targetScope === 'global'
                  ? 'border-emerald-500 bg-emerald-600 shadow-sm shadow-emerald-500/50'
                  : 'border-white/20 bg-black/40'
              ]"
            >
              <div v-if="targetScope === 'global'" class="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <div class="text-xs flex-1 min-w-0">
              <div class="font-semibold text-gray-200">{{ t('installModal.globalScopeTitle') }}</div>
              <div class="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{{ t('installModal.globalScopeDesc') }}</div>
              <div class="text-[10.5px] text-emerald-300/90 font-mono mt-1 bg-black/30 px-2 py-1 rounded border border-white/5 truncate">
                {{ globalPathPreview }}
              </div>
            </div>
          </label>
        </div>
      </div>

      <!-- Multi-Root Workspace Folder Selector (if applicable) -->
      <div v-if="targetScope === 'workspace' && store.workspaceFolders.length > 1" class="space-y-1.5">
        <label class="text-xs font-semibold text-gray-300 block">
          {{ t('installModal.targetWorkspaceFolder') }}
        </label>
        <select
          v-model="targetWorkspaceFolder"
          class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option
            v-for="folder in store.workspaceFolders"
            :key="folder.path"
            :value="folder.path"
            class="bg-[#181822] text-white"
          >
            {{ folder.name }} ({{ folder.path }})
          </option>
        </select>
      </div>

      <!-- MCP Configuration (if applicable) -->
      <div v-if="plugin?.mcpServers" class="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs font-semibold text-indigo-300">
            <Server class="w-4 h-4" />
            <span>{{ t('installModal.mcpInclude') }}</span>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="installMcp" class="sr-only peer" />
            <div class="w-9 h-5 bg-black/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <p class="text-[11px] text-gray-400 leading-relaxed">
          {{ t('installModal.mcpDesc') }}
        </p>

        <!-- MCP Environment Variables Input -->
        <div v-if="installMcp && requiredEnvVars.length > 0" class="space-y-2 pt-2 border-t border-white/10">
          <div class="text-[11px] font-semibold text-gray-300">{{ t('installModal.envVariables') }}</div>
          <div v-for="envKey in requiredEnvVars" :key="envKey" class="space-y-1">
            <label class="text-[10px] font-mono text-gray-400 block">{{ envKey }}</label>
            <input
              type="password"
              v-model="mcpEnv[envKey]"
              :placeholder="t('installModal.enterEnv', { key: envKey })"
              class="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          @click="closeModal"
          class="px-4 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          {{ t('installModal.cancelBtn') }}
        </button>
        <button
          type="button"
          @click="handleConfirm"
          :disabled="isInstalling"
          class="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Loader2 v-if="isInstalling" class="w-4 h-4 animate-spin" />
          <Download v-else class="w-4 h-4" />
          <span>{{ isInstalling ? t('installModal.installingBtn') : t('installModal.confirmBtn') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Download, X, Server, Loader2, Bot, ChevronDown, Check } from 'lucide-vue-next';
import { useSkillStore } from '../stores/skillStore';
import { useI18n } from '../services/i18n';
import { antigravityIcon, opencodeIcon, codexIcon } from '../assets/icons/runtimeIcons';
import { PluginScope, TargetAgentRuntime, ConcreteAgentRuntime } from '../types';

const store = useSkillStore();
const { t } = useI18n();

const plugin = computed(() => store.activeInstallPlugin);
const targetScope = ref<PluginScope>('workspace');
const targetWorkspaceFolder = ref<string>('');
const installMcp = ref<boolean>(true);
const mcpEnv = ref<Record<string, string>>({});
const isInstalling = ref<boolean>(false);
const isDropdownOpen = ref<boolean>(false);

// Local targetAgentRuntime initialized from store
const targetAgentRuntime = ref<TargetAgentRuntime>(store.targetAgentRuntime || 'auto');

const effectiveRuntime = computed<ConcreteAgentRuntime>(() => {
  if (targetAgentRuntime.value !== 'auto') {
    return targetAgentRuntime.value as ConcreteAgentRuntime;
  }
  return store.effectiveAgentRuntime || 'antigravity';
});

const effectiveRuntimeName = computed(() => {
  if (effectiveRuntime.value === 'antigravity') return 'Google Antigravity';
  if (effectiveRuntime.value === 'codex') return 'OpenAI Codex';
  return 'OpenCode';
});

// Scope support matrix:
// - Antigravity: Workspace + Agent
// - Codex: Workspace + Agent + Global
// - OpenCode: Workspace + Agent + Global
const isAgentScopeSupported = computed(() => {
  return true; // All three runtimes support Agent scope
});

const isGlobalScopeSupported = computed(() => {
  return effectiveRuntime.value === 'codex' || effectiveRuntime.value === 'opencode';
});

// Auto-adjust selected scope if unsupported when runtime changes
watch(effectiveRuntime, (newRuntime) => {
  if (targetScope.value === 'agent' && !isAgentScopeSupported.value) {
    targetScope.value = isGlobalScopeSupported.value ? 'global' : 'workspace';
  } else if (targetScope.value === 'global' && !isGlobalScopeSupported.value) {
    targetScope.value = isAgentScopeSupported.value ? 'agent' : 'workspace';
  }
});

const selectRuntime = (runtime: TargetAgentRuntime) => {
  targetAgentRuntime.value = runtime;
  isDropdownOpen.value = false;
};

// Plugin name helper
const currentPluginName = computed(() => {
  return plugin.value?.name || 'plugin-name';
});

function sanitizeMarketName(name?: string): string {
  if (!name) return 'default';
  const clean = name.toLowerCase().replace(/[^a-z0-9_.-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return clean || 'default';
}

function sanitizeVersion(ver?: string): string {
  if (!ver) return '1.0.0';
  const clean = ver.replace(/[^a-zA-Z0-9_.+\-]/g, '');
  return clean || '1.0.0';
}

// Workspace path preview
const workspacePathPreview = computed(() => {
  const ws = targetWorkspaceFolder.value || (store.workspaceFolders.length > 0 ? store.workspaceFolders[0].path : '<Workspace>');
  if (effectiveRuntime.value === 'antigravity') return `${ws}/.agents/plugins/${currentPluginName.value}`;
  if (effectiveRuntime.value === 'codex') {
    const market = sanitizeMarketName(plugin.value?.sourceName);
    const ver = sanitizeVersion(plugin.value?.version);
    return `${ws}/.codex/plugins/cache/${market}/${currentPluginName.value}/${ver}`;
  }
  return `${ws}/.opencode/plugins/${currentPluginName.value}`;
});

// Agent path preview
const agentPathPreview = computed(() => {
  if (effectiveRuntime.value === 'antigravity') return `~/.gemini/config/plugins/${currentPluginName.value}`;
  if (effectiveRuntime.value === 'codex') {
    const market = sanitizeMarketName(plugin.value?.sourceName);
    const ver = sanitizeVersion(plugin.value?.version);
    return `~/.codex/plugins/cache/${market}/${currentPluginName.value}/${ver}`;
  }
  return `~/.config/opencode/plugins/${currentPluginName.value}`;
});

// Global path preview (~/.agents/plugins/<pluginName>)
const globalPathPreview = computed(() => {
  return `~/.agents/plugins/${currentPluginName.value}`;
});

// Parse required environment variables from MCP config
const requiredEnvVars = computed(() => {
  if (!plugin.value?.mcpServers) return [];
  const envVars = new Set<string>();

  for (const server of Object.values(plugin.value.mcpServers) as Array<{ env?: Record<string, unknown> }>) {
    if (server.env) {
      for (const [key, val] of Object.entries(server.env)) {
        if (typeof val === 'string' && (val.includes('${') || val === '')) {
          envVars.add(key);
        }
      }
    }
  }

  return Array.from(envVars);
});

// Initialize workspace folder
watch(
  () => store.workspaceFolders,
  (folders) => {
    if (folders.length > 0 && !targetWorkspaceFolder.value) {
      targetWorkspaceFolder.value = folders[0].path;
    }
  },
  { immediate: true }
);

// Reset state when opening modal
watch(
  () => store.activeInstallPlugin,
  (activePlugin) => {
    if (activePlugin) {
      const defaultScope = store.settings.defaultInstallScope;
      if (defaultScope === 'workspace') {
        targetScope.value = 'workspace';
      } else if (defaultScope === 'agent' && isAgentScopeSupported.value) {
        targetScope.value = 'agent';
      } else if (defaultScope === 'global' && isGlobalScopeSupported.value) {
        targetScope.value = 'global';
      } else {
        targetScope.value = isGlobalScopeSupported.value && !isAgentScopeSupported.value ? 'global' : 'workspace';
      }

      targetAgentRuntime.value = store.targetAgentRuntime || 'auto';
      isDropdownOpen.value = false;
      mcpEnv.value = {};
      isInstalling.value = false;
    }
  },
  { immediate: true }
);

const closeModal = () => {
  store.activeInstallPlugin = null;
};

const handleConfirm = async () => {
  if (!plugin.value) return;

  isInstalling.value = true;
  try {
    await store.installSkill({
      pluginName: plugin.value.name,
      source: plugin.value.source,
      sourceName: plugin.value.sourceName,
      version: plugin.value.version,
      gitSha: plugin.value.gitSha,
      gitTag: plugin.value.gitTag,
      scope: targetScope.value,
      targetWorkspaceFolder: targetScope.value === 'workspace' ? targetWorkspaceFolder.value : undefined,
      targetAgentRuntime: targetAgentRuntime.value,
      installMcp: installMcp.value,
      mcpEnv: mcpEnv.value,
      skills: plugin.value.skills
    });
    closeModal();
  } catch (err) {
    console.error('Installation error:', err);
  } finally {
    isInstalling.value = false;
  }
};
</script>
