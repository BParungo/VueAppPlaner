<script setup lang="ts">
import type { AwarenessPeer } from '@/composables/useAwareness';

defineProps<{
  peers: AwarenessPeer[];
  self: { displayName: string; color: string };
}>();

function initial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}
</script>

<template>
  <div class="flex items-center -space-x-1.5">
    <div
      v-for="p in peers"
      :key="p.user.clientId"
      :title="p.user.name"
      class="h-6 w-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-semibold text-white"
      :style="{ backgroundColor: p.user.color }"
    >
      {{ initial(p.user.name) }}
    </div>
    <div
      :title="`${self.displayName} (du)`"
      class="h-6 w-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-semibold text-white ring-1 ring-foreground/20"
      :style="{ backgroundColor: self.color }"
    >
      {{ initial(self.displayName) }}
    </div>
  </div>
</template>
