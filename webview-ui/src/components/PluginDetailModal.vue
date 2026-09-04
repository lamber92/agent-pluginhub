<template>
  <div>
    <!-- Loading Modal -->
    <div
      v-if="store.isDetailLoading"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div class="glass-panel rounded-2xl p-6 flex items-center gap-3 border border-white/10 shadow-2xl">
        <Loader2 class="w-5 h-5 text-indigo-400 animate-spin" />
        <span class="text-xs text-gray-200 font-medium">{{ t('detail.loading') }}</span>
      </div>
    </div>

    <!-- Detail Drawer Modal -->
    <div
      v-if="store.activeDetailSkill && !store.isDetailLoading"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      @click.self="store.activeDetailSkill = null"
    >
      <div class="glass-panel w-full max-w-3xl max-h-[88vh] rounded-2xl flex flex-col shadow-2xl border border-white/10 overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm uppercase shrink-0">
              {{ store.activeDetailSkill.name.slice(0, 2) }}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-base font-bold text-white truncate">
                  {{ store.activeDetailSkill.name }}
                </h2>
                <!-- Version Badge -->
                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-gray-300 border border-white/10">
                  {{ formatVersion(latestVersion) }}
                </span>
                <!-- Scope Badge (if installed) -->
                <span
                  v-if="matchingLocalSkill"
                  :class="[
                    'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                    matchingLocalSkill.scope === 'workspace'
                        ? 'bg-blue-500/15 text-blue-300 border-blue-500/20'
                        : (matchingLocalSkill.scope === 'global' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' : 'bg-purple-500/15 text-purple-300 border-purple-500/20')
                  ]"
                >
                  {{ matchingLocalSkill.scope === 'workspace' ? 'WORKSPACE' : (matchingLocalSkill.scope === 'global' ? 'GLOBAL' : 'AGENT') }}
                </span>
                                <!-- Native Badge -->
                <span
                  v-if="matchingLocalSkill?.isNative || (store.activeDetailSkill as any)?.isNative"
                  class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20 flex items-center gap-1"
                  :title="t('installedView.nativePluginTip')"
                >
                  {{ t('badges.native') }}
                </span>
                <!-- Source Badge -->
                <span
                  class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20 flex items-center gap-1"
                >
                  <Globe class="w-3 h-3 text-blue-400" />
                  {{ detailSourceName }}
                </span>
              </div>
              <p class="text-xs text-gray-400 line-clamp-1 mt-0.5">
                {{ store.activeDetailSkill.description }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <!-- Inline Toggle Switch for Installed Managed Plugin, or Read-Only Tag for Unmanaged Skills -->
            <div v-if="matchingLocalSkill && matchingLocalSkill.isManaged" class="flex items-center gap-2 pr-2 border-r border-white/10">
              <span class="text-[11px] text-gray-400">
                {{ matchingLocalSkill.enabled ? t('installedView.statusEnabled') : t('installedView.statusDisabled') }}
              </span>
              <button
                @click="handleToggleSkill"
                :class="[
                  'w-8 h-4.5 rounded-full transition-colors relative p-0.5 shrink-0 focus:outline-none cursor-pointer',
                  matchingLocalSkill.enabled ? 'bg-indigo-600' : 'bg-gray-700'
                ]"
                :title="matchingLocalSkill.enabled ? t('settingsView.sourceToggleOn') : t('settingsView.sourceToggleOff')"
              >
                <span
                  :class="[
                    'w-3.5 h-3.5 bg-white rounded-full transition-transform block shadow',
                    matchingLocalSkill.enabled ? 'translate-x-3.5' : 'translate-x-0'
                  ]"
                />
              </button>
            </div>
            <div v-else-if="matchingLocalSkill" class="pr-2 border-r border-white/10">
              <span class="text-[10px] text-gray-500 font-medium px-1.5 py-0.5 rounded bg-white/5">
                只读展示
              </span>
            </div>

            <button
              @click="store.activeDetailSkill = null"
              class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Sub-Navigation Tabs (Only for Installed Plugins) -->
        <div v-if="isPluginInstalled" class="px-6 pt-3 border-b border-white/10 flex items-center gap-4 bg-white/[0.01]">
          <button
            @click="activeDetailTab = 'overview'"
            :class="[
              'pb-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer',
              activeDetailTab === 'overview'
                ? 'text-indigo-400 border-indigo-500'
                : 'text-gray-400 border-transparent hover:text-gray-200'
            ]"
          >
            <Layers class="w-3.5 h-3.5" />
            <span>{{ t('detail.tabOverview') }}</span>
          </button>
          <button
            @click="activeDetailTab = 'docs'"
            :class="[
              'pb-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer',
              activeDetailTab === 'docs'
                ? 'text-indigo-400 border-indigo-500'
                : 'text-gray-400 border-transparent hover:text-gray-200'
            ]"
          >
            <BookOpen class="w-3.5 h-3.5" />
            <span>{{ t('detail.tabDocs') }}</span>
          </button>
        </div>

        <!-- Body: Scrollable Content -->
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <!-- Update Available Alert Banner in Detail Modal -->
          <div
            v-if="hasUpdate"
            class="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3"
          >
            <div class="flex items-center gap-2.5">
              <Sparkles class="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
              <div class="text-xs">
                <div class="font-bold text-amber-300">{{ t('detail.updateAvailableTitle') }}</div>
                <div class="text-gray-300 mt-0.5">
                  {{ t('detail.installedVersionLabel') }}: <span class="font-mono text-white">{{ formatVersion(installedVersion) }}</span> ➔ {{ t('detail.latestVersionLabel') }}: <span class="font-mono text-amber-300 font-bold">{{ formatVersion(latestVersion) }}</span>
                </div>
              </div>
            </div>
            <button
              @click="handleInstallClick"
              class="px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 rounded-lg shadow-md shadow-orange-500/25 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <ArrowUpCircle class="w-3.5 h-3.5" />
              <span>{{ t('actions.updateNow') }}</span>
            </button>
          </div>

          <!-- TAB 1: OVERVIEW & SKILLS ROSTER (Installed Plugin Deep Inspector) -->
          <template v-if="isPluginInstalled && activeDetailTab === 'overview'">
            <!-- 1. Metadata Grid: Commit Hash, Timestamp, Path, Runtime -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <!-- Commit SHA Card -->
              <div class="bg-black/30 rounded-xl p-3.5 border border-white/5 space-y-1">
                <div class="text-gray-400 flex items-center justify-between">
                  <span class="flex items-center gap-1.5">
                    <GitCommit class="w-3.5 h-3.5 text-indigo-400" />
                    {{ t('detail.commitHash') }}
                  </span>
                  <button
                    v-if="effectiveCommitSha"
                    @click="copyText(effectiveCommitSha)"
                    class="text-[10px] text-gray-500 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                    :title="t('detail.copySuccess')"
                  >
                    <Copy class="w-3 h-3" />
                    <span>{{ isCopied ? t('detail.copySuccess') : 'Copy' }}</span>
                  </button>
                </div>
                <div class="font-mono text-white text-xs font-semibold truncate">
                  {{ effectiveCommitSha || 'N/A' }}
                </div>
              </div>

              <!-- Installed Time Card -->
              <div class="bg-black/30 rounded-xl p-3.5 border border-white/5 space-y-1">
                <div class="text-gray-400 flex items-center gap-1.5">
                  <Calendar class="w-3.5 h-3.5 text-indigo-400" />
                  <span>{{ t('detail.installedAt') }}</span>
                </div>
                <div class="font-mono text-white text-xs font-semibold">
                  {{ formattedInstalledDate }}
                </div>
              </div>

              <!-- Storage Path Card (Span 2) -->
              <div class="bg-black/30 rounded-xl p-3.5 border border-white/5 space-y-1.5 sm:col-span-2">
                <div class="text-gray-400 flex items-center justify-between">
                  <span class="flex items-center gap-1.5">
                    <Folder class="w-3.5 h-3.5 text-indigo-400" />
                    {{ t('detail.localPath') }}
                  </span>
                  <div class="flex items-center gap-2">
                    <button
                      v-if="effectiveLocalPath"
                      @click="copyText(effectiveLocalPath)"
                      class="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Copy class="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                    <button
                      v-if="effectiveLocalPath"
                      @click="store.openInOS(effectiveLocalPath)"
                      class="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <FolderOpen class="w-3 h-3" />
                      <span>{{ t('detail.revealInFolder') }}</span>
                    </button>
                  </div>
                </div>
                <div class="font-mono text-gray-200 text-xs break-all bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5 select-all">
                  {{ effectiveLocalPath || 'N/A' }}
                </div>
              </div>
            </div>

            <!-- 2. Included Skills Roster & Summaries -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <Layers class="w-4 h-4 text-indigo-400" />
                  <span>{{ t('detail.skillsRoster') }}</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                    {{ effectiveSkillItems.length }}
                  </span>
                </h3>
              </div>

              <!-- Skill Item Cards -->
              <div class="space-y-2">
                <div
                  v-for="(sub, idx) in effectiveSkillItems"
                  :key="sub.name"
                  class="bg-black/30 rounded-xl p-3.5 border border-white/5 hover:border-indigo-500/30 transition-all flex items-start justify-between gap-3"
                >
                  <div class="space-y-1 min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <span class="font-bold text-white font-mono text-xs">{{ sub.name }}</span>
                      <span class="text-[9px] font-mono text-gray-500">#{{ idx + 1 }}</span>
                    </div>
                    <p class="text-xs text-gray-400 leading-relaxed">
                      {{ sub.description }}
                    </p>
                  </div>

                  <!-- Preview SKILL.md in Editor (Readonly Markdown View) -->
                  <button
                    v-if="sub.path"
                    @click="handleOpenSubSkill(sub.path)"
                    class="px-2.5 py-1 text-[11px] font-medium text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                    :title="t('detail.openInEditor')"
                  >
                    <Eye class="w-3.5 h-3.5 text-indigo-400" />
                    <span>{{ t('detail.openInEditor') }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 3. Capabilities & Security Section -->
            <div class="space-y-3">
              <!-- MCP Tools -->
              <div
                v-if="store.activeDetailSkill.hasMcp"
                class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3.5 text-blue-200 text-xs flex items-center gap-2.5"
              >
                <Cpu class="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <span class="font-semibold">{{ t('detail.mcpIncluded') }}</span>
                  <p class="text-[11px] text-blue-300/80 mt-0.5">
                    {{ store.activeDetailSkill.mcpConfig ? Object.keys(store.activeDetailSkill.mcpConfig).join(', ') : 'Model Context Protocol server registered' }}
                  </p>
                </div>
              </div>

              <!-- Scripts Audit -->
              <div
                v-if="store.activeDetailSkill.hasScripts && store.activeDetailSkill.warningScripts && store.activeDetailSkill.warningScripts.length > 0"
                class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-amber-200 text-xs flex items-start gap-3"
              >
                <AlertTriangle class="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div class="space-y-1">
                  <div class="font-semibold text-amber-300">{{ t('detail.scriptsDetected') }}</div>
                  <p class="text-amber-200/80">{{ t('detail.scriptsWarning') }}</p>
                  <ul class="list-disc pl-4 space-y-0.5 text-[11px] text-amber-300/90">
                    <li v-for="(warn, idx) in store.activeDetailSkill.warningScripts" :key="idx">
                      {{ warn }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </template>

          <!-- TAB 2: DOCUMENTATION (Markdown Body) / Marketplace Default View -->
          <template v-else>
            <!-- Security Audit Warning Banner -->
            <div
              v-if="store.activeDetailSkill.hasScripts && store.activeDetailSkill.warningScripts && store.activeDetailSkill.warningScripts.length > 0"
              class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-amber-200 text-xs flex items-start gap-3"
            >
              <AlertTriangle class="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div class="space-y-1">
                <div class="font-semibold text-amber-300">{{ t('detail.scriptsDetected') }}</div>
                <p class="text-amber-200/80">{{ t('detail.scriptsWarning') }}</p>
                <ul class="list-disc pl-4 space-y-0.5 text-[11px] text-amber-300/90">
                  <li v-for="(warn, idx) in store.activeDetailSkill.warningScripts" :key="idx">
                    {{ warn }}
                  </li>
                </ul>
              </div>
            </div>

            <!-- MCP Badge Info -->
            <div
              v-if="store.activeDetailSkill.hasMcp"
              class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-blue-200 text-xs flex items-center gap-2.5"
            >
              <Cpu class="w-4 h-4 text-blue-400 shrink-0" />
              <span>{{ t('detail.mcpIncluded') }}</span>
            </div>

            <!-- YAML Frontmatter Meta Card -->
            <div
              v-if="Object.keys(store.activeDetailSkill.frontmatter).length > 0"
              class="bg-black/30 rounded-xl p-3.5 border border-white/5 space-y-2 text-xs"
            >
              <div class="font-semibold text-gray-300 flex items-center gap-1.5">
                <FileCode class="w-4 h-4 text-indigo-400" />
                <span>YAML Frontmatter Metadata</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div v-for="(val, key) in store.activeDetailSkill.frontmatter" :key="key" class="truncate">
                  <span class="text-gray-400">{{ key }}: </span>
                  <span class="text-gray-200 font-mono">{{ val }}</span>
                </div>
              </div>
            </div>

            <!-- Markdown Documentation Body -->
            <div>
              <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BookOpen class="w-3.5 h-3.5" />
                {{ t('detail.readDocumentation') }}
              </h3>
              <div class="markdown-body bg-black/20 p-4 rounded-xl border border-white/5" @click="handleMarkdownClick" v-html="renderedMarkdown"></div>
            </div>
          </template>
        </div>

        <!-- Footer Actions -->
        <div class="px-6 py-3.5 border-t border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div class="text-xs text-gray-400 flex items-center gap-3">
            <span v-if="store.activeDetailSkill.author">by {{ store.activeDetailSkill.author }}</span>
            <button
              v-if="store.activeDetailSkill.homepage"
              type="button"
              @click="store.openExternal(store.activeDetailSkill.homepage)"
              class="text-indigo-400 hover:underline flex items-center gap-1"
            >
              <ExternalLink class="w-3 h-3" />
              Homepage
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button
              @click="store.activeDetailSkill = null"
              class="px-3.5 py-1.5 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              {{ t('actions.cancel') }}
            </button>

            <!-- Case 1: Update Available -->
            <button
              v-if="isPluginInstalled && hasUpdate"
              @click="handleInstallClick"
              class="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-md shadow-orange-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowUpCircle class="w-3.5 h-3.5" />
              <span>{{ t('actions.upgradeTo') }} {{ formatVersion(latestVersion) }}</span>
            </button>

            <!-- Case 2: Already installed and up to date -->
            <button
              v-else-if="isPluginInstalled"
              @click="handleInstallClick"
              class="px-4 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download class="w-3.5 h-3.5" />
              <span>{{ t('actions.reinstall') }}</span>
            </button>

            <!-- Case 3: Not installed -->
            <button
              v-else
              @click="handleInstallClick"
              class="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download class="w-3.5 h-3.5" />
              <span>{{ t('actions.install') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  X,
  AlertTriangle,
  Cpu,
  FileCode,
  BookOpen,
  ExternalLink,
  Download,
  Loader2,
  Sparkles,
  ArrowUpCircle,
  Globe,
  Layers,
  GitCommit,
  Calendar,
  Folder,
  FolderOpen,
  Copy,
  Eye
} from 'lucide-vue-next';
import MarkdownIt from 'markdown-it';
import { useSkillStore, formatVersion } from '../stores/skillStore';
import { useI18n } from '../services/i18n';
import { SubSkillItem } from '../types';

const store = useSkillStore();
const { t } = useI18n();

const activeDetailTab = ref<'overview' | 'docs'>('overview');
const isCopied = ref(false);

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
});

const renderedMarkdown = computed(() => {
  if (!store.activeDetailSkill) return '';
  return md.render(store.activeDetailSkill.content || 'No content found.');
});

const handleMarkdownClick = (event: MouseEvent) => {
  const anchor = (event.target as HTMLElement).closest('a');
  if (!anchor) return;
  event.preventDefault();
  const href = anchor.getAttribute('href');
  if (href) store.openExternal(href).catch(console.error);
};

const matchingPlugin = computed(() => {
  if (!store.activeDetailSkill) return null;
  return store.marketplacePlugins.find(
    (p) => p.name.toLowerCase() === store.activeDetailSkill?.name.toLowerCase()
  );
});

const matchingLocalSkill = computed(() => {
  if (!store.activeDetailSkill) return null;
  if (store.activeDetailSkill.path) {
    const exact = store.localSkills.find((s) => s.path === store.activeDetailSkill?.path);
    if (exact) return exact;
  }
  return store.localSkills.find(
    (s) => s.name.toLowerCase() === store.activeDetailSkill?.name.toLowerCase() &&
      (!matchingPlugin.value?.installedScope || s.scope === matchingPlugin.value.installedScope)
  );
});

const isPluginInstalled = computed(() => !!matchingLocalSkill.value);

const detailSkills = computed(() => {
  if (store.activeDetailSkill?.skills && store.activeDetailSkill.skills.length > 0) {
    return store.activeDetailSkill.skills;
  }
  if (matchingPlugin.value?.skills && matchingPlugin.value.skills.length > 0) {
    return matchingPlugin.value.skills;
  }
  if (matchingLocalSkill.value?.skills && matchingLocalSkill.value.skills.length > 0) {
    return matchingLocalSkill.value.skills;
  }
  return [];
});

const effectiveSkillItems = computed<SubSkillItem[]>(() => {
  if (store.activeDetailSkill?.skillItems && store.activeDetailSkill.skillItems.length > 0) {
    return store.activeDetailSkill.skillItems;
  }
  // Fallback to name map if no deep items
  return detailSkills.value.map((skillName) => ({
    name: skillName,
    description: `Sub-skill component of ${store.activeDetailSkill?.name || 'plugin'}.`,
    path: matchingLocalSkill.value ? `${matchingLocalSkill.value.path}/skills/${skillName}/SKILL.md` : ''
  }));
});

const effectiveCommitSha = computed(() => {
  if (matchingLocalSkill.value?.gitSha) return matchingLocalSkill.value.gitSha;
  if (store.activeDetailSkill?.gitSha) return store.activeDetailSkill.gitSha;
  if (matchingLocalSkill.value?.version?.startsWith('git:')) {
    return matchingLocalSkill.value.version.replace(/^git:/, '');
  }
  return '';
});

const effectiveLocalPath = computed(() => {
  return matchingLocalSkill.value?.path || store.activeDetailSkill?.path || '';
});

const formattedInstalledDate = computed(() => {
  const ts = store.activeDetailSkill?.installedAt || matchingLocalSkill.value?.installedAt || matchingLocalSkill.value?.updatedAt;
  if (!ts) return 'N/A';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
});

const detailSourceName = computed(() => {
  if (matchingPlugin.value?.sourceName) return matchingPlugin.value.sourceName;
  if (matchingLocalSkill.value?.sourceName) return matchingLocalSkill.value.sourceName;
  if (store.activeDetailSkill?.sourceName) return store.activeDetailSkill.sourceName;
  return t('sources.official');
});

const hasUpdate = computed(() => {
  if (!matchingLocalSkill.value) return false;
  if (matchingPlugin.value?.hasUpdate) return true;
  if (matchingLocalSkill.value?.hasUpdate) return true;
  return false;
});

const installedVersion = computed(() => matchingLocalSkill.value?.version || '1.0.0');
const latestVersion = computed(() => matchingPlugin.value?.version || store.activeDetailSkill?.version || '1.0.0');

const copyText = (text: string) => {
  navigator.clipboard.writeText(text);
  isCopied.value = true;
  setTimeout(() => {
    isCopied.value = false;
  }, 2000);
};

const handleToggleSkill = async () => {
  if (!matchingLocalSkill.value) return;
  await store.toggleSkill(matchingLocalSkill.value, !matchingLocalSkill.value.enabled);
};

const handleOpenSubSkill = async (filePath?: string) => {
  if (!filePath) return;
  await store.openInEditor(filePath);
  store.activeDetailSkill = null;
};

const handleInstallClick = () => {
  if (!store.activeDetailSkill) return;
  const plugin = matchingPlugin.value || {
    name: store.activeDetailSkill.name,
    description: store.activeDetailSkill.description,
    version: latestVersion.value,
    gitSha: store.activeDetailSkill.gitSha,
    source: store.activeDetailSkill.sourceUrl || '',
    sourceName: detailSourceName.value,
    installed: isPluginInstalled.value,
    hasUpdate: hasUpdate.value
  };
  store.activeInstallPlugin = plugin;
  store.activeDetailSkill = null;
};
</script>
