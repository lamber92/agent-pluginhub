<template>
  <div
    v-if="store.isRuntimeSwitchModalOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    @click.self="store.cancelRuntimeSwitch"
  >
    <div class="glass-panel w-full max-w-md rounded-2xl p-5 shadow-2xl border border-white/10 space-y-4 bg-[#181822]">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
          <RefreshCw class="w-5 h-5" :class="{ 'animate-spin': store.isSwitchingRuntime }" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-white">{{ t('runtimeSwitchModal.title') }}</h3>
          <p class="text-xs text-gray-400 mt-0.5">{{ t('runtimeSwitchModal.subtitle') }}</p>
        </div>
      </div>

      <div class="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-2.5 text-xs text-gray-300">
        <div class="flex items-center gap-2 flex-wrap">
          <span>{{ t('runtimeSwitchModal.prompt') }}</span>
          <div class="inline-flex items-center gap-1.5 font-semibold text-white bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
            <div class="w-4 h-4 flex items-center justify-center shrink-0">
              <Bot v-if="store.pendingRuntime === 'auto'" class="w-3.5 h-3.5 text-indigo-400" />
              <img v-else-if="store.pendingRuntime === 'antigravity'" :src="antigravityIcon" alt="Antigravity" class="w-3.5 h-3.5 object-contain" />
              <img v-else-if="store.pendingRuntime === 'opencode'" :src="opencodeIcon" alt="OpenCode" class="w-3.5 h-3.5 object-contain rounded-sm" />
              <img v-else-if="store.pendingRuntime === 'codex'" :src="codexIcon" alt="OpenAI Codex" class="w-3.5 h-3.5 object-contain" />
            </div>
            <span>{{ getRuntimeDisplayName(store.pendingRuntime) }}</span>
          </div>
          <span>?</span>
        </div>

        <p class="text-[11px] text-gray-400 leading-relaxed border-t border-white/5 pt-2">
          {{ t('runtimeSwitchModal.notice') }}
        </p>
      </div>

      <div class="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          @click.stop="store.cancelRuntimeSwitch"
          :disabled="store.isSwitchingRuntime"
          class="px-3.5 py-1.5 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
        >
          {{ t('actions.cancel') }}
        </button>
        <button
          type="button"
          @click.stop="store.confirmRuntimeSwitch"
          :disabled="store.isSwitchingRuntime"
          class="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Loader2 v-if="store.isSwitchingRuntime" class="w-3.5 h-3.5 animate-spin" />
          <Check v-else class="w-3.5 h-3.5" />
          <span>{{ store.isSwitchingRuntime ? t('runtimeSwitchModal.switching') : t('runtimeSwitchModal.confirmBtn') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bot, RefreshCw, Check, Loader2 } from 'lucide-vue-next';
import { useSkillStore } from '../stores/skillStore';
import { useI18n } from '../services/i18n';
import { antigravityIcon, opencodeIcon, codexIcon } from '../assets/icons/runtimeIcons';
import { TargetAgentRuntime } from '../types';

const store = useSkillStore();
const { t } = useI18n();

const getRuntimeDisplayName = (runtime: TargetAgentRuntime | null) => {
  if (!runtime || runtime === 'auto') return `${t('runtimes.auto')}`;
  if (runtime === 'antigravity') return t('runtimes.antigravity');
  if (runtime === 'opencode') return t('runtimes.opencode');
  if (runtime === 'codex') return t('runtimes.codex');
  return runtime;
};
</script>
