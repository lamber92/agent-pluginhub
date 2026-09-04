<template>
  <div
    v-if="store.isSourceModalOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    @click.self="closeModal"
  >
    <div class="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl border border-white/10 space-y-4 flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-white/10 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
            <Globe class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-white">
              {{ store.editingSource ? t('sourceModal.editTitle') : t('sourceModal.addTitle') }}
            </h3>
            <p class="text-xs text-gray-400">
              {{ store.editingSource ? t('sourceModal.editSubtitle') : t('sourceModal.addSubtitle') }}
            </p>
          </div>
        </div>
        <button
          @click="closeModal"
          class="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Source Form -->
      <div class="space-y-3">
        <div>
          <label class="text-xs text-gray-300 block mb-1 font-medium">{{ t('sourceModal.sourceName') }}</label>
          <input
            v-model="form.name"
            type="text"
            :placeholder="t('sourceModal.sourceNamePlaceholder')"
            class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label class="text-xs text-gray-300 block mb-1 font-medium">{{ t('sourceModal.sourceType') }}</label>
          <select
            v-model="form.type"
            :disabled="!!store.editingSource?.isDefault"
            class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 cursor-pointer"
          >
            <option v-if="store.editingSource?.isDefault || form.type === 'official'" value="official" class="bg-gray-900 text-white">🏛️ {{ t('sources.official') }}</option>
            <option value="git" class="bg-gray-900 text-white">🐙 {{ t('sources.git') }}</option>
            <option value="url" class="bg-gray-900 text-white">🌐 {{ t('sources.url') }}</option>
            <option value="local" class="bg-gray-900 text-white">📁 {{ t('sources.local') }}</option>
          </select>
        </div>

        <div>
          <label class="text-xs text-gray-300 block mb-1 font-medium">
            {{ (form.type === 'git' || form.type === 'official') ? t('sourceModal.locationRepo') : form.type === 'url' ? t('sourceModal.locationUrl') : t('sourceModal.locationLocal') }}
          </label>
          <input
            v-model="form.location"
            type="text"
            :placeholder="(form.type === 'git' || form.type === 'official') ? 'https://github.com/org/repo' : form.type === 'url' ? 'https://example.com/marketplace.json' : 'D:\\my-skills'"
            class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <div v-if="form.type === 'git' || form.type === 'official'" class="grid grid-cols-2 gap-2.5">
          <div>
            <label class="text-xs text-gray-300 block mb-1 font-medium">{{ t('sourceModal.branch') }}</label>
            <input
              v-model="form.branch"
              type="text"
              placeholder="main"
              class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
          <div>
            <label class="text-xs text-gray-300 block mb-1 font-medium">{{ t('sourceModal.token') }}</label>
            <input
              v-model="form.token"
              type="password"
              placeholder="ghp_..."
              class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
        <button
          type="button"
          @click.stop="closeModal"
          class="px-3.5 py-1.5 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          {{ t('actions.cancel') }}
        </button>
        <button
          type="button"
          @click.stop="handleSave"
          :disabled="!form.name.trim() || !form.location.trim() || isSaving"
          class="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Loader2 v-if="isSaving" class="w-3.5 h-3.5 animate-spin" />
          <span>{{ store.editingSource ? t('actions.saveChanges') : t('actions.confirmAdd') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Globe, X, Loader2 } from 'lucide-vue-next';
import { MarketplaceSourceConfig, useSkillStore } from '../stores/skillStore';
import { useI18n } from '../services/i18n';
import { bridge } from '../services/bridgeClient';

const store = useSkillStore();
const { t } = useI18n();
const isSaving = ref(false);

const form = ref<{
  name: string;
  type: 'official' | 'git' | 'url' | 'local';
  location: string;
  branch: string;
  token: string;
}>({
  name: '',
  type: 'git',
  location: '',
  branch: 'main',
  token: ''
});

watch(
  () => store.isSourceModalOpen,
  (open) => {
    if (open) {
      if (store.editingSource) {
        form.value = {
          name: store.editingSource.name,
          type: store.editingSource.type,
          location: store.editingSource.location,
          branch: store.editingSource.branch || 'main',
          token: store.editingSource.token || ''
        };
      } else {
        form.value = {
          name: '',
          type: 'git',
          location: '',
          branch: 'main',
          token: ''
        };
      }
    }
  }
);

const closeModal = () => {
  store.isSourceModalOpen = false;
  store.editingSource = null;
};

const handleSave = async () => {
  if (!form.value.name.trim() || !form.value.location.trim()) return;
  try {
    isSaving.value = true;
    const sourceData: MarketplaceSourceConfig = {
      id: store.editingSource ? store.editingSource.id : `source-${Date.now()}`,
      name: form.value.name.trim(),
      type: form.value.type,
      location: form.value.location.trim(),
      branch: form.value.branch.trim() || 'main',
      token: form.value.token.trim() || undefined,
      enabled: store.editingSource ? store.editingSource.enabled : true,
      isDefault: store.editingSource ? store.editingSource.isDefault : false
    };

    await bridge.invoke('addOrUpdateSource', sourceData);
    await store.loadSources();
    store.loadMarketplace(true).catch(console.error);
    closeModal();
  } catch (err) {
    console.error('Failed to save source:', err);
  } finally {
    isSaving.value = false;
  }
};
</script>
