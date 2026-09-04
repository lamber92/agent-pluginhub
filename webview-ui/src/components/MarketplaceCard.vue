<template>
  <div class="glass-card rounded-xl p-4 flex flex-col justify-between group relative overflow-hidden border border-white/10 hover:border-indigo-500/30 transition-all duration-200 bg-white/[0.02]">
    <!-- Top Metadata -->
    <div>
      <div class="flex items-start justify-between gap-3">
        <!-- Title & Badges -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="text-base font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
              {{ plugin.name }}
            </h3>
          </div>

          <!-- Metadata Subtitle: Version, Author, Source & Category -->
          <div class="text-xs text-gray-400 flex items-center gap-2 mt-1 flex-wrap">
            <!-- Version Tag -->
            <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-gray-400 border border-white/10">
              {{ formatVersion(plugin.version, plugin.gitSha, plugin.gitTag) }}
            </span>
            <span class="text-gray-600">•</span>
            <span>by {{ plugin.author?.name || 'Community' }}</span>
            <span class="text-gray-600">•</span>
            <span class="text-indigo-400 font-medium">
              {{ plugin.sourceName || 'Anthropic Official Marketplace' }}
            </span>
            <template v-if="plugin.category">
              <span class="text-gray-600">•</span>
              <span class="text-gray-400">
                {{ formatCategory(plugin.category) }}
              </span>
            </template>
          </div>
        </div>

        <!-- Installed Status Badge -->
        <div class="shrink-0">
          <span
            v-if="plugin.installed && plugin.hasUpdate"
            class="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30"
          >
            <Sparkles class="w-3 h-3 text-amber-400 animate-pulse" />
            <span>{{ t('actions.hasUpdate') }}</span>
          </span>
          <span
            v-else-if="plugin.installed"
            class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
          >
            <Check class="w-3 h-3" />
            {{ t('actions.installed') }}
          </span>
        </div>
      </div>

      <!-- Description -->
      <p class="text-xs text-gray-300 line-clamp-2 my-2.5 leading-relaxed">
        {{ plugin.description || 'No description provided.' }}
      </p>

      <!-- Update Alert (Consistent with Installed View style) -->
      <div
        v-if="plugin.installed && plugin.hasUpdate"
        class="mb-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
      >
        <div class="flex items-center gap-1.5 text-xs text-amber-300 min-w-0">
          <Sparkles class="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
          <span class="truncate">{{ t('actions.upgradeTo') }} <strong class="font-mono text-white">{{ formatVersion(plugin.latestVersion) }}</strong></span>
        </div>
        <button
          @click="store.activeInstallPlugin = plugin"
          class="px-2.5 py-1 text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 rounded-md transition-all flex items-center gap-1 shrink-0 shadow-sm cursor-pointer"
        >
          <ArrowUpCircle class="w-3.5 h-3.5" />
          <span>{{ t('actions.updateNow') }}</span>
        </button>
      </div>

      <!-- Included Skills Pills (if bundled/multi-skills) -->
      <div v-if="plugin.skills && plugin.skills.length > 0" class="mb-2.5">
        <SkillsPopover :skills="plugin.skills" />
      </div>

      <!-- Tags -->
      <div v-if="plugin.tags && plugin.tags.length > 0" class="flex flex-wrap gap-1 mb-2">
        <span
          v-for="tag in plugin.tags.slice(0, 3)"
          :key="tag"
          class="text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-gray-400"
        >
          #{{ tag }}
        </span>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div class="flex items-center justify-between gap-2 pt-2.5 border-t border-white/5 mt-auto">
      <div class="text-[11px] text-gray-500">
        <span v-if="plugin.installed">
          {{
            plugin.installedScope === 'workspace'
              ? t('installedView.installedInWorkspace')
              : (plugin.installedScope === 'global' ? t('installedView.installedInGlobal') : t('installedView.installedInAgent'))
          }}
        </span>
      </div>

      <div class="flex items-center gap-1.5 ml-auto">
        <!-- Details Button -->
        <button
          @click="store.fetchSkillDetail(plugin)"
          :disabled="store.isDetailLoading"
          class="px-2.5 py-1 text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
        >
          <Loader2 v-if="store.isDetailLoading && store.activeDetailSkill?.name === plugin.name" class="w-3 h-3 animate-spin text-indigo-400" />
          <Info v-else class="w-3.5 h-3.5" />
          {{ t('actions.viewDetail') }}
        </button>

        <!-- Install / Reinstall Button (Only show if not updating) -->
        <button
          v-if="!plugin.installed || !plugin.hasUpdate"
          @click="store.activeInstallPlugin = plugin"
          :class="[
            'px-3 py-1 text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer',
            plugin.installed
              ? 'text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 font-medium'
              : 'text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-600/30 font-semibold'
          ]"
        >
          <Download class="w-3 h-3" />
          <span>{{ plugin.installed ? t('actions.reinstall') : t('actions.install') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check, Info, Download, Loader2, Sparkles, ArrowUpCircle, Layers } from 'lucide-vue-next';
import { MarketplacePlugin, useSkillStore, formatVersion } from '../stores/skillStore';
import { useI18n } from '../services/i18n';
import SkillsPopover from './SkillsPopover.vue';

defineProps<{
  plugin: MarketplacePlugin;
}>();

const store = useSkillStore();
const { t } = useI18n();

const formatCategory = (cat?: string) => {
  if (!cat) return '';
  const key = `categories.${cat}`;
  const val = t(key);
  return val && val !== key ? val : cat.charAt(0).toUpperCase() + cat.slice(1);
};
</script>
