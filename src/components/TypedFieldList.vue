<script setup lang="ts">
import { ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import type { TypedField } from '@/schemas/nodes';

const props = defineProps<{
  modelValue: TypedField[];
  label?: string;
  namePlaceholder?: string;
  typePlaceholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: TypedField[]): void;
}>();

const local = ref<TypedField[]>([]);

watch(
  () => props.modelValue,
  (val) => {
    local.value = val.map((f) => ({ ...f }));
  },
  { immediate: true, deep: true },
);

function commit() {
  emit(
    'update:modelValue',
    local.value.map((f) => ({
      name: f.name.trim(),
      type: f.type.trim(),
    })),
  );
}

function add() {
  local.value.push({ name: '', type: 'string' });
}

function remove(index: number) {
  local.value.splice(index, 1);
  commit();
}

function move(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= local.value.length) return;
  const [item] = local.value.splice(index, 1);
  local.value.splice(target, 0, item);
  commit();
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-if="props.label"
      class="text-muted-foreground text-xs"
    >
      {{ props.label }}
    </div>

    <div
      v-for="(field, index) in local"
      :key="index"
      class="flex items-center gap-1"
    >
      <input
        v-model="field.name"
        :placeholder="props.namePlaceholder ?? 'name'"
        class="flex-1 min-w-0 border rounded px-2 py-1 bg-background font-mono text-xs"
        @blur="commit"
      />
      <span class="text-muted-foreground text-xs">:</span>
      <input
        v-model="field.type"
        :placeholder="props.typePlaceholder ?? 'string'"
        class="flex-1 min-w-0 border rounded px-2 py-1 bg-background font-mono text-xs"
        @blur="commit"
      />
      <Button
        variant="ghost"
        size="sm"
        class="h-7 w-7 p-0 shrink-0"
        :disabled="index === 0"
        title="Nach oben"
        @click="move(index, -1)"
      >↑</Button>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 w-7 p-0 shrink-0"
        :disabled="index === local.length - 1"
        title="Nach unten"
        @click="move(index, 1)"
      >↓</Button>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 w-7 p-0 shrink-0 text-destructive"
        title="Entfernen"
        @click="remove(index)"
      >✕</Button>
    </div>

    <Button
      variant="outline"
      size="sm"
      class="w-full text-xs"
      @click="add"
    >
      + Feld hinzufügen
    </Button>
  </div>
</template>
