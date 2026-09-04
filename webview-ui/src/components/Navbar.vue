<template>
  <header class="sticky top-0 z-40 glass-panel border-b border-white/10 px-4 py-3">
    <!-- Top Row: Brand & Main Navigation -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <PluginHubLogo size="lg" />
        <div>
          <h1 class="text-base font-bold tracking-tight text-white flex items-center gap-2">
            {{ t('title') }}
            <span class="text-[9.5px] leading-none uppercase font-semibold px-1.5 py-[2px] rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0 inline-flex items-center">
              v0.1.0
            </span>
          </h1>
          <p class="text-xs text-gray-400 hidden sm:block">{{ t('subtitle') }}</p>
        </div>
      </div>

      <!-- Tab Switcher -->
      <nav class="flex items-center bg-black/30 p-1 rounded-xl border border-white/5">
        <button
          v-for="tab in tabList"
          :key="tab.id"
          @click="store.activeTab = tab.id"
          :class="[
            'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer',
            store.activeTab === tab.id
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
          ]"
        >
          <component :is="tab.icon" class="w-3.5 h-3.5" />
          {{ t(`tabs.${tab.id}`) }}
          <span
            v-if="tab.id === 'installed' && store.localSkills.length > 0"
            class="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-semibold"
          >
            {{ store.localSkills.length }}
          </span>
        </button>
      </nav>

      <!-- Utility Actions (Runtime Capsule, Refresh, Lang) -->
      <div class="flex items-center gap-2.5">
        <!-- Agent Runtime Capsule (Glassmorphic Pill Dropdown) -->
        <div class="relative" ref="runtimeMenuRef">
          <button
            type="button"
            @click.stop="toggleRuntimeMenu"
            :disabled="store.isSwitchingRuntime"
            :class="[
              'flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all shadow-sm group',
              store.isSwitchingRuntime
                ? 'bg-white/5 border-indigo-500/30 opacity-80 cursor-not-allowed'
                : 'bg-black/40 hover:bg-white/10 border-white/10 hover:border-white/20 cursor-pointer'
            ]"
            :title="store.isSwitchingRuntime ? '正在切换环境并重新扫描数据...' : t('runtimes.title')"
          >
            <div class="w-4 h-4 flex items-center justify-center shrink-0">
              <Bot v-if="store.targetAgentRuntime === 'auto'" class="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <img v-else-if="store.targetAgentRuntime === 'antigravity'" :src="antigravityIcon" alt="Antigravity" class="w-3.5 h-3.5 object-contain shrink-0" />
              <img v-else-if="store.targetAgentRuntime === 'opencode'" :src="opencodeIcon" alt="OpenCode" class="w-3.5 h-3.5 object-contain rounded-sm shrink-0" />
              <img v-else-if="store.targetAgentRuntime === 'codex'" :src="codexIcon" alt="OpenAI Codex" class="w-3.5 h-3.5 object-contain shrink-0" />
            </div>

            <div class="flex items-center gap-1.5 text-xs text-gray-200">
              <span class="text-gray-400 text-[11px] hidden sm:inline">Agent:</span>
              <span class="text-white font-semibold flex items-center gap-1">
                <template v-if="store.targetAgentRuntime === 'auto'">
                  {{ store.effectiveAgentRuntime === 'antigravity' ? 'Antigravity' : (store.effectiveAgentRuntime === 'codex' ? 'Codex' : 'OpenCode') }}
                  <span class="text-[10px] text-indigo-300 font-normal ml-0.5">(Auto)</span>
                </template>
                <template v-else-if="store.targetAgentRuntime === 'antigravity'">Google Antigravity</template>
                <template v-else-if="store.targetAgentRuntime === 'opencode'">OpenCode</template>
                <template v-else-if="store.targetAgentRuntime === 'codex'">OpenAI Codex</template>
                <span v-if="store.isSwitchingRuntime" class="text-[10px] text-indigo-300 font-normal animate-pulse">
                  (加载中...)
                </span>
              </span>
            </div>

            <Loader2 v-if="store.isSwitchingRuntime" class="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
            <ChevronDown
              v-else
              class="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-transform duration-200"
              :class="{ 'rotate-180 text-white': isRuntimeMenuOpen }"
            />
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="isRuntimeMenuOpen"
            @click.stop
            class="absolute right-0 top-full mt-1.5 z-50 min-w-full w-max max-w-[280px] bg-[#161622] border border-white/15 rounded-xl shadow-2xl overflow-hidden py-1 divide-y divide-white/5 animate-fade-in"
          >
            <button
              type="button"
              @click="handleSelectRuntime('auto')"
              class="w-full px-3 py-2 text-left transition-colors flex items-center justify-between gap-2 hover:bg-white/10 cursor-pointer"
              :class="{ 'bg-indigo-600/20': store.targetAgentRuntime === 'auto' }"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-4 h-4 flex items-center justify-center shrink-0">
                  <Bot class="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div class="min-w-0">
                  <div class="text-xs text-white font-medium">{{ t('runtimes.auto') }}</div>
                  <div class="text-[10px] text-gray-400 truncate">当前探测: {{ store.effectiveAgentRuntime === 'antigravity' ? 'Antigravity' : 'OpenCode' }}</div>
                </div>
              </div>
              <Check v-if="store.targetAgentRuntime === 'auto'" class="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            </button>

            <button
              type="button"
              @click="handleSelectRuntime('antigravity')"
              class="w-full px-3 py-2 text-left transition-colors flex items-center justify-between gap-2 hover:bg-white/10 cursor-pointer"
              :class="{ 'bg-blue-600/20': store.targetAgentRuntime === 'antigravity' }"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-4 h-4 flex items-center justify-center shrink-0">
                  <img :src="antigravityIcon" alt="Antigravity" class="w-3.5 h-3.5 object-contain" />
                </div>
                <span class="text-xs text-white font-medium">Google Antigravity</span>
              </div>
              <Check v-if="store.targetAgentRuntime === 'antigravity'" class="w-3.5 h-3.5 text-blue-400 shrink-0" />
            </button>

            <button
              type="button"
              @click="handleSelectRuntime('opencode')"
              class="w-full px-3 py-2 text-left transition-colors flex items-center justify-between gap-2 hover:bg-white/10 cursor-pointer"
              :class="{ 'bg-orange-600/20': store.targetAgentRuntime === 'opencode' }"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-4 h-4 flex items-center justify-center shrink-0">
                  <img :src="opencodeIcon" alt="OpenCode" class="w-3.5 h-3.5 object-contain rounded-sm" />
                </div>
                <span class="text-xs text-white font-medium">OpenCode</span>
              </div>
              <Check v-if="store.targetAgentRuntime === 'opencode'" class="w-3.5 h-3.5 text-orange-400 shrink-0" />
            </button>

            <button
              type="button"
              @click="handleSelectRuntime('codex')"
              class="w-full px-3 py-2 text-left transition-colors flex items-center justify-between gap-2 hover:bg-white/10 cursor-pointer"
              :class="{ 'bg-emerald-600/20': store.targetAgentRuntime === 'codex' }"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-4 h-4 flex items-center justify-center shrink-0">
                  <img :src="codexIcon" alt="OpenAI Codex" class="w-3.5 h-3.5 object-contain" />
                </div>
                <span class="text-xs text-white font-medium">OpenAI Codex</span>
              </div>
              <Check v-if="store.targetAgentRuntime === 'codex'" class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </button>
          </div>
        </div>

        <button
          @click="handleRefresh"
          :disabled="store.isLoading"
          class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          :title="t('actions.refresh')"
        >
          <RefreshCw :class="['w-4 h-4', store.isLoading ? 'animate-spin text-indigo-400' : '']" />
        </button>

        <button
          @click="toggleLanguage"
          class="px-2 py-1 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          title="Switch Language / 切换语言"
        >
          {{ lang === 'zh' ? 'EN' : '中文' }}
        </button>
      </div>
    </div>

    <!-- Bottom Row 1: Installed View Filter Bar -->
    <div v-if="store.activeTab === 'installed'" class="mt-3 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5 relative z-20">
      <!-- Search Input -->
      <div class="relative flex-1 min-w-[180px] max-w-xs">
        <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="store.installedSearchQuery"
          type="text"
          :placeholder="t('searchInstalledPlaceholder')"
          class="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
        />
        <button
          v-if="store.installedSearchQuery"
          @click="store.installedSearchQuery = ''"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Filters: Status, Scope, Category (No overflow-x-auto to prevent vertical dropdown clipping) -->
      <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <!-- Status Filter Tabs (全部 / 生效中 / 已禁用 / 有更新) -->
        <div class="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/10 shrink-0">
          <button
            v-for="st in statusFilters"
            :key="st.id"
            @click="store.installedStatusFilter = st.id"
            :class="[
              'px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
              store.installedStatusFilter === st.id
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-gray-400 hover:text-gray-200'
            ]"
          >
            {{ t(`statusFilter.${st.id}`) }}
          </button>
        </div>

        <!-- Custom Glassmorphic Scope Filter Dropdown -->
        <div class="relative shrink-0" ref="scopeMenuRef">
          <button
            type="button"
            @click.stop="toggleScopeMenu"
            class="w-[130px] flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/40 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer text-xs text-gray-200 hover:text-white shadow-sm"
            :title="t(`scopeFilter.${store.installedScopeFilter}`)"
          >
            <span class="truncate text-left">{{ t(`scopeFilter.${store.installedScopeFilter}`) }}</span>
            <ChevronDown
              class="w-3.5 h-3.5 text-gray-400 transition-transform duration-200 shrink-0"
              :class="{ 'rotate-180 text-white': isScopeMenuOpen }"
            />
          </button>

          <!-- Dropdown List -->
          <div
            v-if="isScopeMenuOpen"
            @click.stop
            class="absolute left-0 sm:right-0 sm:left-auto top-full mt-1.5 z-50 min-w-full w-max max-w-[240px] bg-[#161622] border border-white/15 rounded-xl shadow-2xl overflow-hidden py-1 divide-y divide-white/5 animate-fade-in"
          >
            <button
              v-for="sc in scopeOptions"
              :key="sc.id"
              type="button"
              @click="store.installedScopeFilter = sc.id; isScopeMenuOpen = false"
              class="w-full px-3 py-2 text-left transition-colors flex items-center justify-between gap-2 hover:bg-white/10 cursor-pointer text-xs"
              :class="{ 'bg-indigo-600/20 text-white font-semibold': store.installedScopeFilter === sc.id, 'text-gray-300': store.installedScopeFilter !== sc.id }"
            >
              <span class="whitespace-nowrap">{{ t(`scopeFilter.${sc.id}`) }}</span>
              <Check v-if="store.installedScopeFilter === sc.id" class="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            </button>
          </div>
        </div>

        <!-- Custom Glassmorphic Category Filter Dropdown -->
        <div class="relative shrink-0" ref="categoryMenuRef">
          <button
            type="button"
            @click.stop="toggleCategoryMenu"
            class="w-[110px] flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/40 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer text-xs text-gray-200 hover:text-white shadow-sm"
            :title="t(`categories.${store.installedCategoryFilter}`)"
          >
            <span class="truncate text-left">{{ t(`categories.${store.installedCategoryFilter}`) }}</span>
            <ChevronDown
              class="w-3.5 h-3.5 text-gray-400 transition-transform duration-200 shrink-0"
              :class="{ 'rotate-180 text-white': isCategoryMenuOpen }"
            />
          </button>

          <!-- Dropdown List -->
          <div
            v-if="isCategoryMenuOpen"
            @click.stop
            class="absolute right-0 top-full mt-1.5 z-50 min-w-full w-max max-w-[240px] bg-[#161622] border border-white/15 rounded-xl shadow-2xl overflow-hidden py-1 divide-y divide-white/5 animate-fade-in"
          >
            <button
              v-for="cat in categories"
              :key="cat.id"
              type="button"
              @click="store.installedCategoryFilter = cat.id; isCategoryMenuOpen = false"
              class="w-full px-3 py-2 text-left transition-colors flex items-center justify-between gap-2 hover:bg-white/10 cursor-pointer text-xs"
              :class="{ 'bg-indigo-600/20 text-white font-semibold': store.installedCategoryFilter === cat.id, 'text-gray-300': store.installedCategoryFilter !== cat.id }"
            >
              <span class="whitespace-nowrap">{{ t(`categories.${cat.id}`) }}</span>
              <Check v-if="store.installedCategoryFilter === cat.id" class="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Bottom Row 2: Discover / Marketplace View Filter Bar -->
    <div v-if="store.activeTab === 'discover'" class="mt-3 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5 relative z-20">
      <!-- Search Input -->
      <div class="relative flex-1 min-w-[200px] max-w-sm">
        <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="store.searchQuery"
          type="text"
          :placeholder="t('searchPlaceholder')"
          class="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
        />
        <button
          v-if="store.searchQuery"
          @click="store.searchQuery = ''"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Categories Filter Tabs -->
      <div class="flex items-center gap-1.5 flex-wrap sm:flex-nowrap overflow-x-auto pb-1 sm:pb-0">
        <button
          v-for="cat in categories"
          :key="cat.id"
          @click="store.selectedCategory = cat.id"
          :class="[
            'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
            store.selectedCategory === cat.id
              ? 'bg-indigo-600 text-white shadow-sm font-semibold'
              : 'bg-black/30 hover:bg-white/10 text-gray-400 hover:text-gray-200 border border-white/5'
          ]"
        >
          {{ t(`categories.${cat.id}`) }}
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  ShoppingBag,
  Package,
  Settings,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  Bot,
  Loader2,
  Check
} from 'lucide-vue-next';
import { useSkillStore } from '../stores/skillStore';
import { useI18n } from '../services/i18n';
import { antigravityIcon, opencodeIcon, codexIcon } from '../assets/icons/runtimeIcons';
import { TargetAgentRuntime } from '../types';
import PluginHubLogo from './PluginHubLogo.vue';

const store = useSkillStore();
const { t, lang, toggleLanguage } = useI18n();

const isRuntimeMenuOpen = ref(false);
const runtimeMenuRef = ref<HTMLElement | null>(null);

const isScopeMenuOpen = ref(false);
const scopeMenuRef = ref<HTMLElement | null>(null);

const isCategoryMenuOpen = ref(false);
const categoryMenuRef = ref<HTMLElement | null>(null);

const toggleRuntimeMenu = () => {
  if (store.isSwitchingRuntime) return;
  isRuntimeMenuOpen.value = !isRuntimeMenuOpen.value;
  isScopeMenuOpen.value = false;
  isCategoryMenuOpen.value = false;
};

const toggleScopeMenu = () => {
  isScopeMenuOpen.value = !isScopeMenuOpen.value;
  isRuntimeMenuOpen.value = false;
  isCategoryMenuOpen.value = false;
};

const toggleCategoryMenu = () => {
  isCategoryMenuOpen.value = !isCategoryMenuOpen.value;
  isRuntimeMenuOpen.value = false;
  isScopeMenuOpen.value = false;
};

const handleSelectRuntime = (runtime: TargetAgentRuntime) => {
  isRuntimeMenuOpen.value = false;
  store.promptRuntimeSwitch(runtime);
};

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as Node;
  if (runtimeMenuRef.value && !runtimeMenuRef.value.contains(target)) {
    isRuntimeMenuOpen.value = false;
  }
  if (scopeMenuRef.value && !scopeMenuRef.value.contains(target)) {
    isScopeMenuOpen.value = false;
  }
  if (categoryMenuRef.value && !categoryMenuRef.value.contains(target)) {
    isCategoryMenuOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

const tabList = [
  { id: 'installed' as const, icon: Package },
  { id: 'discover' as const, icon: ShoppingBag },
  { id: 'settings' as const, icon: Settings }
];

const statusFilters = [
  { id: 'all' as const },
  { id: 'enabled' as const },
  { id: 'disabled' as const },
  { id: 'hasUpdate' as const }
];

const scopeOptions = [
  { id: 'all' as const },
  { id: 'workspace' as const },
  { id: 'global' as const }
];

const categories = [
  { id: 'all' },
  { id: 'development' },
  { id: 'productivity' },
  { id: 'data' },
  { id: 'devops' },
  { id: 'security' },
  { id: 'custom' }
];

const handleRefresh = async () => {
  await store.loadMarketplace(true);
  await store.loadLocalSkills();
};
</script>
