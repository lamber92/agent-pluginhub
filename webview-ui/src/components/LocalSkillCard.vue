<template>
  <div
    :class="[
      'glass-card rounded-xl p-4 flex flex-col justify-between group relative overflow-hidden border transition-all duration-200',
      skill.enabled
        ? 'border-white/10 hover:border-indigo-500/30 bg-white/[0.02]'
        : 'border-white/5 bg-black/30 opacity-75'
    ]"
  >
    <!-- Top Header -->
    <div>
      <div class="flex items-start justify-between gap-3">
        <!-- Title & Badges -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="text-base font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
              {{ skill.name }}
            </h3>

            <!-- Scope Tag -->
            <span
              :class="[
                'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                skill.scope === 'workspace'
                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                  : (skill.scope === 'global' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-purple-500/10 text-purple-300 border-purple-500/20')
              ]"
            >
              {{ skill.scope === 'workspace' ? 'WORKSPACE' : (skill.scope === 'global' ? 'GLOBAL' : 'AGENT') }}
            </span>

            

                        <!-- Native / Built-in Badge -->
            <span
              v-if="skill.isNative"
              class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium"
              :title="t('installedView.nativePluginTip')"
            >
              {{ t('badges.native') }}
            </span>

            <!-- Custom Skill Badge -->
            <span
              v-if="skill.isCustom"
              class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium"
            >
              {{ t('badges.custom') }}
            </span>
          </div>

          <!-- Metadata Subtitle: Version, Source & Category -->
          <div class="text-xs text-gray-400 flex items-center gap-2 mt-1 flex-wrap">
            <!-- Version Tag -->
            <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-gray-400 border border-white/10">
              {{ formatVersion(skill.version, skill.gitSha, skill.gitTag) }}
            </span>

            <span class="text-gray-600">•</span>

            <span class="text-indigo-400 font-medium">
              {{ displaySourceName }}
            </span>

            <template v-if="categoryDisplayName">
              <span class="text-gray-600">•</span>
              <button
                @click.stop="filterByCategory"
                class="hover:text-indigo-300 hover:underline transition-colors cursor-pointer"
                :title="t('installedView.filterByCategory') + ': ' + categoryDisplayName"
              >
                {{ categoryDisplayName }}
              </button>
            </template>
          </div>
        </div>

        <!-- Toggle Switch for Managed Plugins, or Read-Only Badge for Unmanaged Skills -->
        <div v-if="skill.isManaged" class="flex items-center gap-2 shrink-0 pt-0.5">
          <span
            :class="[
              'text-xs font-medium',
              skill.enabled ? 'text-emerald-400' : 'text-gray-500'
            ]"
          >
            {{ skill.enabled ? t('installedView.statusEnabled') : t('installedView.statusDisabled') }}
          </span>
          <button
            @click="toggleState"
            :class="[
              'w-8 h-4.5 rounded-full transition-colors relative p-0.5 focus:outline-none shrink-0 cursor-pointer',
              skill.enabled ? 'bg-indigo-600' : 'bg-gray-700'
            ]"
            :title="skill.enabled ? t('settingsView.sourceToggleOn') : t('settingsView.sourceToggleOff')"
          >
            <span
              :class="[
                'w-3.5 h-3.5 bg-white rounded-full transition-transform block shadow-sm',
                skill.enabled ? 'translate-x-3.5' : 'translate-x-0'
              ]"
            />
          </button>
        </div>
        <div v-else class="flex items-center gap-1.5 shrink-0 pt-0.5">
          <span class="text-[10px] font-medium px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
            只读展示
          </span>
        </div>
      </div>

      <!-- Description -->
      <p v-if="displayDescription" class="text-xs text-gray-300 line-clamp-2 my-2.5 leading-relaxed">
        {{ displayDescription }}
      </p>

      <!-- Update Alert (Only for managed plugins with updates) -->
      <div
        v-if="skill.isManaged && skill.hasUpdate"
        class="mb-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
      >
        <div class="flex items-center gap-1.5 text-xs text-amber-300">
          <Sparkles class="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{{ t('actions.upgradeTo') }} <strong class="font-mono text-white">{{ formatVersion(skill.latestVersion) }}</strong></span>
        </div>
        <button
          @click="handleUpdateClick"
          class="px-2.5 py-1 text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 rounded-md transition-all flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <ArrowUpCircle class="w-3.5 h-3.5" />
          <span>{{ t('actions.updateNow') }}</span>
        </button>
      </div>

      <!-- Included Skills Pills (if bundled/multi-skills) -->
      <div v-if="effectiveSubSkills.length > 0" class="mb-2.5">
        <SkillsPopover :skills="effectiveSubSkills" />
      </div>

      <!-- Capability Tags -->
      <div v-if="skill.hasScripts || skill.hasMcp" class="flex items-center gap-1.5 mb-2">
        <span
          v-if="skill.hasScripts"
          class="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1"
        >
          <Terminal class="w-3 h-3" />
          scripts/
        </span>
        <span
          v-if="skill.hasMcp"
          class="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1"
        >
          <Cpu class="w-3 h-3" />
          mcp_config.json
        </span>
      </div>
    </div>

    <!-- Bottom Actions Toolbar -->
    <div class="flex items-center justify-between gap-2 pt-2.5 border-t border-white/5 mt-auto">
      <div class="flex items-center gap-1.5 text-gray-400">
        <!-- View Detail Drawer -->
        <button
          @click="store.fetchLocalSkillDetail(skill)"
          class="px-2.5 py-1 text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Info class="w-3.5 h-3.5" />
          <span>{{ t('actions.viewDetail') }}</span>
        </button>

        <!-- Open Folder -->
        <button
          @click="store.openInOS(skill.path)"
          class="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          :title="t('actions.revealInOS')"
        >
          <FolderOpen class="w-3.5 h-3.5" />
        </button>

        <!-- Export ZIP -->
        <button
          @click="store.exportZip(skill)"
          class="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          :title="t('actions.exportZip')"
        >
          <Archive class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Delete Button (Only for managed non-native plugins) -->
      <button
        v-if="skill.isManaged && !skill.isNative"
        @click="confirmDelete"
        class="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
        :title="t('actions.delete')"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Terminal,
  Cpu,
  FolderOpen,
  Archive,
  Trash2,
  Info,
  Sparkles,
  ArrowUpCircle,
  Layers
} from 'lucide-vue-next';
import { LocalSkillItem, MarketplacePlugin, useSkillStore, formatVersion } from '../stores/skillStore';
import { useI18n } from '../services/i18n';
import SkillsPopover from './SkillsPopover.vue';

const props = defineProps<{
  skill: LocalSkillItem;
}>();

const store = useSkillStore();
const { t } = useI18n();

const matchingPlugin = computed(() => {
  return store.marketplacePlugins.find(
    (p) => p.name.toLowerCase() === props.skill.name.toLowerCase()
  );
});

const effectiveSubSkills = computed(() => {
  const normalize = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) {
      return val
        .map((s) => (typeof s === 'string' ? s.trim() : (s as any)?.name?.trim()))
        .filter((s): s is string => !!s && !s.startsWith('.') && !s.includes('/'));
    }
    return [];
  };

  const direct = normalize(props.skill.skills);
  if (direct.length > 0) {
    return direct;
  }
  const matched = normalize(matchingPlugin.value?.skills);
  if (matched.length > 0) {
    return matched;
  }
  return [];
});

const displayDescription = computed(() => {
  const desc = props.skill.description?.trim();
  if (
    !desc ||
    desc.startsWith('Auto-generated description for') ||
    desc === 'No description provided' ||
    desc === 'Local Custom Skill'
  ) {
    return '';
  }
  return desc;
});

const displaySourceName = computed(() => {
  if (props.skill.isCustom) return t('installedView.customSkill');
  if (matchingPlugin.value?.sourceName) return matchingPlugin.value.sourceName;
  if (props.skill.sourceName && props.skill.sourceName !== '集市源' && props.skill.sourceName !== '官方集市') {
    return props.skill.sourceName;
  }
  return 'Anthropic Official Marketplace';
});

const categoryDisplayName = computed(() => {
  const cat = matchingPlugin.value?.category || (props.skill.isCustom ? 'custom' : '');
  if (!cat) return '';
  const key = `categories.${cat}`;
  const val = t(key);
  return val && val !== key ? val : cat.charAt(0).toUpperCase() + cat.slice(1);
});

const filterByCategory = () => {
  const cat = matchingPlugin.value?.category || (props.skill.isCustom ? 'custom' : '');
  if (cat) {
    store.installedCategoryFilter = cat;
  }
};

const toggleState = () => {
  store.toggleSkill(props.skill, !props.skill.enabled);
};

const confirmDelete = () => {
  store.deleteSkill(props.skill);
};

const handleUpdateClick = () => {
  const plugin = matchingPlugin.value;
  if (plugin) {
    store.activeInstallPlugin = plugin;
  } else {
    const fallbackPlugin: MarketplacePlugin = {
      name: props.skill.name,
      description: props.skill.description,
      version: props.skill.latestVersion || '1.0.0',
      source: `anthropics/claude-plugins-official`,
      sourceName: displaySourceName.value,
      installed: true,
      hasUpdate: true
    };
    store.activeInstallPlugin = fallbackPlugin;
  }
};
</script>
