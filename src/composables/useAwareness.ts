import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { Awareness } from 'y-protocols/awareness';

export interface AwarenessUserState {
  clientId: string;
  name: string;
  color: string;
}

export interface AwarenessState {
  user: AwarenessUserState;
  cursor: { x: number; y: number } | null;
  selection: string | null;
}

export interface AwarenessPeer extends AwarenessState {
  yClientId: number;
}

export function useAwareness(awarenessRef: Ref<Awareness | null>): {
  peers: Ref<AwarenessPeer[]>;
  setCursor: (pos: { x: number; y: number } | null) => void;
  setSelection: (id: string | null) => void;
} {
  const peers = ref<AwarenessPeer[]>([]) as Ref<AwarenessPeer[]>;

  // Cursor: 50ms Trailing-Throttle (~20Hz). rAF waere 60Hz und wuerde
  // unter Last das Awareness-Message-Budget unnoetig auffressen.
  const CURSOR_THROTTLE_MS = 50;
  let cursorTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingCursor: { x: number; y: number } | null = null;
  let cursorDirty = false;
  let lastCursorFlushAt = 0;
  let bound: Awareness | null = null;
  let unsubChange: (() => void) | null = null;

  function refresh(a: Awareness) {
    const next: AwarenessPeer[] = [];
    a.getStates().forEach((value, yClientId) => {
      if (yClientId === a.clientID) return;
      const s = value as Partial<AwarenessState> | undefined;
      if (!s || !s.user) return;
      next.push({
        yClientId,
        user: s.user,
        cursor: s.cursor ?? null,
        selection: s.selection ?? null,
      });
    });
    peers.value = next;
  }

  watch(
    awarenessRef,
    (a) => {
      unsubChange?.();
      unsubChange = null;
      bound = a;
      if (!a) {
        peers.value = [];
        return;
      }
      const handler = () => refresh(a);
      a.on('change', handler);
      unsubChange = () => a.off('change', handler);
      refresh(a);
    },
    { immediate: true },
  );

  function flushCursor() {
    cursorTimer = null;
    if (!cursorDirty) return;
    cursorDirty = false;
    lastCursorFlushAt = Date.now();
    if (!bound) return;
    bound.setLocalStateField('cursor', pendingCursor);
  }

  function setCursor(pos: { x: number; y: number } | null) {
    pendingCursor = pos;
    cursorDirty = true;
    if (cursorTimer !== null) return;
    const elapsed = Date.now() - lastCursorFlushAt;
    const delay = Math.max(0, CURSOR_THROTTLE_MS - elapsed);
    cursorTimer = setTimeout(flushCursor, delay);
  }

  function setSelection(id: string | null) {
    if (!bound) return;
    const local = bound.getLocalState() as AwarenessState | null;
    if (!local) return;
    if (local.selection === id) return;
    bound.setLocalStateField('selection', id);
  }

  onBeforeUnmount(() => {
    unsubChange?.();
    if (cursorTimer !== null) {
      clearTimeout(cursorTimer);
      cursorTimer = null;
    }
  });

  return { peers, setCursor, setSelection };
}
