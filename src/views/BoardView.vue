<script setup lang="ts">
import { onMounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  VueFlow,
  useVueFlow,
  type Connection,
} from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import { Button } from '@/components/ui/button';
import NodePalette from '@/components/NodePalette.vue';
import { nodeTypes } from '@/nodes';
import { NODE_DEFAULTS, type NodeKind } from '@/schemas/nodes';
import { getBoard, type Board } from '@/lib/supabase/boards';
import { useRecentBoards } from '@/composables/useRecentBoards';
import { useLocalUser } from '@/composables/useLocalUser';

const props = defineProps<{ id: string }>();
const router = useRouter();

const { track } = useRecentBoards();
const { user } = useLocalUser();

const board = ref<Board | null>(null);
const loadError = ref<string | null>(null);
const loading = ref(true);

const nodes = shallowRef<any[]>([]);
const edges = shallowRef<any[]>([]);

const {
  onConnect,
  onNodesChange,
  onEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  addEdges,
  screenToFlowCoordinate,
} = useVueFlow();

onNodesChange((changes) => {
  nodes.value = applyNodeChanges(changes);
});
onEdgesChange((changes) => {
  edges.value = applyEdgeChanges(changes);
});
onConnect((conn: Connection) => {
  addEdges([{ ...conn, id: `${conn.source}-${conn.target}-${Date.now()}` }]);
});

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function onDragOver(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
}

function onDrop(event: DragEvent) {
  const kind = event.dataTransfer?.getData(
    'application/vap-node-kind',
  ) as NodeKind | '';
  if (!kind) return;
  const position = screenToFlowCoordinate({
    x: event.clientX,
    y: event.clientY,
  });
  const node = {
    id: uuid(),
    type: kind,
    position,
    data: NODE_DEFAULTS[kind](),
  };
  nodes.value = [...nodes.value, node];
}

onMounted(async () => {
  loading.value = true;
  try {
    const data = await getBoard(props.id);
    if (!data) {
      loadError.value = 'Board nicht gefunden.';
      return;
    }
    board.value = data;
    track({ id: data.id, name: data.name });
  } catch (e) {
    loadError.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});

watch(
  () => props.id,
  () => {
    nodes.value = [];
    edges.value = [];
  },
);
</script>

<template>
  <div class="h-screen flex flex-col">
    <header class="border-b bg-background">
      <div class="flex h-14 items-center justify-between px-4">
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="sm" @click="router.push('/')">
            ← Boards
          </Button>
          <h1 class="text-base font-semibold">
            {{ board?.name ?? 'Board' }}
          </h1>
          <span class="text-xs text-muted-foreground font-mono">
            {{ id }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="inline-block h-2.5 w-2.5 rounded-full border"
            :style="{ backgroundColor: user.color }"
            aria-hidden="true"
          />
          <span class="text-sm">{{ user.displayName }}</span>
        </div>
      </div>
    </header>

    <div v-if="loadError" class="p-8 text-center text-destructive">
      {{ loadError }}
    </div>

    <div v-else-if="loading" class="p-8 text-center text-muted-foreground">
      Lade Board …
    </div>

    <div v-else class="flex-1 flex min-h-0">
      <NodePalette />
      <div
        class="flex-1 relative"
        @dragover="onDragOver"
        @drop="onDrop"
      >
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          :node-types="nodeTypes"
          :default-edge-options="{ animated: false }"
          fit-view-on-init
        >
          <Background pattern-color="#aaa" :gap="16" />
          <MiniMap pannable zoomable />
          <Controls />
        </VueFlow>
      </div>
    </div>
  </div>
</template>
