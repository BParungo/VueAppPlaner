import { IndexeddbPersistence } from 'y-indexeddb';
import type { BoardDoc } from './doc';

export function attachIndexedDb(boardId: string, board: BoardDoc) {
  const persistence = new IndexeddbPersistence(
    `vap.board.${boardId}`,
    board.doc,
  );
  const ready = new Promise<void>((resolve) => {
    persistence.once('synced', () => resolve());
  });
  return { persistence, ready };
}
