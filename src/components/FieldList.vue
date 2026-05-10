<script setup lang="ts">
import { asTypedFields, type TypedField } from '@/schemas/nodes';
import { computed } from 'vue';

export type FieldStatusMode = 'match' | 'type-mismatch' | 'missing' | 'unused';

export interface FieldStatus {
  mode: FieldStatusMode;
  expectedType?: string;
  actualType?: string;
}

const props = defineProps<{
  fields: unknown;
  emptyHint?: string;
  // Status pro Feld-Index. Falls undefined: kein Icon.
  statuses?: (FieldStatus | undefined)[];
}>();

const items = computed<TypedField[]>(() =>
  asTypedFields(props.fields),
);

function statusFor(i: number): FieldStatus | undefined {
  return props.statuses?.[i];
}

function iconFor(mode: FieldStatusMode): string {
  switch (mode) {
    case 'match':
      return '✓';
    case 'type-mismatch':
      return '⚠';
    case 'missing':
      return '✗';
    case 'unused':
      return '💤';
  }
}

function colorFor(mode: FieldStatusMode): string {
  switch (mode) {
    case 'match':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'type-mismatch':
      return 'text-amber-600 dark:text-amber-400';
    case 'missing':
      return 'text-destructive';
    case 'unused':
      return 'text-muted-foreground/60';
  }
}

function tooltipFor(s: FieldStatus): string {
  switch (s.mode) {
    case 'match':
      return 'matched';
    case 'type-mismatch':
      return `expected "${s.expectedType}", got "${s.actualType}"`;
    case 'missing':
      return 'no source provides this field';
    case 'unused':
      return 'not consumed by any connected component';
  }
}
</script>

<template>
  <ul v-if="items.length" class="space-y-0.5 font-mono">
    <li
      v-for="(f, i) in items"
      :key="`${f.name}-${i}`"
      class="flex items-baseline gap-1.5 truncate"
      :class="
        statusFor(i)?.mode === 'unused' ? 'opacity-60' : ''
      "
    >
      <span
        v-if="statusFor(i)"
        class="text-[10px] leading-none w-3 shrink-0"
        :class="colorFor(statusFor(i)!.mode)"
        :title="tooltipFor(statusFor(i)!)"
      >
        {{ iconFor(statusFor(i)!.mode) }}
      </span>
      <span class="text-foreground">{{ f.name }}</span>
      <span class="text-muted-foreground">:</span>
      <span class="text-muted-foreground truncate">{{ f.type }}</span>
    </li>
  </ul>
  <p
    v-else-if="emptyHint"
    class="text-muted-foreground italic"
  >
    {{ emptyHint }}
  </p>
</template>
