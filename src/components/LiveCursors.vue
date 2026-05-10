<script setup lang="ts">
import { computed } from 'vue';
import { useVueFlow } from '@vue-flow/core';
import type { AwarenessPeer } from '@/composables/useAwareness';

const props = defineProps<{ peers: AwarenessPeer[] }>();

const { viewport } = useVueFlow();

const screenCursors = computed(() => {
  const vp = viewport.value;
  return props.peers
    .filter((p) => p.cursor !== null)
    .map((p) => {
      const sx = p.cursor!.x * vp.zoom + vp.x;
      const sy = p.cursor!.y * vp.zoom + vp.y;
      return {
        id: p.user.clientId,
        name: p.user.name,
        color: p.user.color,
        x: sx,
        y: sy,
      };
    });
});
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    <div
      v-for="c in screenCursors"
      :key="c.id"
      class="absolute"
      :style="{
        transform: `translate(${c.x}px, ${c.y}px)`,
        transition: 'transform 80ms linear',
      }"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        :style="{ color: c.color }"
        class="drop-shadow"
      >
        <path
          d="M2 2 L18 9 L10 11 L8 18 Z"
          :fill="c.color"
          stroke="white"
          stroke-width="1"
        />
      </svg>
      <div
        class="absolute top-4 left-4 rounded px-1.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap shadow"
        :style="{ backgroundColor: c.color }"
      >
        {{ c.name }}
      </div>
    </div>
  </div>
</template>
