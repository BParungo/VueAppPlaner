import {
  effectScope,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';
import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
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
  ORIGIN_LOCAL,
  bindFlowToYDoc,
} from '@/lib/yjs/flow-sync';
import { createSupabaseProvider } from '@/lib/yjs/supabase-provider';
import type { ProviderStatus, YProvider } from '@/lib/yjs/provider';
import { useLocalUser } from './useLocalUser';

export function useYBoard(boardId: string) {
  const nodes = shallowRef<FlowNodeShape[]>([]);
  const edges = shallowRef<FlowEdgeShape[]>([]);
  const ready = ref(false);
  const error = ref<Error | null>(null);
  const snapshotState = ref<SnapshotState>('idle');
  const connectionStatus = ref<ProviderStatus>('connecting');
  const awareness = shallowRef<Awareness | null>(null);

  const { user } = useLocalUser();

  let board: BoardDoc | null = null;
  let undoManager: Y.UndoManager | null = null;
  let snapshotLoop: SnapshotLoop | null = null;
  let unbindFlow: (() => void) | null = null;
  let unsubBeforeUnload: (() => void) | null = null;
  let provider: YProvider | null = null;
  const scope = effectScope();

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
        trackedOrigins: new Set([ORIGIN_LOCAL]),
      });

      snapshotLoop = startSnapshotLoop(boardId, board.doc, (s) => {
        snapshotState.value = s;
      });

      provider = createSupabaseProvider(boardId, board, user.value);
      awareness.value = provider.awareness;
      const p = provider;
      scope.run(() => {
        watch(
          p.status,
          (s) => {
            connectionStatus.value = s;
          },
          { immediate: true },
        );
      });
      void provider.connect();

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
    // Snapshot-Flush starten und LAUFEN LASSEN, bevor wir die Y.Doc killen.
    // Wir warten nicht (Navigation soll nicht blockieren), aber wir muessen
    // den Upload aus einem Bytes-Buffer machen, der NICHT mehr von der Doc
    // abhaengt. Daher: snapshotLoop.flush() encodet zuerst (synchron), dann
    // laeuft der Storage-Upload im Hintergrund. Y.Doc darf erst danach weg.
    const pending = snapshotLoop?.flush().catch(() => undefined);
    snapshotLoop?.stop();
    unsubBeforeUnload?.();
    scope.stop();
    provider?.destroy();
    provider = null;
    unbindFlow?.();
    undoManager?.destroy();
    // Y.Doc-Teardown verzoegern, bis Flush das Encoding abgeschlossen hat.
    // pending ist undefined, wenn nichts dirty war.
    if (pending) {
      pending.finally(() => {
        if (board) destroyBoardDoc(board);
        board = null;
      });
    } else {
      if (board) destroyBoardDoc(board);
      board = null;
    }
  });

  return {
    nodes,
    edges,
    ready,
    error,
    snapshotState,
    connectionStatus,
    awareness,
    getBoard: () => board,
    getUndoManager: () => undoManager,
    getProvider: () => provider,
    flush: async () => {
      await snapshotLoop?.flush();
    },
  };
}
