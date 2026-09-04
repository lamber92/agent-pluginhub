<template>
  <div
    v-if="store.skillToDelete"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    @click.self="cancelDelete"
  >
    <div class="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl border border-red-500/20 space-y-4">
      <!-- Modal Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center font-bold text-sm shadow-md shadow-red-500/20">
            <Trash2 class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-white">{{ t('deleteModal.title') }}</h3>
            <p class="text-xs text-red-300 font-mono mt-0.5">{{ store.skillToDelete.name }}</p>
          </div>
        </div>
        <button
          @click="cancelDelete"
          class="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Warning Box -->
      <div class="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 space-y-2 text-xs text-red-200">
        <div class="flex items-center gap-2 text-red-400 font-semibold">
          <AlertTriangle class="w-4 h-4 shrink-0" />
          <span>{{ t('deleteModal.irreversible') }}</span>
        </div>
        <p class="text-gray-300 leading-relaxed">
          {{ t('deleteModal.confirmPrompt') }}
          <span class="text-white font-semibold underline">
            {{
            store.skillToDelete.scope === 'workspace'
              ? t('deleteModal.currentWorkspace')
              : (store.skillToDelete.scope === 'global' ? t('deleteModal.globalEnv') : t('deleteModal.agentEnv'))
          }}
          </span>
          {{ t('deleteModal.confirmPromptEnd') }}
          <span class="text-white font-bold font-mono">"{{ store.skillToDelete.name }}"</span> ?
        </p>
        <div class="text-[11px] text-gray-400 font-mono bg-black/40 p-2 rounded-lg truncate border border-white/5">
          {{ store.skillToDelete.path }}
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-2 pt-2">
        <button
          @click="cancelDelete"
          :disabled="isDeleting"
          class="px-4 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          {{ t('actions.cancel') }}
        </button>
        <button
          @click="performDelete"
          :disabled="isDeleting"
          class="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <Loader2 v-if="isDeleting" class="w-3.5 h-3.5 animate-spin" />
          <Trash2 v-else class="w-3.5 h-3.5" />
          <span>{{ isDeleting ? t('deleteModal.deleting') : t('deleteModal.confirmDelete') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-vue-next';
import { useSkillStore } from '../stores/skillStore';
import { useI18n } from '../services/i18n';

const store = useSkillStore();
const { t } = useI18n();
const isDeleting = ref(false);

const cancelDelete = () => {
  if (!isDeleting.value) {
    store.skillToDelete = null;
  }
};

const performDelete = async () => {
  try {
    isDeleting.value = true;
    await store.executeDeleteSkill();
  } catch (e) {
    console.error(e);
  } finally {
    isDeleting.value = false;
  }
};
</script>
