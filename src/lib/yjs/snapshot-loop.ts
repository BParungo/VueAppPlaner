import * as Y from 'yjs';
import { uploadSnapshot } from './storage';

const DEBOUNCE_MS = 30_000;
const HARD_CAP_MS = 120_000;

export type SnapshotState = 'idle' | 'pending' | 'saving' | 'error';

export interface SnapshotLoop {
  flush: () => Promise<void>;
  stop: () => void;
  state: () => SnapshotState;
  lastError: () => Error | null;
  lastSavedAt: () => number | null;
}

export function startSnapshotLoop(
  boardId: string,
  doc: Y.Doc,
  onState?: (s: SnapshotState) => void,
): SnapshotLoop {
  let state: SnapshotState = 'idle';
  let lastError: Error | null = null;
  let lastSavedAt: number | null = null;

  let dirty = false;
  let lastDirtySince: number | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let inFlight: Promise<void> | null = null;

  function setState(s: SnapshotState) {
    state = s;
    onState?.(s);
  }

  function clearTimer() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  async function performSave() {
    if (stopped) return;
    if (!dirty) return;
    if (inFlight) {
      await inFlight;
      return;
    }

    setState('saving');
    dirty = false;
    lastDirtySince = null;
    clearTimer();

    inFlight = (async () => {
      try {
        await uploadSnapshot(boardId, doc);
        lastSavedAt = Date.now();
        lastError = null;
        setState('idle');
      } catch (err) {
        lastError = err as Error;
        dirty = true;
        if (!lastDirtySince) lastDirtySince = Date.now();
        setState('error');
        scheduleDebounced();
      }
    })();

    try {
      await inFlight;
    } finally {
      inFlight = null;
    }
  }

  function scheduleDebounced() {
    if (stopped) return;
    clearTimer();

    if (lastDirtySince && Date.now() - lastDirtySince >= HARD_CAP_MS) {
      void performSave();
      return;
    }

    const sinceDirty = lastDirtySince
      ? Date.now() - lastDirtySince
      : 0;
    const remainingUntilCap = HARD_CAP_MS - sinceDirty;
    const delay = Math.min(DEBOUNCE_MS, Math.max(0, remainingUntilCap));

    debounceTimer = setTimeout(() => {
      void performSave();
    }, delay);
  }

  const onUpdate = (_update: Uint8Array, origin: unknown) => {
    if (origin === 'remote' || origin === 'init') return;
    dirty = true;
    if (!lastDirtySince) lastDirtySince = Date.now();
    if (state !== 'saving') setState('pending');
    scheduleDebounced();
  };

  doc.on('update', onUpdate);

  return {
    async flush() {
      if (!dirty && !inFlight) return;
      clearTimer();
      await performSave();
      if (inFlight) await inFlight;
    },
    stop() {
      stopped = true;
      clearTimer();
      doc.off('update', onUpdate);
    },
    state: () => state,
    lastError: () => lastError,
    lastSavedAt: () => lastSavedAt,
  };
}
