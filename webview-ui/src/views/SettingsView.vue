<template>
  <div class="p-4 max-w-3xl mx-auto space-y-6">
    <!-- Target AI Agent Runtime Selection & Path Preview Panel -->
    <div class="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 transition-all" :class="isDropdownOpen ? 'relative z-30' : 'relative z-10'">
      <div class="flex items-center gap-2.5 border-b border-white/10 pb-3">
        <div class="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
          <Bot class="w-4 h-4" />
        </div>
        <div>
          <h2 class="text-sm font-bold text-white">{{ t('runtimes.title') }}</h2>
          <p class="text-xs text-gray-400">{{ t('runtimes.desc') }}</p>
        </div>
      </div>

      <!-- Custom Dropdown Selector with Pure Icons (No Outer Pattern Box) -->
      <div class="relative" ref="dropdownRef">
        <button
          type="button"
          @click="!store.isSwitchingRuntime && (isDropdownOpen = !isDropdownOpen)"
          :disabled="store.isSwitchingRuntime"
          :class="[
            'w-full border rounded-xl p-3 text-left transition-all flex items-center justify-between gap-3 focus:outline-none',
            store.isSwitchingRuntime
              ? 'bg-[#181824]/60 border-indigo-500/30 opacity-75 cursor-not-allowed'
              : 'bg-[#181824] hover:bg-[#202032] border-white/15 hover:border-white/25 cursor-pointer focus:border-indigo-500/70'
          ]"
          :title="store.isSwitchingRuntime ? '正在切换环境并重新扫描数据...' : ''"
        >
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <!-- Current Selected Pure Icon or Spinner -->
            <div class="w-5 h-5 flex items-center justify-center shrink-0">
              <Bot v-if="targetAgentRuntime === 'auto'" class="w-5 h-5 text-indigo-400 shrink-0" />
              <img v-else-if="targetAgentRuntime === 'antigravity'" :src="antigravityIcon" alt="Antigravity" class="w-5 h-5 object-contain shrink-0" />
              <img v-else-if="targetAgentRuntime === 'opencode'" :src="opencodeIcon" alt="OpenCode" class="w-5 h-5 object-contain shrink-0 rounded-sm" />
              <img v-else-if="targetAgentRuntime === 'codex'" :src="codexIcon" alt="OpenAI Codex" class="w-5 h-5 object-contain shrink-0" />
            </div>

            <!-- Current Selected Label & Status -->
            <div class="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
              <span class="text-xs font-semibold text-white flex items-center gap-1.5">
                <template v-if="targetAgentRuntime === 'auto'">{{ t('runtimes.auto') }}</template>
                <template v-else-if="targetAgentRuntime === 'antigravity'">{{ t('runtimes.antigravity') }}</template>
                <template v-else-if="targetAgentRuntime === 'opencode'">{{ t('runtimes.opencode') }}</template>
                <template v-else-if="targetAgentRuntime === 'codex'">{{ t('runtimes.codex') }}</template>
                <span v-if="store.isSwitchingRuntime" class="text-[11px] text-indigo-300 font-normal animate-pulse">
                  正在切换环境并重新扫描插件...
                </span>
              </span>

              <!-- Auto-Detect Live Probe Badge -->
              <span
                v-if="targetAgentRuntime === 'auto' && !store.isSwitchingRuntime"
                class="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium border"
                :class="
                  effectiveRuntime === 'antigravity'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                    : 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                "
              >
                {{ t('runtimes.currentDetected') }}: {{ effectiveRuntime === 'antigravity' ? 'Google Antigravity' : (effectiveRuntime === 'codex' ? 'OpenAI Codex' : 'OpenCode') }}
              </span>
            </div>
          </div>

          <Loader2 v-if="store.isSwitchingRuntime" class="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
          <ChevronDown
            v-else
            class="w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0"
            :class="{ 'rotate-180 text-white': isDropdownOpen }"
          />
        </button>

        <!-- Dropdown Menu List (Solid Opaque Background & Elevated Z-Index) -->
        <div
          v-if="isDropdownOpen"
          class="absolute left-0 right-0 top-full mt-2 z-50 bg-[#16161f] border border-white/20 rounded-xl shadow-2xl overflow-hidden py-1 divide-y divide-white/10 animate-fade-in"
        >
          <!-- 1. Auto Option (With Description) -->
          <button
            type="button"
            @click="selectRuntime('auto')"
            class="w-full p-3 text-left transition-colors flex items-start gap-3 hover:bg-[#222230] cursor-pointer"
            :class="{ 'bg-indigo-600/20': targetAgentRuntime === 'auto' }"
          >
            <Bot class="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs font-semibold text-white">{{ t('runtimes.auto') }}</span>
                  <span
                    class="text-[10px] px-2 py-0.2 rounded-full font-mono font-medium border"
                    :class="
                      effectiveRuntime === 'antigravity'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                    "
                  >
                    {{ t('runtimes.currentDetected') }}: {{ effectiveRuntime === 'antigravity' ? 'Google Antigravity' : 'OpenCode' }}
                  </span>
                </div>
                <Check v-if="targetAgentRuntime === 'auto'" class="w-4 h-4 text-indigo-400 shrink-0" />
              </div>
              <p class="text-[11px] text-gray-400 mt-1 leading-relaxed">
                根据宿主 IDE、已安装扩展与工作区特征目录自动匹配，零手动配置
              </p>
            </div>
          </button>

          <!-- 2. Google Antigravity Option (No Description) -->
          <button
            type="button"
            @click="selectRuntime('antigravity')"
            class="w-full p-3 text-left transition-colors flex items-center gap-3 hover:bg-[#222230] cursor-pointer"
            :class="{ 'bg-blue-600/20': targetAgentRuntime === 'antigravity' }"
          >
            <img :src="antigravityIcon" alt="Antigravity" class="w-5 h-5 object-contain shrink-0" />
            <div class="flex-1 min-w-0 flex items-center justify-between gap-2">
              <span class="text-xs font-semibold text-white">{{ t('runtimes.antigravity') }}</span>
              <Check v-if="targetAgentRuntime === 'antigravity'" class="w-4 h-4 text-blue-400 shrink-0" />
            </div>
          </button>

          <!-- 3. OpenCode Option (No Description) -->
          <button
            type="button"
            @click="selectRuntime('opencode')"
            class="w-full p-3 text-left transition-colors flex items-center gap-3 hover:bg-[#222230] cursor-pointer"
            :class="{ 'bg-orange-600/20': targetAgentRuntime === 'opencode' }"
          >
            <img :src="opencodeIcon" alt="OpenCode" class="w-5 h-5 object-contain shrink-0 rounded-sm" />
            <div class="flex-1 min-w-0 flex items-center justify-between gap-2">
              <span class="text-xs font-semibold text-white">{{ t('runtimes.opencode') }}</span>
              <Check v-if="targetAgentRuntime === 'opencode'" class="w-4 h-4 text-orange-400 shrink-0" />
            </div>
          </button>

          <!-- 4. OpenAI Codex Option (No Description) -->
          <button
            type="button"
            @click="selectRuntime('codex')"
            class="w-full p-3 text-left transition-colors flex items-center gap-3 hover:bg-[#222230] cursor-pointer"
            :class="{ 'bg-emerald-600/20': targetAgentRuntime === 'codex' }"
          >
            <img :src="codexIcon" alt="OpenAI Codex" class="w-5 h-5 object-contain shrink-0" />
            <div class="flex-1 min-w-0 flex items-center justify-between gap-2">
              <span class="text-xs font-semibold text-white">{{ t('runtimes.codex') }}</span>
              <Check v-if="targetAgentRuntime === 'codex'" class="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
          </button>
        </div>
      </div>

      <!-- Real-Time Path Preview Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs pt-1">
        <div class="bg-black/30 p-3 rounded-xl border border-white/5 space-y-1">
          <div class="text-gray-400 font-medium">{{ t('runtimes.workspaceDir') }}</div>
          <div class="font-mono text-blue-300 text-[11px] truncate">{{ workspacePathPreview }}</div>
        </div>
        <div class="bg-black/30 p-3 rounded-xl border border-white/5 space-y-1">
          <div class="text-gray-400 font-medium">{{ t('runtimes.globalDir') }} (Agent)</div>
          <div class="font-mono text-purple-300 text-[11px] truncate">{{ agentPathPreview }}</div>
        </div>
        <div v-if="effectiveRuntime === 'codex' || effectiveRuntime === 'opencode'" class="bg-black/30 p-3 rounded-xl border border-white/5 space-y-1">
          <div class="text-gray-400 font-medium">全局系统目录 (Global)</div>
          <div class="font-mono text-emerald-300 text-[11px] truncate">~/.agents/plugins/</div>
        </div>
      </div>
    </div>

    <!-- Sources Configuration Section -->
    <div class="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 relative z-10">
      <div class="flex items-center justify-between border-b border-white/10 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
            <Globe class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-white">{{ t('settingsView.marketSources') }}</h2>
            <p class="text-xs text-gray-400">{{ t('settingsView.sourcesDesc') }}</p>
          </div>
        </div>

        <button
          @click="openAddSourceModal"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>{{ t('settingsView.addSourceBtn') }}</span>
        </button>
      </div>

      <!-- Sources List with Direct Actions -->
      <div class="space-y-2.5">
        <div
          v-for="source in store.sources"
          :key="source.id"
          class="bg-black/25 p-3.5 rounded-xl border border-white/5 hover:border-white/10 transition-all flex items-center justify-between gap-3 text-xs"
        >
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-white flex items-center gap-2 flex-wrap">
              <span>{{ source.name }}</span>
              <span
                v-if="source.isDefault"
                class="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium"
              >
                {{ t('settingsView.officialBuiltIn') }}
              </span>
              <span
                class="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-gray-400 border border-white/10 uppercase font-mono"
              >
                {{ source.type }}
              </span>
            </div>
            <div class="text-[11px] text-gray-400 font-mono truncate mt-1">
              {{ source.location }}
              <span v-if="source.branch" class="text-gray-500"> ({{ source.branch }})</span>
            </div>
          </div>

          <!-- Direct Operations: Toggle Switch + Edit + Delete -->
          <div class="flex items-center gap-2.5 shrink-0">
            <!-- Status Badge & Switch -->
            <button
              @click="toggleSourceState(source)"
              :class="[
                'w-8 h-4.5 rounded-full transition-colors relative p-0.5 focus:outline-none shrink-0 cursor-pointer',
                source.enabled ? 'bg-indigo-600' : 'bg-gray-700'
              ]"
              :title="source.enabled ? t('settingsView.sourceToggleOn') : t('settingsView.sourceToggleOff')"
            >
              <span
                :class="[
                  'w-3.5 h-3.5 bg-white rounded-full transition-transform block shadow-sm',
                  source.enabled ? 'translate-x-3.5' : 'translate-x-0'
                ]"
              />
            </button>

            <!-- Edit Button -->
            <button
              @click="openEditSourceModal(source)"
              class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              :title="t('settingsView.editConfig')"
            >
              <Pencil class="w-3.5 h-3.5" />
            </button>

            <!-- Delete Button (Only for Non-Default Sources) -->
            <button
              v-if="!source.isDefault"
              @click="promptDeleteSource(source)"
              class="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              :title="t('settingsView.deleteSource')"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Network & Acceleration Preferences Panel -->
    <div class="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 relative z-10">
      <div class="flex items-center gap-2.5 border-b border-white/10 pb-3">
        <div class="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
          <Zap class="w-4 h-4" />
        </div>
        <div>
          <h2 class="text-sm font-bold text-white">{{ t('settingsView.preferences') }}</h2>
          <p class="text-xs text-gray-400">{{ t('settingsView.preferencesDesc') }}</p>
        </div>
      </div>

      <div class="space-y-4">
        <!-- CDN Mirror Acceleration Toggle -->
        <div class="flex items-center justify-between bg-black/20 p-3.5 rounded-xl border border-white/5">
          <div class="space-y-0.5">
            <div class="text-xs font-semibold text-white">{{ t('settingsView.mirrorAcceleration') }}</div>
            <p class="text-[11px] text-gray-400">{{ t('settingsView.mirrorDesc') }}</p>
          </div>
          <input
            type="checkbox"
            v-model="mirrorAcceleration"
            class="rounded text-indigo-600 focus:ring-indigo-500 bg-black/40 border-white/10 cursor-pointer"
          />
        </div>

        <!-- GitHub Personal Access Token -->
        <div class="bg-black/20 p-3.5 rounded-xl border border-white/5 space-y-2">
          <div>
            <div class="text-xs font-semibold text-white">{{ t('settingsView.githubToken') }}</div>
            <p class="text-[11px] text-gray-400">{{ t('settingsView.githubTokenDesc') }}</p>
          </div>
          <input
            type="password"
            v-model="githubToken"
            :placeholder="store.settings.hasGithubToken ? 'Token configured (leave blank to keep)' : 'ghp_xxxxxxxxxxxxxxxxxxxx'"
            class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <!-- HTTP Proxy URL -->
        <div class="bg-black/20 p-3.5 rounded-xl border border-white/5 space-y-2">
          <div>
            <div class="text-xs font-semibold text-white">{{ t('settingsView.proxyUrl') }}</div>
            <p class="text-[11px] text-gray-400">{{ t('settingsView.proxyUrlDesc') }}</p>
          </div>
          <input
            type="text"
            v-model="proxyUrl"
            placeholder="http://127.0.0.1:7890"
            class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <!-- Save Button & Toast -->
        <div class="flex items-center justify-between pt-2">
          <div v-if="isSavedToast" class="text-xs text-emerald-400 font-medium animate-fade-in flex items-center gap-1.5">
            <span>✓ {{ t('settingsView.savedSuccess') }}</span>
          </div>
          <div v-else></div>

          <button
            @click="saveSettings"
            class="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
          >
            <Save class="w-3.5 h-3.5" />
            <span>{{ t('settingsView.saveBtn') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Secondary Confirmation Dialog for Switching Agent Runtime -->
    <div
      v-if="isSwitchModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      @click.self="cancelRuntimeSwitch"
    >
      <div class="glass-panel w-full max-w-md rounded-2xl p-5 shadow-2xl border border-white/10 space-y-4 bg-[#181822]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <RefreshCw class="w-5 h-5" :class="{ 'animate-spin': isSwitchingRuntime }" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-white">{{ t('runtimeSwitchModal.title') }}</h3>
            <p class="text-xs text-gray-400 mt-0.5">{{ t('runtimeSwitchModal.subtitle') }}</p>
          </div>
        </div>

        <div class="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-2.5 text-xs text-gray-300">
          <div class="flex items-center gap-2 flex-wrap">
            <span>{{ t('runtimeSwitchModal.prompt') }}</span>
            <div class="inline-flex items-center gap-1.5 font-semibold text-white bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
              <Bot v-if="pendingRuntime === 'auto'" class="w-3.5 h-3.5 text-indigo-400" />
              <img v-else-if="pendingRuntime === 'antigravity'" :src="antigravityIcon" alt="Antigravity" class="w-3.5 h-3.5 object-contain" />
              <img v-else-if="pendingRuntime === 'opencode'" :src="opencodeIcon" alt="OpenCode" class="w-3.5 h-3.5 object-contain rounded-sm" />
              <span>{{ getRuntimeDisplayName(pendingRuntime) }}</span>
            </div>
            <span>?</span>
          </div>

          <p class="text-[11px] text-gray-400 leading-relaxed border-t border-white/5 pt-2">
            {{ t('runtimeSwitchModal.notice') }}
          </p>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            @click.stop="cancelRuntimeSwitch"
            :disabled="isSwitchingRuntime"
            class="px-3.5 py-1.5 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            @click.stop="confirmRuntimeSwitch"
            :disabled="isSwitchingRuntime"
            class="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Loader2 v-if="isSwitchingRuntime" class="w-3.5 h-3.5 animate-spin" />
            <Check v-else class="w-3.5 h-3.5" />
            <span>{{ isSwitchingRuntime ? t('runtimeSwitchModal.switching') : t('runtimeSwitchModal.confirmBtn') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Secondary Confirmation Dialog for Deleting Source -->
    <div
      v-if="sourceToDelete"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      @click.self="sourceToDelete = null"
    >
      <div class="glass-panel w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-white/10 space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-white">{{ t('settingsView.deleteModalTitle') }}</h3>
            <p class="text-xs text-gray-400 mt-0.5">{{ t('settingsView.deleteModalSubtitle') }}</p>
          </div>
        </div>

        <div class="bg-black/30 p-3 rounded-xl border border-white/5 text-xs text-gray-300 leading-relaxed">
          {{ t('settingsView.deleteModalPrompt') }} <span class="font-semibold text-white">「{{ sourceToDelete.name }}」</span> ?
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            @click.stop="sourceToDelete = null"
            class="px-3.5 py-1.5 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            @click.stop="confirmDeleteSource"
            class="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-500 shadow-md shadow-red-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 class="w-3.5 h-3.5" />
            <span>{{ t('settingsView.confirmRemove') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Bot, Globe, Plus, Zap, Save, Pencil, Trash2, AlertTriangle, ChevronDown, Check, RefreshCw, Loader2 } from 'lucide-vue-next';
import { ConcreteAgentRuntime, MarketplaceSourceConfig, TargetAgentRuntime, useSkillStore } from '../stores/skillStore';
import { useI18n } from '../services/i18n';
import { bridge } from '../services/bridgeClient';
import { antigravityIcon, opencodeIcon, codexIcon } from '../assets/icons/runtimeIcons';

const store = useSkillStore();
const { t } = useI18n();

const targetAgentRuntime = computed<TargetAgentRuntime>(() => store.targetAgentRuntime);
const mirrorAcceleration = ref(store.settings.mirrorAcceleration ?? true);
const githubToken = ref(store.settings.githubToken || '');
const proxyUrl = ref(store.settings.proxyUrl || '');

const isDropdownOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

const sourceToDelete = ref<MarketplaceSourceConfig | null>(null);
const isDeleting = ref(false);
const isSavedToast = ref(false);

watch(
  () => store.settings,
  (newSettings) => {
    if (newSettings) {
      mirrorAcceleration.value = newSettings.mirrorAcceleration ?? true;
      githubToken.value = newSettings.githubToken || '';
      proxyUrl.value = newSettings.proxyUrl || '';
    }
  },
  { immediate: true, deep: true }
);

const effectiveRuntime = computed<ConcreteAgentRuntime>(() => store.effectiveAgentRuntime);
const isSwitchModalOpen = computed(() => store.isRuntimeSwitchModalOpen);
const pendingRuntime = computed(() => store.pendingRuntime);
const isSwitchingRuntime = computed(() => store.isSwitchingRuntime);
const cancelRuntimeSwitch = () => store.cancelRuntimeSwitch();
const confirmRuntimeSwitch = () => store.confirmRuntimeSwitch();
const getRuntimeDisplayName = (runtime: TargetAgentRuntime | null) => {
  if (runtime === 'auto') return t('runtime.auto');
  if (runtime === 'antigravity') return 'Google Antigravity';
  if (runtime === 'opencode') return 'OpenCode';
  if (runtime === 'codex') return 'OpenAI Codex';
  return '';
};

const agentPathPreview = computed(() => {
  if (effectiveRuntime.value === 'antigravity') return '~/.gemini/config/plugins/';
  if (effectiveRuntime.value === 'codex') return '~/.codex/plugins/cache/';
  return '~/.config/opencode/plugins/';
});

const globalPathPreview = computed(() => {
  return '~/.agents/plugins/';
});

const workspacePathPreview = computed(() => {
  const ws = store.workspaceFolders.length > 0 ? store.workspaceFolders[0].path : '<Workspace>';
  if (effectiveRuntime.value === 'antigravity') return `${ws}/.agents/plugins/`;
  if (effectiveRuntime.value === 'codex') return `${ws}/.codex/plugins/`;
  return `${ws}/.opencode/plugins/`;
});

const selectRuntime = (runtime: TargetAgentRuntime) => {
  isDropdownOpen.value = false;
  store.promptRuntimeSwitch(runtime);
};

const handleClickOutside = (e: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isDropdownOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

const saveSettings = async () => {
  const update: Record<string, unknown> = {
    mirrorAcceleration: mirrorAcceleration.value,
    proxyUrl: proxyUrl.value.trim()
  };
  if (githubToken.value.trim()) update.githubToken = githubToken.value.trim();
  await bridge.invoke('updateSettings', update);
  await store.loadSettings();
  isSavedToast.value = true;
  setTimeout(() => {
    isSavedToast.value = false;
  }, 2000);
};

const openAddSourceModal = () => {
  store.editingSource = null;
  store.isSourceModalOpen = true;
};

const openEditSourceModal = (source: MarketplaceSourceConfig) => {
  store.editingSource = source;
  store.isSourceModalOpen = true;
};

const promptDeleteSource = (source: MarketplaceSourceConfig) => {
  sourceToDelete.value = source;
};

const confirmDeleteSource = async () => {
  if (!sourceToDelete.value) return;
  try {
    isDeleting.value = true;
    await bridge.invoke('removeSource', { sourceId: sourceToDelete.value.id });
    await store.loadSources();
  } catch (err) {
    console.error('Failed to remove source:', err);
  } finally {
    isDeleting.value = false;
    sourceToDelete.value = null;
  }
};

const toggleSourceState = async (source: MarketplaceSourceConfig) => {
  try {
    await bridge.invoke('toggleSource', {
      sourceId: source.id,
      enabled: !source.enabled
    });
    await store.loadSources();
  } catch (err) {
    console.error('Failed to toggle source:', err);
  }
};
</script>
