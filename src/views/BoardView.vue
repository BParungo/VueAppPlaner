<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  VueFlow,
  useVueFlow,
  MarkerType,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import { Button } from '@/components/ui/button';
import NodePalette from '@/components/NodePalette.vue';
import PropertiesPanel from '@/components/PropertiesPanel.vue';
import { nodeTypes } from '@/nodes';
import { NODE_DEFAULTS, type NodeKind } from '@/schemas/nodes';
import { getBoard, type Board } from '@/lib/supabase/boards';
import { useRecentBoards } from '@/composables/useRecentBoards';
import { useLocalUser } from '@/composables/useLocalUser';
import { useYBoard } from '@/composables/useYBoard';
import { provideBoardContext } from '@/composables/boardContext';
import {
  addNode,
  addEdge,
  applyEdgeChangesToYDoc,
  applyNodeChangesToYDoc,
} from '@/lib/yjs/flow-sync';
import { buildEdgeReport } from '@/lib/types/match';

const props = defineProps<{ id: string }>();
const router = useRouter();

const { track } = useRecentBoards();
const { user } = useLocalUser();

const board = ref<Board | null>(null);
const loadError = ref<string | null>(null);
const loading = ref(true);

const yboard = useYBoard(props.id);
const {
  nodes,
  edges,
  ready: yReady,
  error: yError,
  snapshotState,
  flush,
  getBoard: getYBoard,
  getUndoManager,
} = yboard;

provideBoardContext({ nodes, edges });

function styleFor(reportTotalMismatch: boolean, partialMismatch: boolean) {
  if (reportTotalMismatch) {
    return {
      style: { stroke: '#ef4444', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
    };
  }
  if (partialMismatch) {
    return {
      style: { stroke: '#f59e0b', strokeWidth: 1.5 },
      markerEnd: undefined,
    };
  }
  return {
    style: undefined,
    markerEnd: undefined,
  };
}

const coloredEdges = computed(() => {
  // explizite Reads damit Vue beide Refs als Dependency erkennt
  const ns = nodes.value;
  const es = edges.value;
  return es.map((e) => {
    const report = buildEdgeReport(e, ns);
    const partial =
      report.totalProps > 0 && report.matchCount < report.totalProps;
    const styled = styleFor(report.totalMismatch, partial && !report.totalMismatch);
    return {
      ...e,
      style: styled.style,
      markerEnd: styled.markerEnd,
    };
  });
});

const selectedNodeId = ref<string | null>(null);
const showProperties = ref(true);

const {
  onConnect,
  onNodesChange,
  onEdgesChange,
  screenToFlowCoordinate,
  setEdges,
  setNodes,
} = useVueFlow();

watch(
  coloredEdges,
  (next) => {
    setEdges(next);
  },
  { deep: true, flush: 'post' },
);

watch(
  nodes,
  (next) => {
    setNodes(next);
  },
  { deep: true, flush: 'post' },
);

onNodesChange((changes: NodeChange[]) => {
  const yb = getYBoard();
  if (!yb) return;
  // 'select'-Changes nicht in Y.Map schreiben — sind UI-only.
  for (const change of changes) {
    if (change.type === 'select') {
      if (change.selected) selectedNodeId.value = change.id;
      else if (selectedNodeId.value === change.id) selectedNodeId.value = null;
    }
  }
  applyNodeChangesToYDoc(yb, changes);
});

onEdgesChange((changes: EdgeChange[]) => {
  const yb = getYBoard();
  if (!yb) return;
  applyEdgeChangesToYDoc(yb, changes);
});

onConnect((conn: Connection) => {
  const yb = getYBoard();
  if (!yb) return;
  addEdge(yb, {
    id: `${conn.source}-${conn.target}-${Date.now()}`,
    source: conn.source,
    target: conn.target,
    sourceHandle: conn.sourceHandle ?? null,
    targetHandle: conn.targetHandle ?? null,
  });
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
  const yb = getYBoard();
  if (!yb) return;
  const position = screenToFlowCoordinate({
    x: event.clientX,
    y: event.clientY,
  });
  addNode(yb, {
    id: uuid(),
    type: kind,
    position,
    data: NODE_DEFAULTS[kind]() as Record<string, unknown>,
  });
}

function onUndo() {
  getUndoManager()?.undo();
}

function onRedo() {
  getUndoManager()?.redo();
}

function onKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  ) {
    return;
  }
  const meta = event.ctrlKey || event.metaKey;
  if (!meta) return;
  if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
    event.preventDefault();
    onUndo();
  } else if (
    (event.key.toLowerCase() === 'z' && event.shiftKey) ||
    event.key.toLowerCase() === 'y'
  ) {
    event.preventDefault();
    onRedo();
  }
}

const snapshotLabel = computed(() => {
  switch (snapshotState.value) {
    case 'idle':
      return 'Gespeichert';
    case 'pending':
      return 'Ausstehend …';
    case 'saving':
      return 'Speichere …';
    case 'error':
      return 'Speicherfehler';
  }
});

const snapshotDot = computed(() => {
  switch (snapshotState.value) {
    case 'idle':
      return 'bg-emerald-500';
    case 'pending':
      return 'bg-amber-500';
    case 'saving':
      return 'bg-blue-500 animate-pulse';
    case 'error':
      return 'bg-destructive';
  }
});

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

  window.addEventListener('keydown', onKeyDown);
});

watch(yError, (err) => {
  if (err) loadError.value = err.message;
});
</script>

<template>
  <div
    class="h-screen flex flex-col"
    @keydown="onKeyDown"
  >
    <header class="border-b bg-background">
      <div class="flex h-14 items-center justify-between px-4 gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" @click="router.push('/')">
            ← Boards
          </Button>
          <h1 class="text-base font-semibold truncate">
            {{ board?.name ?? 'Board' }}
          </h1>
          <span class="text-xs text-muted-foreground font-mono truncate">
            {{ id }}
          </span>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              class="inline-block h-2 w-2 rounded-full"
              :class="snapshotDot"
              aria-hidden="true"
            />
            {{ snapshotLabel }}
          </div>

          <Button variant="ghost" size="sm" @click="onUndo">↶ Undo</Button>
          <Button variant="ghost" size="sm" @click="onRedo">↷ Redo</Button>

          <Button
            variant="ghost"
            size="sm"
            @click="showProperties = !showProperties"
          >
            {{ showProperties ? 'Props ›' : '‹ Props' }}
          </Button>

          <div class="flex items-center gap-2">
            <span
              class="inline-block h-2.5 w-2.5 rounded-full border"
              :style="{ backgroundColor: user.color }"
              aria-hidden="true"
            />
            <span class="text-sm">{{ user.displayName }}</span>
          </div>
        </div>
      </div>
    </header>

    <div v-if="loadError" class="p-8 text-center text-destructive">
      {{ loadError }}
      <div class="mt-2">
        <Button variant="outline" size="sm" @click="flush">Retry Save</Button>
      </div>
    </div>

    <div
      v-else-if="loading || !yReady"
      class="p-8 text-center text-muted-foreground"
    >
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
          :nodes="nodes"
          :edges="coloredEdges"
          :node-types="nodeTypes"
          :default-edge-options="{ animated: false }"
          fit-view-on-init
        >
          <Background pattern-color="#aaa" :gap="16" />
          <MiniMap pannable zoomable />
          <Controls />
        </VueFlow>
      </div>
      <PropertiesPanel
        v-if="showProperties"
        :board="getYBoard()"
        :nodes="nodes"
        :selected-id="selectedNodeId"
        @close="showProperties = false"
      />
    </div>
  </div>
</template>
