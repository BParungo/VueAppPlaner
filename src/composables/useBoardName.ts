import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { BoardDoc } from '@/lib/yjs/doc';
import {
  getBoardName,
  observeBoardName,
  seedBoardName,
  setBoardName,
} from '@/lib/yjs/meta';
import { renameBoard } from '@/lib/supabase/boards';

const POSTGRES_DEBOUNCE_MS = 1000;

export function useBoardName(
  boardId: string,
  getBoard: () => BoardDoc | null,
  ready: Ref<boolean>,
  postgresName: Ref<string | null>,
) {
  const name = ref<string>('');
  let unobserve: (() => void) | null = null;
  let postgresTimer: ReturnType<typeof setTimeout> | null = null;
  let observerStarted = false;

  function flushPostgres(value: string) {
    if (postgresTimer) clearTimeout(postgresTimer);
    postgresTimer = setTimeout(() => {
      postgresTimer = null;
      renameBoard(boardId, value).catch((e) =>
        console.warn('[boardName] renameBoard failed', e),
      );
    }, POSTGRES_DEBOUNCE_MS);
  }

  function startObserver(board: BoardDoc) {
    if (observerStarted) return;
    observerStarted = true;
    unobserve = observeBoardName(board, (next) => {
      name.value = next ?? '';
    });
  }

  // Sobald yReady: wenn yMeta schon einen Namen hat, sofort spiegeln + observen.
  watch(
    ready,
    (r) => {
      if (!r) return;
      const board = getBoard();
      if (!board) return;
      const current = getBoardName(board);
      if (current !== null) {
        name.value = current;
        startObserver(board);
      }
    },
    { immediate: true },
  );

  // Sobald BEIDE bereit sind und yMeta noch leer ist → seed mit Postgres-Wert.
  // Wenn yMeta inzwischen ueber Y.Doc-Sync befuellt wurde, einfach beobachten.
  watch(
    [ready, postgresName],
    ([r, pgName]) => {
      if (!r) return;
      const board = getBoard();
      if (!board) return;
      const current = getBoardName(board);
      if (current !== null) {
        name.value = current;
        startObserver(board);
        return;
      }
      if (pgName !== null) {
        seedBoardName(board, pgName);
        name.value = pgName;
        startObserver(board);
      }
    },
    { immediate: true },
  );

  function set(next: string) {
    const trimmed = next.trim();
    if (!trimmed) return;
    const board = getBoard();
    if (!board) return;
    if (trimmed === name.value) return;
    setBoardName(board, trimmed);
    flushPostgres(trimmed);
  }

  onBeforeUnmount(() => {
    unobserve?.();
    if (postgresTimer) {
      clearTimeout(postgresTimer);
      // letzten Wert noch synchron rausjagen — best effort
      const board = getBoard();
      if (board) {
        const final = getBoardName(board);
        if (final) renameBoard(boardId, final).catch(() => undefined);
      }
    }
  });

  return { name, set };
}
