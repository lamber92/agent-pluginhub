<template>
  <div class="space-y-5">
    <!-- Local Skills List Grouped by 3-Tier Scopes -->
    <div class="space-y-5">
      <!-- 1. Workspace Scope Section (Always displayed; default collapsed if 0 items) -->
      <section v-if="store.installedScopeFilter === 'all' || store.installedScopeFilter === 'workspace'" class="space-y-3">
        <div
          @click="toggleWorkspaceCollapse"
          class="flex items-center justify-between cursor-pointer select-none py-1.5 px-1 group"
        >
          <h3 class="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <ChevronDown
              class="w-4 h-4 text-gray-400 transition-transform duration-200"
              :class="{ '-rotate-90': effectiveWorkspaceCollapsed }"
            />
            <span>{{ t('installedView.workspaceTitle') }}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono font-bold">
              {{ store.filteredWorkspaceSkills.length }}
            </span>
          </h3>
          <span class="text-[11px] text-gray-500 group-hover:text-gray-300 transition-colors">
            {{ effectiveWorkspaceCollapsed ? t('installedView.expandSection') : t('installedView.collapseSection') }}
          </span>
        </div>

        <div v-show="!effectiveWorkspaceCollapsed" class="space-y-3">
          <div
            v-if="store.filteredWorkspaceSkills.length === 0"
            class="bg-black/20 border border-dashed border-white/10 rounded-xl p-6 text-center space-y-2"
          >
            <p class="text-xs text-gray-400">{{ t('installedView.emptyWorkspace') }}</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <LocalSkillCard
              v-for="skill in store.filteredWorkspaceSkills"
              :key="skill.scope + '-' + skill.name"
              :skill="skill"
            />
          </div>
        </div>
      </section>

      <!-- 2. AI Agent Scope Section (Displayed when supported or has items; default collapsed if 0 items) -->
      <section v-if="isAgentSectionVisible" class="space-y-3">
        <div
          @click="toggleAgentCollapse"
          class="flex items-center justify-between cursor-pointer select-none py-1.5 px-1 group"
        >
          <h3 class="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <ChevronDown
              class="w-4 h-4 text-gray-400 transition-transform duration-200"
              :class="{ '-rotate-90': effectiveAgentCollapsed }"
            />
            <span>{{ t('installedView.agentTitle') }}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold">
              {{ store.filteredAgentSkills.length }}
            </span>
          </h3>
          <span class="text-[11px] text-gray-500 group-hover:text-gray-300 transition-colors">
            {{ effectiveAgentCollapsed ? t('installedView.expandSection') : t('installedView.collapseSection') }}
          </span>
        </div>

        <div v-show="!effectiveAgentCollapsed" class="space-y-3">
          <div
            v-if="store.filteredAgentSkills.length === 0"
            class="bg-black/20 border border-dashed border-white/10 rounded-xl p-6 text-center space-y-2"
          >
            <p class="text-xs text-gray-400">{{ t('installedView.emptyAgent') }}</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <LocalSkillCard
              v-for="skill in store.filteredAgentSkills"
              :key="skill.scope + '-' + skill.name"
              :skill="skill"
            />
          </div>
        </div>
      </section>

      <!-- 3. Global System Scope Section (Displayed when supported or has items; default collapsed if 0 items) -->
      <section v-if="isGlobalSectionVisible" class="space-y-3">
        <div
          @click="toggleGlobalCollapse"
          class="flex items-center justify-between cursor-pointer select-none py-1.5 px-1 group"
        >
          <h3 class="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <ChevronDown
              class="w-4 h-4 text-gray-400 transition-transform duration-200"
              :class="{ '-rotate-90': effectiveGlobalCollapsed }"
            />
            <span>{{ t('installedView.globalTitle') }}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
              {{ store.filteredGlobalSkills.length }}
            </span>
          </h3>
          <span class="text-[11px] text-gray-500 group-hover:text-gray-300 transition-colors">
            {{ effectiveGlobalCollapsed ? t('installedView.expandSection') : t('installedView.collapseSection') }}
          </span>
        </div>

        <div v-show="!effectiveGlobalCollapsed" class="space-y-3">
          <div
            v-if="store.filteredGlobalSkills.length === 0"
            class="bg-black/20 border border-dashed border-white/10 rounded-xl p-6 text-center space-y-2"
          >
            <p class="text-xs text-gray-400">{{ t('installedView.emptyGlobal') }}</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <LocalSkillCard
              v-for="skill in store.filteredGlobalSkills"
              :key="skill.scope + '-' + skill.name"
              :skill="skill"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import { useSkillStore } from '../stores/skillStore';
import { useI18n } from '../services/i18n';
import LocalSkillCard from '../components/LocalSkillCard.vue';

const store = useSkillStore();
const { t } = useI18n();

const isWorkspaceCollapsed = ref<boolean | null>(null);
const isAgentCollapsed = ref<boolean | null>(null);
const isGlobalCollapsed = ref<boolean | null>(null);

const isAgentSectionVisible = computed(() => {
  if (store.installedScopeFilter === 'agent') return true;
  if (store.installedScopeFilter === 'all') {
    return (
      store.effectiveAgentRuntime === 'antigravity' ||
      store.effectiveAgentRuntime === 'opencode' ||
      store.effectiveAgentRuntime === 'codex' ||
      store.filteredAgentSkills.length > 0
    );
  }
  return false;
});

const isGlobalSectionVisible = computed(() => {
  if (store.installedScopeFilter === 'global') return true;
  if (store.installedScopeFilter === 'all') {
    return (
      store.effectiveAgentRuntime === 'codex' ||
      store.effectiveAgentRuntime === 'opencode' ||
      store.filteredGlobalSkills.length > 0
    );
  }
  return false;
});

const effectiveWorkspaceCollapsed = computed(() => {
  if (isWorkspaceCollapsed.value !== null) return isWorkspaceCollapsed.value;
  return store.filteredWorkspaceSkills.length === 0;
});

const effectiveAgentCollapsed = computed(() => {
  if (isAgentCollapsed.value !== null) return isAgentCollapsed.value;
  return store.filteredAgentSkills.length === 0;
});

const effectiveGlobalCollapsed = computed(() => {
  if (isGlobalCollapsed.value !== null) return isGlobalCollapsed.value;
  return store.filteredGlobalSkills.length === 0;
});

const toggleWorkspaceCollapse = () => {
  isWorkspaceCollapsed.value = !effectiveWorkspaceCollapsed.value;
};

const toggleAgentCollapse = () => {
  isAgentCollapsed.value = !effectiveAgentCollapsed.value;
};

const toggleGlobalCollapse = () => {
  isGlobalCollapsed.value = !effectiveGlobalCollapsed.value;
};
</script>
