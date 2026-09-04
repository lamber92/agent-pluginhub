<template>
  <div class="min-h-screen bg-[#18181b] text-gray-200 flex flex-col antialiased">
    <!-- Sidebar Mode (Narrow Left Pane) -->
    <template v-if="isSidebarMode">
      <SidebarView />
    </template>

    <!-- Editor Tab Mode (Full Marketplace View) -->
    <template v-else>
      <Navbar />
      <main class="flex-1 max-w-7xl w-full mx-auto">
        <InstalledView v-show="store.activeTab === 'installed'" />
        <MarketplaceView v-show="store.activeTab === 'discover'" />
        <SettingsView v-show="store.activeTab === 'settings'" />
      </main>
    </template>

    <!-- Global Modals & Drawers -->
    <PluginDetailModal />
    <InstallModal />
    <SourceManagerModal />
    <DeleteConfirmModal />
    <RuntimeSwitchModal />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useSkillStore } from './stores/skillStore';
import { bridge } from './services/bridgeClient';
import Navbar from './components/Navbar.vue';
import MarketplaceView from './views/MarketplaceView.vue';
import InstalledView from './views/InstalledView.vue';
import SettingsView from './views/SettingsView.vue';
import SidebarView from './views/SidebarView.vue';
import PluginDetailModal from './components/PluginDetailModal.vue';
import InstallModal from './components/InstallModal.vue';
import SourceManagerModal from './components/SourceManagerModal.vue';
import DeleteConfirmModal from './components/DeleteConfirmModal.vue';
import RuntimeSwitchModal from './components/RuntimeSwitchModal.vue';

declare global {
  interface Window {
    __PLUGINHUB_VIEW_MODE__?: 'sidebar' | 'editor';
  }
}

const store = useSkillStore();
const isSidebarMode = ref(false);

const updateViewMode = () => {
  if (window.__PLUGINHUB_VIEW_MODE__) {
    isSidebarMode.value = window.__PLUGINHUB_VIEW_MODE__ === 'sidebar';
  } else {
    isSidebarMode.value = window.innerWidth < 450;
  }
};

const handleGlobalKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    if (store.skillToDelete) {
      store.skillToDelete = null;
      return;
    }
    if (store.isSourceModalOpen) {
      store.isSourceModalOpen = false;
      store.editingSource = null;
      return;
    }
    if (store.activeInstallPlugin) {
      store.activeInstallPlugin = null;
      return;
    }
    if (store.activeDetailSkill) {
      store.activeDetailSkill = null;
      return;
    }
  }
};

onMounted(async () => {
  updateViewMode();
  window.addEventListener('resize', updateViewMode);
  window.addEventListener('keydown', handleGlobalKeyDown);

  // Listen to tab switch events from backend
  bridge.on('tab:switch', (data: any) => {
    if (data && data.tab) {
      store.activeTab = data.tab;
    }
  });

  await store.loadSettings();
  await store.loadSources();
  await store.loadLocalSkills();
  await store.loadMarketplace();
});

onUnmounted(() => {
  window.removeEventListener('resize', updateViewMode);
  window.removeEventListener('keydown', handleGlobalKeyDown);
});
</script>
