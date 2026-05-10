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

  // Outgoing Doc-Updates: Trailing-Coalesce 100ms.
  // Vue Flow feuert beim Draggen 30-60 Updates/s. Ohne Throttle wuerden wir
  // pro Frame broadcasten und das Free-Tier-Message-Budget zerlegen.
  const DOC_THROTTLE_MS = 100;
  const pendingUpdates: Uint8Array[] = [];
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFlushAt = 0;

  function flushPendingUpdates() {
    throttleTimer = null;
    if (pendingUpdates.length === 0) return;
    const merged = Y.mergeUpdates(pendingUpdates.splice(0));
    lastFlushAt = Date.now();
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
  }

  function scheduleFlush() {
    if (throttleTimer !== null) return;
    const elapsed = Date.now() - lastFlushAt;
    const delay = Math.max(0, DOC_THROTTLE_MS - elapsed);
    throttleTimer = setTimeout(flushPendingUpdates, delay);
  }

  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === ORIGIN_REMOTE) return;
    pendingUpdates.push(update);
    scheduleFlush();
  };
  board.doc.on('update', onDocUpdate);

  // Outgoing Awareness-Updates: Microtask-Coalesce.
  // Mehrere setLocalStateField-Calls im selben Tick (Cursor + Selection)
  // werden zu einem Broadcast gemerged. Kein zeitliches Throttle hier,
  // weil setCursor in useAwareness bereits gedrosselt wird.
  const pendingAwarenessChanged = new Set<number>();
  let awarenessFlushScheduled = false;

  function flushAwareness() {
    awarenessFlushScheduled = false;
    if (pendingAwarenessChanged.size === 0) return;
    const changed = Array.from(pendingAwarenessChanged);
    pendingAwarenessChanged.clear();
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
  }

  const onAwarenessUpdate = (
    {
      added,
      updated,
      removed,
    }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === 'remote-awareness') return;
    for (const id of added) pendingAwarenessChanged.add(id);
    for (const id of updated) pendingAwarenessChanged.add(id);
    for (const id of removed) pendingAwarenessChanged.add(id);
    if (pendingAwarenessChanged.size === 0) return;
    if (awarenessFlushScheduled) return;
    awarenessFlushScheduled = true;
    queueMicrotask(flushAwareness);
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
    syncResReceived = true;
    clearSyncRetry();
    const update = base64ToBytes(msg.payload);
    Y.applyUpdate(board.doc, update, ORIGIN_REMOTE);
  }

  // Sync-Request: 0-500ms Jitter (Thundering-Herd-Schutz) +
  // Retry-Loop falls niemand antwortet. Letzteres ist wichtig, wenn ein
  // Peer joint waehrend der einzige andere Peer gerade reconnected oder
  // den Channel-Subscribe noch nicht abgeschlossen hat — sonst sehen wir
  // bis zum naechsten lokalen Edit nur unseren IndexedDB-Stand.
  const SYNC_RETRY_DELAY_MS = 2000;
  const SYNC_MAX_ATTEMPTS = 3;
  let syncReqTimer: ReturnType<typeof setTimeout> | null = null;
  let syncRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let syncAttempt = 0;
  let syncResReceived = false;

  function clearSyncReq() {
    if (syncReqTimer !== null) {
      clearTimeout(syncReqTimer);
      syncReqTimer = null;
    }
    clearSyncRetry();
  }

  function clearSyncRetry() {
    if (syncRetryTimer !== null) {
      clearTimeout(syncRetryTimer);
      syncRetryTimer = null;
    }
  }

  function sendSyncRequestNow() {
    syncReqTimer = null;
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

    // Retry, falls keine SYNC_RES innerhalb von SYNC_RETRY_DELAY_MS kommt.
    clearSyncRetry();
    if (syncAttempt < SYNC_MAX_ATTEMPTS) {
      syncRetryTimer = setTimeout(() => {
        syncRetryTimer = null;
        if (syncResReceived || destroyed) return;
        syncAttempt++;
        sendSyncRequestNow();
      }, SYNC_RETRY_DELAY_MS);
    }
  }

  function broadcastSyncRequest() {
    clearSyncReq();
    syncAttempt = 1;
    syncResReceived = false;
    const jitter = Math.floor(Math.random() * 500);
    syncReqTimer = setTimeout(sendSyncRequestNow, jitter);
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
        // Full-State-Push: unser SYNC_REQ holt nur Diffs FROM Peers,
        // pusht aber unsere eigenen Updates nicht aktiv. Beim Reload-Mount
        // hat der Peer evtl. Edits, die andere Peers nie gesehen haben
        // (weil Channel beim Editieren down war oder Peer-B noch nicht
        // joint hatte). Daher pushen wir einmalig den vollen Doc-State.
        // Y.js mergt idempotent. Skip wenn Doc leer.
        const fullState = Y.encodeStateAsUpdate(board.doc);
        if (fullState.byteLength > 2) {
          ch.send({
            type: 'broadcast',
            event: EV_UPDATE,
            payload: {
              sender: senderId,
              payload: bytesToBase64(fullState),
            } satisfies UpdateMsg,
          }).catch((e) =>
            console.warn('[provider] full-state push failed', e),
          );
        }
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
    clearSyncReq();
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
    clearSyncReq();
    if (throttleTimer !== null) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
    pendingUpdates.length = 0;
    pendingAwarenessChanged.clear();
    awarenessFlushScheduled = false;
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
