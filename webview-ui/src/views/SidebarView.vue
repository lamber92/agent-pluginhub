<template>
  <div class="p-3 space-y-3 text-xs flex flex-col h-full overflow-hidden">
    <!-- Top Action Bar (Compact) -->
    <div class="flex items-center justify-between gap-1.5 pb-2 border-b border-white/10 shrink-0">
      <!-- Open Full Marketplace Button -->
      <button
        @click="openFullMarketplace('discover')"
        class="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 cursor-pointer"
        :title="t('sidebarView.openFull')"
      >
        <ShoppingBag class="w-3.5 h-3.5" />
        <span>{{ t('tabs.discover') }}</span>
      </button>

      <!-- Right Utility Actions -->
      <div class="flex items-center gap-1 shrink-0">
        <!-- Import ZIP Button -->
        <button
          @click="store.importZip('workspace')"
          class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
          :title="t('actions.importZip')"
        >
          <FolderDown class="w-3.5 h-3.5" />
        </button>

        <!-- Language Switch -->
        <button
          @click="toggleLanguage"
          class="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-[10px] font-semibold transition-colors cursor-pointer"
          title="Switch Language / 切换语言"
        >
          {{ lang === 'zh' ? 'EN' : '中文' }}
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="store.localSkills.length === 0"
      class="bg-black/20 border border-dashed border-white/10 rounded-xl p-5 text-center space-y-2.5 my-auto"
    >
      <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto text-gray-400">
        <PackageOpen class="w-5 h-5" />
      </div>
      <p class="text-xs text-gray-400">{{ t('sidebarView.empty') }}</p>
      <button
        @click="openFullMarketplace('discover')"
        class="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-all cursor-pointer"
      >
        {{ t('sidebarView.goToDiscover') }}
      </button>
    </div>

    <!-- In-Page Installed List Container -->
    <div v-else class="flex flex-col flex-1 overflow-hidden space-y-2">
      <!-- In-Page Section Header (已安装 放到页内) -->
      <div class="flex items-center justify-between px-0.5 pt-0.5 shrink-0">
        <div class="flex items-center gap-1.5 font-bold text-gray-200 text-xs">
          <Package class="w-4 h-4 text-indigo-400" />
          <span>{{ t('sidebarView.installedCount') }}</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold border border-indigo-500/30">
            {{ store.localSkills.length }}
          </span>
        </div>
      </div>

      <!-- Compact Local Skills List -->
      <div class="space-y-2 overflow-y-auto flex-1 pr-0.5">
        <div
          v-for="skill in store.localSkills"
          :key="skill.scope + '-' + skill.path"
          @click="openFullMarketplace('installed')"
          :class="[
            'bg-black/30 p-2.5 rounded-xl border transition-[border-color,opacity,background-color] duration-200 space-y-2 cursor-pointer hover:bg-white/[0.04] hover:border-indigo-500/30',
            skill.enabled
              ? 'border-white/5'
              : 'border-white/5 opacity-60'
          ]"
        >
          <!-- Skill Title & Toggle -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 min-w-0 flex-wrap">
              <!-- Scope Badge: WS (Blue), AGENT (Purple), GLOBAL (Emerald) -->
              <span
                :class="[
                  'text-[9px] px-1.5 py-0.2 rounded font-semibold shrink-0 uppercase border',
                  skill.scope === 'workspace'
                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/20'
                    : (skill.scope === 'global'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
                        : 'bg-purple-500/15 text-purple-300 border-purple-500/20')
                ]"
              >
                {{ skill.scope === 'workspace' ? 'WS' : (skill.scope === 'global' ? 'GLOBAL' : 'AGENT') }}
              </span>

                            <!-- Native Badge -->
              <span
                v-if="skill.isNative"
                class="text-[9px] px-1 py-0.2 rounded font-medium border shrink-0 bg-amber-500/10 text-amber-300 border-amber-500/20"
                :title="t('installedView.nativePluginTip')"
              >
                {{ t('badges.native') }}
              </span>

              <!-- Custom Badge -->
              <span
                v-if="skill.isCustom"
                class="text-[9px] px-1 py-0.2 rounded font-medium border shrink-0 bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
              >
                {{ t('badges.custom') }}
              </span>

              <span class="font-semibold text-white truncate text-xs" :title="skill.name">
                {{ skill.name }}
              </span>

              <!-- Version Tag -->
              <span class="text-[9px] font-mono px-1 py-0.2 rounded bg-white/5 text-gray-400">
                {{ formatVersion(skill.version, skill.gitSha, skill.gitTag) }}
              </span>
            </div>

            <!-- Static Status Indicator (🟢 Active / 🔴 Disabled) -->
            <span
              class="text-[11px] leading-none select-none shrink-0"
              :title="skill.enabled ? t('installedView.statusEnabled') : t('installedView.statusDisabled')"
            >
              {{ skill.enabled ? '🟢' : '🔴' }}
            </span>
          </div>

          <!-- Second Row: Skills Count Pill Popover + Description Snippet -->
          <div class="flex items-center gap-1.5 min-w-0">
            <!-- Skills Pill Popover -->
            <SkillsPopover
              v-if="skill.skills && skill.skills.length > 0"
              :skills="skill.skills"
              :compact="true"
              @click.stop
            />

            <!-- Description Snippet -->
            <p v-if="getValidDescription(skill)" class="text-[11px] text-gray-400 line-clamp-1 flex-1 min-w-0">
              {{ getValidDescription(skill) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ShoppingBag,
  Package,
  FolderDown,
  PackageOpen
} from 'lucide-vue-next';
import { LocalSkillItem, useSkillStore, formatVersion } from '../stores/skillStore';
import { useI18n } from '../services/i18n';
import { bridge } from '../services/bridgeClient';
import SkillsPopover from '../components/SkillsPopover.vue';

const store = useSkillStore();
const { t, lang, toggleLanguage } = useI18n();

const openFullMarketplace = async (tab = 'discover') => {
  await bridge.invoke('openFullMarketplace', { targetTab: tab });
};

const getValidDescription = (skill: LocalSkillItem) => {
  if (!skill.description) return '';
  const desc = skill.description.trim();
  if (
    desc.startsWith('Auto-generated description for') ||
    desc === 'No description provided' ||
    desc === 'Local Custom Skill'
  ) {
    return '';
  }
  return desc;
};
</script>
