<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position, type NodeProps } from '@vue-flow/core';
import type { NoteColor, NoteData } from '@/schemas/nodes';

const props = defineProps<NodeProps<NoteData>>();

const colorClasses: Record<NoteColor, { bg: string; border: string; dot: string }> = {
  yellow: {
    bg: 'bg-yellow-100 dark:bg-yellow-950/40',
    border: 'border-yellow-500/50',
    dot: 'bg-yellow-500',
  },
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-950/40',
    border: 'border-blue-500/50',
    dot: 'bg-blue-500',
  },
  green: {
    bg: 'bg-green-100 dark:bg-green-950/40',
    border: 'border-green-500/50',
    dot: 'bg-green-500',
  },
  red: {
    bg: 'bg-red-100 dark:bg-red-950/40',
    border: 'border-red-500/50',
    dot: 'bg-red-500',
  },
  gray: {
    bg: 'bg-gray-100 dark:bg-gray-900/60',
    border: 'border-gray-500/50',
    dot: 'bg-gray-500',
  },
};

const palette = computed(() => colorClasses[props.data.color] ?? colorClasses.yellow);
</script>

<template>
  <div
    class="w-64 rounded-lg border shadow-sm p-3 space-y-2"
    :class="[palette.bg, palette.border]"
  >
    <Handle type="target" :position="Position.Left" />
    <div class="text-sm font-semibold flex items-center gap-2">
      <span
        class="inline-block h-2 w-2 rounded-full"
        :class="palette.dot"
        aria-hidden="true"
      />
      {{ data.label }}
    </div>
    <div
      v-if="data.body"
      class="text-xs whitespace-pre-wrap break-words text-foreground/80"
    >
      {{ data.body }}
    </div>
    <div v-else class="text-xs italic text-muted-foreground">
      (leere Notiz)
    </div>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>
