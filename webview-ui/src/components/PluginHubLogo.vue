<template>
  <div :class="['relative inline-flex items-center justify-center shrink-0 select-none', sizeClass]">
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="w-full h-full drop-shadow-[0_0_12px_rgba(99,102,241,0.55)]"
    >
      <defs>
        <!-- Box Outer Linear Gradient -->
        <linearGradient id="ph-box-stroke" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#A5B4FC" />
          <stop offset="50%" stop-color="#6366F1" />
          <stop offset="100%" stop-color="#A855F7" />
        </linearGradient>

        <!-- Left Face Gradient -->
        <linearGradient id="ph-face-left" x1="4.5" y1="15.5" x2="16" y2="29.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#312E81" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#1E1B4B" stop-opacity="0.95" />
        </linearGradient>

        <!-- Right Face Gradient -->
        <linearGradient id="ph-face-right" x1="16" y1="15.5" x2="27.5" y2="29.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#4338CA" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#312E81" stop-opacity="0.9" />
        </linearGradient>

        <!-- Left Flap Gradient -->
        <linearGradient id="ph-flap-left" x1="2" y1="10.5" x2="11" y2="15.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#6366F1" stop-opacity="0.8" />
          <stop offset="100%" stop-color="#4F46E5" stop-opacity="0.4" />
        </linearGradient>

        <!-- Right Flap Gradient -->
        <linearGradient id="ph-flap-right" x1="30" y1="10.5" x2="21" y2="15.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#A855F7" stop-opacity="0.8" />
          <stop offset="100%" stop-color="#7C3AED" stop-opacity="0.4" />
        </linearGradient>

        <!-- Inner Box Ambient Cavity Gradient -->
        <linearGradient id="ph-inner-cavity" x1="16" y1="10" x2="16" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#1E1B4B" stop-opacity="0.9" />
          <stop offset="60%" stop-color="#0F172A" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#312E81" stop-opacity="0.7" />
        </linearGradient>

        <!-- Emerging AI Core Radiant Gradient -->
        <radialGradient id="ph-core-radiant" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="35%" stop-color="#38BDF8" />
          <stop offset="75%" stop-color="#6366F1" />
          <stop offset="100%" stop-color="#A855F7" />
        </radialGradient>
      </defs>

      <!-- 1. Inner Box Cavity (箱内空间) -->
      <path
        d="M4.5 15.5 L11 12.8 L16 10.2 L21 12.8 L27.5 15.5 L16 22 Z"
        fill="url(#ph-inner-cavity)"
      />
      <!-- Back Seam Guideline -->
      <path
        d="M11 12.8 L16 10.2 L21 12.8"
        stroke="#818CF8"
        stroke-width="1.2"
        stroke-dasharray="2 2"
        opacity="0.5"
      />

      <!-- 2. Left and Right Outer Walls (立体箱体外立面) -->
      <!-- Left Wall -->
      <path
        d="M4.5 15.5 L16 22 L16 29.5 L4.5 23.5 Z"
        fill="url(#ph-face-left)"
        stroke="url(#ph-box-stroke)"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
      <!-- Right Wall -->
      <path
        d="M16 22 L27.5 15.5 L27.5 23.5 L16 29.5 Z"
        fill="url(#ph-face-right)"
        stroke="url(#ph-box-stroke)"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
      <!-- Center Vertical Seam Line -->
      <path
        d="M16 22 L16 29.5"
        stroke="#A5B4FC"
        stroke-width="1.6"
        stroke-linecap="round"
      />

      <!-- 3. Open Top Wings / Flaps (向外展开的箱翼) -->
      <!-- Left Flap -->
      <path
        d="M4.5 15.5 L2 10.5 L11 12.8"
        fill="url(#ph-flap-left)"
        stroke="url(#ph-box-stroke)"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <!-- Right Flap -->
      <path
        d="M27.5 15.5 L30 10.5 L21 12.8"
        fill="url(#ph-flap-right)"
        stroke="url(#ph-box-stroke)"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- 4. Emerging AI Capability Core (从箱中升腾的 AI 核心星芒) -->
      <path
        d="M16 1.8 C16 4.5 17.6 6.8 21.5 6.8 C17.6 6.8 16 9.1 16 11.8 C16 9.1 14.4 6.8 10.5 6.8 C14.4 6.8 16 4.5 16 1.8 Z"
        fill="url(#ph-core-radiant)"
        class="animate-pulse"
      />
      <circle cx="16" cy="6.8" r="1.5" fill="#FFFFFF" />

      <!-- 5. Floating Satellite Sparks & Particles (微光星子) -->
      <circle cx="7.5" cy="5.2" r="1.1" fill="#38BDF8" class="animate-bounce" />
      <circle cx="24.5" cy="5.2" r="1.1" fill="#C084FC" class="animate-bounce" style="animation-delay: 0.2s;" />
      <circle cx="16" cy="16.5" r="1.2" fill="#818CF8" opacity="0.85" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  }>(),
  {
    size: 'md'
  }
);

const sizeClass = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'w-5 h-5';
    case 'sm':
      return 'w-6 h-6';
    case 'md':
      return 'w-8 h-8';
    case 'lg':
      return 'w-9 h-9';
    case 'xl':
      return 'w-12 h-12';
    default:
      return 'w-8 h-8';
  }
});
</script>
