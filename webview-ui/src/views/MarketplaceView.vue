<template>
  <div class="p-4 space-y-4">
    <!-- Loading State -->
    <div v-if="store.isLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="i in 6"
        :key="i"
        class="glass-card rounded-xl p-4 h-44 animate-pulse space-y-3"
      >
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-white/10" />
          <div class="space-y-1.5 flex-1">
            <div class="h-3.5 bg-white/10 rounded w-1/2" />
            <div class="h-2.5 bg-white/5 rounded w-1/3" />
          </div>
        </div>
        <div class="h-10 bg-white/5 rounded-lg" />
        <div class="h-6 bg-white/5 rounded-md mt-auto" />
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="store.filteredPlugins.length === 0"
      class="text-center py-16 space-y-3"
    >
      <div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-gray-400">
        <Search class="w-6 h-6" />
      </div>
      <h3 class="text-sm font-semibold text-gray-300">{{ t('discoverView.emptyTitle') }}</h3>
      <p class="text-xs text-gray-500 max-w-sm mx-auto">
        {{ t('discoverView.emptyDesc') }}
      </p>
    </div>

    <!-- Plugin Cards Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <MarketplaceCard
        v-for="plugin in store.filteredPlugins"
        :key="plugin.name"
        :plugin="plugin"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { Search } from 'lucide-vue-next';
import { useSkillStore } from '../stores/skillStore';
import { useI18n } from '../services/i18n';
import MarketplaceCard from '../components/MarketplaceCard.vue';

const store = useSkillStore();
const { t } = useI18n();

onMounted(() => {
  if (store.marketplacePlugins.length === 0) {
    store.loadMarketplace();
  }
});
</script>
