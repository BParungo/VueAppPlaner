import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import * as Y from 'yjs';
import {
  createBoardDoc,
  destroyBoardDoc,
  type BoardDoc,
  type FlowEdgeShape,
  type FlowNodeShape,
} from '@/lib/yjs/doc';
import { attachIndexedDb } from '@/lib/yjs/indexeddb';
import { applyRemoteSnapshot } from '@/lib/yjs/storage';
import {
  startSnapshotLoop,
  type SnapshotLoop,
  type SnapshotState,
} from '@/lib/yjs/snapshot-loop';
import {
  ORIGIN_INIT,
  bindFlowToYDoc,
} from '@/lib/yjs/flow-sync';

export interface UseYBoardResult {
  board: BoardDoc | null;
  nodes: ReturnType<typeof shallowRef<FlowNodeShape[]>>;
  edges: ReturnType<typeof shallowRef<FlowEdgeShape[]>>;
  ready: ReturnType<typeof ref<boolean>>;
  error: ReturnType<typeof ref<Error | null>>;
  snapshotState: ReturnType<typeof ref<SnapshotState>>;
  undoManager: Y.UndoManager | null;
  flush: () => Promise<void>;
}

export function useYBoard(boardId: string) {
  const nodes = shallowRef<FlowNodeShape[]>([]);
  const edges = shallowRef<FlowEdgeShape[]>([]);
  const ready = ref(false);
  const error = ref<Error | null>(null);
  const snapshotState = ref<SnapshotState>('idle');

  let board: BoardDoc | null = null;
  let undoManager: Y.UndoManager | null = null;
  let snapshotLoop: SnapshotLoop | null = null;
  let unbindFlow: (() => void) | null = null;
  let unsubBeforeUnload: (() => void) | null = null;

  onMounted(async () => {
    try {
      board = createBoardDoc();
      unbindFlow = bindFlowToYDoc(board, nodes, edges);

      const { ready: idbReady } = attachIndexedDb(boardId, board);
      await idbReady;

      board.doc.transact(() => {
        // platzhalter — Origin-Marker fuer initiale Loads
      }, ORIGIN_INIT);

      try {
        const snap = await applyRemoteSnapshot(boardId, board.doc);
        if (!snap.loaded) {
          // Erstes Mal: Storage leer; lokaler IndexedDB-State (falls vorhanden) bleibt.
        }
      } catch (e) {
        console.warn('[yboard] remote snapshot failed', e);
      }

      undoManager = new Y.UndoManager([board.yNodes, board.yEdges], {
        captureTimeout: 500,
      });

      snapshotLoop = startSnapshotLoop(boardId, board.doc, (s) => {
        snapshotState.value = s;
      });

      const onBeforeUnload = () => {
        snapshotLoop?.flush().catch(() => undefined);
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      unsubBeforeUnload = () =>
        window.removeEventListener('beforeunload', onBeforeUnload);

      ready.value = true;
    } catch (e) {
      error.value = e as Error;
    }
  });

  onBeforeUnmount(() => {
    snapshotLoop?.flush().catch(() => undefined);
    snapshotLoop?.stop();
    unsubBeforeUnload?.();
    unbindFlow?.();
    undoManager?.destroy();
    if (board) destroyBoardDoc(board);
    board = null;
  });

  return {
    nodes,
    edges,
    ready,
    error,
    snapshotState,
    getBoard: () => board,
    getUndoManager: () => undoManager,
    flush: async () => {
      await snapshotLoop?.flush();
    },
  };
}
