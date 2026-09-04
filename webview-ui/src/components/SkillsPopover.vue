<template>
  <!-- Compact Mode (Sidebar) -->
  <div
    v-if="compact && safeSkills.length > 0"
    ref="triggerRef"
    class="relative inline-block text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 hover:bg-indigo-500/25 transition-colors cursor-pointer select-none"
    @mouseenter="showPopover"
    @mouseleave="hidePopover"
  >
    <Layers class="w-2.5 h-2.5 text-indigo-400" />
    <span class="font-bold">{{ safeSkills.length }}</span>
  </div>

  <!-- Standard Card Mode (Marketplace & Installed View) -->
  <div
    v-else-if="safeSkills.length > 0"
    class="flex items-center gap-1.5 flex-wrap select-none"
  >
    <span class="text-[10px] text-indigo-400 font-semibold flex items-center gap-1 shrink-0">
      <Layers class="w-3 h-3 text-indigo-400" />
      {{ t('cards.subSkills', { count: safeSkills.length }) }}:
    </span>

    <div class="flex items-center gap-1 flex-wrap">
      <span
        v-for="sub in safeSkills.slice(0, 3)"
        :key="sub"
        class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:border-indigo-400/40 transition-colors"
      >
        {{ sub }}
      </span>

      <!-- +N Trigger Badge (Only this badge triggers the popover) -->
      <div
        v-if="safeSkills.length > 3"
        ref="triggerRef"
        class="relative inline-block"
        @mouseenter="showPopover"
        @mouseleave="hidePopover"
      >
        <span
          class="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/30 hover:border-indigo-400/60 transition-colors cursor-pointer flex items-center gap-0.5"
        >
          <span>{{ t('cards.moreSkills', { count: safeSkills.length - 3 }) }}</span>
        </span>
      </div>
    </div>
  </div>

  <!-- Teleport to body to completely eliminate parent card overflow truncation -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen && safeSkills.length > 0"
        :style="{
          position: 'fixed',
          top: `${popoverPos.top}px`,
          left: `${popoverPos.left}px`,
          transform: popoverPos.placement === 'top' ? 'translateY(-100%)' : 'none',
          zIndex: 99999
        }"
        class="w-64 md:w-72 bg-[#181822]/98 backdrop-blur-2xl border border-indigo-500/40 rounded-xl shadow-2xl shadow-black/80 p-3 text-gray-200 pointer-events-auto ring-1 ring-white/10"
        @mouseenter="keepPopover"
        @mouseleave="hidePopover"
      >
        <!-- Header -->
        <div class="flex items-center gap-1.5 pb-2 mb-2 border-b border-white/10">
          <div class="w-5 h-5 rounded-md bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
            <Layers class="w-3 h-3" />
          </div>
          <span class="text-xs font-bold text-white tracking-wide">
            {{ t('cards.subSkillsList') }} ({{ safeSkills.length }})
          </span>
        </div>

        <!-- Skills List Grid -->
        <div class="space-y-1 max-h-52 overflow-y-auto pr-1">
          <div
            v-for="(item, idx) in safeSkills"
            :key="item"
            class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-indigo-500/15 border border-white/5 hover:border-indigo-500/30 transition-all duration-150 group"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 group-hover:scale-125 transition-transform shrink-0 shadow-sm shadow-indigo-400" />
              <span class="font-mono text-xs text-gray-200 group-hover:text-white truncate" :title="item">
                {{ item }}
              </span>
            </div>
            <span class="text-[9px] font-mono text-gray-500 uppercase shrink-0">
              #{{ idx + 1 }}
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Layers } from 'lucide-vue-next';
import { useI18n } from '../services/i18n';

const props = withDefaults(
  defineProps<{
    skills: string[];
    compact?: boolean;
  }>(),
  {
    compact: false
  }
);

const safeSkills = computed(() => {
  if (!props.skills) return [];
  if (Array.isArray(props.skills)) {
    return props.skills
      .map((s) => (typeof s === 'string' ? s.trim() : (s as any)?.name?.trim()))
      .filter((s): s is string => !!s && !s.startsWith('.') && !s.includes('/'));
  }
  return [];
});

const { t } = useI18n();
const isOpen = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const popoverPos = ref<{ top: number; left: number; placement: 'top' | 'bottom' }>({
  top: 0,
  left: 0,
  placement: 'top'
});

let openTimer: any = null;
let closeTimer: any = null;

const updatePosition = () => {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  const popoverWidth = 280;

  // If too close to viewport top (< 230px), pop downwards
  const spaceAbove = rect.top;
  const placement: 'top' | 'bottom' = spaceAbove < 230 ? 'bottom' : 'top';

  let top = 0;
  if (placement === 'top') {
    top = rect.top - 8;
  } else {
    top = rect.bottom + 8;
  }

  let left = rect.left;
  // Boundary clamp
  if (left + popoverWidth > window.innerWidth - 12) {
    left = window.innerWidth - popoverWidth - 12;
  }
  if (left < 12) {
    left = 12;
  }

  popoverPos.value = {
    top,
    left,
    placement
  };
};

const showPopover = () => {
  clearTimeout(closeTimer);
  clearTimeout(openTimer);
  // 180ms hover delay to prevent accidental trigger while casually moving cursor
  openTimer = setTimeout(() => {
    updatePosition();
    isOpen.value = true;
  }, 180);
};

const keepPopover = () => {
  clearTimeout(closeTimer);
  clearTimeout(openTimer);
};

const hidePopover = () => {
  clearTimeout(openTimer);
  closeTimer = setTimeout(() => {
    isOpen.value = false;
  }, 150);
};

const handleScrollOrResize = () => {
  if (isOpen.value) {
    updatePosition();
  }
};

onMounted(() => {
  window.addEventListener('scroll', handleScrollOrResize, true);
  window.addEventListener('resize', handleScrollOrResize);
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScrollOrResize, true);
  window.removeEventListener('resize', handleScrollOrResize);
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
});
</script>
