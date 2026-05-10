import { ref, type Ref } from 'vue';
import * as Y from 'yjs';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { base64ToBytes, bytesToBase64 } from './base64';
import { ORIGIN_REMOTE } from './flow-sync';
import type { BoardDoc } from './doc';
import type { ProviderStatus, YProvider } from './provider';

const EV_UPDATE = 'y-update';
const EV_SYNC_REQ = 'y-sync-req';
const EV_SYNC_RES = 'y-sync-res';
const EV_AWARENESS = 'y-awareness';

interface UpdateMsg {
  sender: string;
  payload: string;
}

interface SyncReqMsg {
  sender: string;
  sv: string;
}

interface SyncResMsg {
  sender: string;
  to: string;
  payload: string;
}

interface AwarenessMsg {
  sender: string;
  payload: string;
}

export function createSupabaseProvider(
  boardId: string,
  board: BoardDoc,
  localUser: { clientId: string; displayName: string; color: string },
): YProvider {
  const status = ref<ProviderStatus>('connecting') as Ref<ProviderStatus>;
  const awareness = new Awareness(board.doc);
  awareness.setLocalState({
    user: {
      clientId: localUser.clientId,
      name: localUser.displayName,
      color: localUser.color,
    },
    cursor: null,
    selection: null,
  });

  const senderId = localUser.clientId;
  let channel: RealtimeChannel | null = null;
  let destroyed = false;

  // Outgoing Doc-Updates: Microtask-Batch
  const pendingUpdates: Uint8Array[] = [];
  let flushScheduled = false;

  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    queueMicrotask(() => {
      flushScheduled = false;
      if (pendingUpdates.length === 0) return;
      const merged = Y.mergeUpdates(pendingUpdates.splice(0));
      if (!channel || status.value !== 'connected') return;
      channel
        .send({
          type: 'broadcast',
          event: EV_UPDATE,
          payload: {
            sender: senderId,
            payload: bytesToBase64(merged),
          } satisfies UpdateMsg,
        })
        .catch((e) => console.warn('[provider] broadcast update failed', e));
    });
  }

  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === ORIGIN_REMOTE) return;
    pendingUpdates.push(update);
    scheduleFlush();
  };
  board.doc.on('update', onDocUpdate);

  // Outgoing Awareness-Updates
  const onAwarenessUpdate = (
    {
      added,
      updated,
      removed,
    }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === 'remote-awareness') return;
    const changed = added.concat(updated, removed);
    if (changed.length === 0) return;
    if (!channel || status.value !== 'connected') return;
    const payload = encodeAwarenessUpdate(awareness, changed);
    channel
      .send({
        type: 'broadcast',
        event: EV_AWARENESS,
        payload: {
          sender: senderId,
          payload: bytesToBase64(payload),
        } satisfies AwarenessMsg,
      })
      .catch((e) => console.warn('[provider] broadcast awareness failed', e));
  };
  awareness.on('update', onAwarenessUpdate);

  function applyIncomingUpdate(msg: UpdateMsg) {
    if (msg.sender === senderId) return;
    const update = base64ToBytes(msg.payload);
    Y.applyUpdate(board.doc, update, ORIGIN_REMOTE);
  }

  function applyIncomingAwareness(msg: AwarenessMsg) {
    if (msg.sender === senderId) return;
    const update = base64ToBytes(msg.payload);
    applyAwarenessUpdate(awareness, update, 'remote-awareness');
  }

  function handleSyncReq(msg: SyncReqMsg) {
    if (msg.sender === senderId) return;
    const sv = base64ToBytes(msg.sv);
    const diff = Y.encodeStateAsUpdate(board.doc, sv);
    if (!channel || status.value !== 'connected') return;
    channel
      .send({
        type: 'broadcast',
        event: EV_SYNC_RES,
        payload: {
          sender: senderId,
          to: msg.sender,
          payload: bytesToBase64(diff),
        } satisfies SyncResMsg,
      })
      .catch((e) => console.warn('[provider] broadcast sync-res failed', e));
  }

  function handleSyncRes(msg: SyncResMsg) {
    if (msg.to !== senderId) return;
    const update = base64ToBytes(msg.payload);
    Y.applyUpdate(board.doc, update, ORIGIN_REMOTE);
  }

  function broadcastSyncRequest() {
    if (!channel || status.value !== 'connected') return;
    const sv = Y.encodeStateVector(board.doc);
    channel
      .send({
        type: 'broadcast',
        event: EV_SYNC_REQ,
        payload: {
          sender: senderId,
          sv: bytesToBase64(sv),
        } satisfies SyncReqMsg,
      })
      .catch((e) => console.warn('[provider] broadcast sync-req failed', e));
  }

  // Reconnect-Backoff
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function clearReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    if (destroyed) return;
    clearReconnect();
    const delay = Math.min(10_000, 1000 * Math.pow(2, reconnectAttempt));
    reconnectAttempt++;
    reconnectTimer = setTimeout(() => {
      void connect();
    }, delay);
  }

  async function connect() {
    if (destroyed) return;
    clearReconnect();
    status.value = 'connecting';

    if (channel) {
      try {
        await supabase.removeChannel(channel);
      } catch {
        // ignore
      }
      channel = null;
    }

    const ch = supabase.channel(`board:${boardId}`, {
      config: { broadcast: { self: false, ack: false } },
    });

    ch.on('broadcast', { event: EV_UPDATE }, ({ payload }) => {
      applyIncomingUpdate(payload as UpdateMsg);
    });
    ch.on('broadcast', { event: EV_SYNC_REQ }, ({ payload }) => {
      handleSyncReq(payload as SyncReqMsg);
    });
    ch.on('broadcast', { event: EV_SYNC_RES }, ({ payload }) => {
      handleSyncRes(payload as SyncResMsg);
    });
    ch.on('broadcast', { event: EV_AWARENESS }, ({ payload }) => {
      applyIncomingAwareness(payload as AwarenessMsg);
    });

    ch.subscribe((subStatus) => {
      if (destroyed) return;
      if (subStatus === 'SUBSCRIBED') {
        channel = ch;
        status.value = 'connected';
        reconnectAttempt = 0;
        broadcastSyncRequest();
        // Awareness-State neu broadcasten, damit Peers uns sehen
        const local = awareness.getLocalState();
        if (local) {
          awareness.setLocalState({ ...local });
        }
      } else if (
        subStatus === 'CHANNEL_ERROR' ||
        subStatus === 'TIMED_OUT' ||
        subStatus === 'CLOSED'
      ) {
        status.value =
          subStatus === 'CHANNEL_ERROR' ? 'error' : 'disconnected';
        scheduleReconnect();
      }
    });
  }

  function disconnect() {
    clearReconnect();
    if (channel) {
      void supabase.removeChannel(channel).catch(() => undefined);
      channel = null;
    }
    status.value = 'disconnected';
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    clearReconnect();
    board.doc.off('update', onDocUpdate);
    awareness.off('update', onAwarenessUpdate);
    removeAwarenessStates(
      awareness,
      [board.doc.clientID],
      'provider-destroy',
    );
    awareness.destroy();
    if (channel) {
      void supabase.removeChannel(channel).catch(() => undefined);
      channel = null;
    }
    status.value = 'disconnected';
  }

  return {
    status,
    awareness,
    connect,
    disconnect,
    destroy,
  };
}
