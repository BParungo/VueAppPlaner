import type { Ref } from 'vue';
import type { Awareness } from 'y-protocols/awareness';
import type { BoardDoc } from './doc';

export type ProviderStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface YProvider {
  readonly status: Ref<ProviderStatus>;
  readonly awareness: Awareness;
  connect: () => Promise<void>;
  disconnect: () => void;
  destroy: () => void;
}

export interface YProviderFactory {
  (
    boardId: string,
    board: BoardDoc,
    localUser: { clientId: string; displayName: string; color: string },
  ): YProvider;
}
