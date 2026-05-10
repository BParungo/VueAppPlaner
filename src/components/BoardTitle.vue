<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

const props = defineProps<{ name: string }>();
const emit = defineEmits<{ rename: [string] }>();

const editing = ref(false);
const draft = ref('');
const inputEl = ref<HTMLInputElement | null>(null);

function startEdit() {
  draft.value = props.name;
  editing.value = true;
  nextTick(() => {
    inputEl.value?.focus();
    inputEl.value?.select();
  });
}

function commit() {
  const next = draft.value.trim();
  if (next && next !== props.name) emit('rename', next);
  editing.value = false;
}

function cancel() {
  editing.value = false;
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    commit();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    cancel();
  }
}

// Wenn der Name extern (Remote) wechselt waehrend wir editieren, lassen wir
// den lokalen Draft stehen — User-Edit gewinnt bis Enter/Esc.
watch(
  () => props.name,
  () => {
    if (!editing.value) draft.value = props.name;
  },
);
</script>

<template>
  <input
    v-if="editing"
    ref="inputEl"
    v-model="draft"
    type="text"
    class="text-base font-semibold bg-transparent border-b border-foreground/30 outline-none focus:border-foreground px-1 min-w-[8rem]"
    @keydown="onKeyDown"
    @blur="commit"
  />
  <button
    v-else
    type="button"
    class="text-base font-semibold truncate hover:bg-muted/50 rounded px-1 -mx-1 cursor-text text-left"
    :title="`${name} — Klicken zum Umbenennen`"
    @click="startEdit"
  >
    {{ name || 'Untitled Board' }}
  </button>
</template>
