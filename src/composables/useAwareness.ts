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

  let cursorRaf: number | null = null;
  let pendingCursor: { x: number; y: number } | null = null;
  let cursorDirty = false;
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

  function setCursor(pos: { x: number; y: number } | null) {
    pendingCursor = pos;
    cursorDirty = true;
    if (cursorRaf !== null) return;
    cursorRaf = requestAnimationFrame(() => {
      cursorRaf = null;
      if (!cursorDirty) return;
      cursorDirty = false;
      if (!bound) return;
      const local = bound.getLocalState() as AwarenessState | null;
      if (!local) return;
      bound.setLocalState({ ...local, cursor: pendingCursor });
    });
  }

  function setSelection(id: string | null) {
    if (!bound) return;
    const local = bound.getLocalState() as AwarenessState | null;
    if (!local) return;
    if (local.selection === id) return;
    bound.setLocalState({ ...local, selection: id });
  }

  onBeforeUnmount(() => {
    unsubChange?.();
    if (cursorRaf !== null) cancelAnimationFrame(cursorRaf);
  });

  return { peers, setCursor, setSelection };
}
