import type { BoardDoc } from './doc';
import { ORIGIN_LOCAL } from './flow-sync';

const KEY_NAME = 'name';

export const ORIGIN_META_INIT = 'meta-init';

export function getBoardName(board: BoardDoc): string | null {
  const v = board.yMeta.get(KEY_NAME);
  return typeof v === 'string' ? v : null;
}

export function setBoardName(board: BoardDoc, name: string) {
  board.doc.transact(() => {
    board.yMeta.set(KEY_NAME, name);
  }, ORIGIN_LOCAL);
}

export function seedBoardName(board: BoardDoc, name: string) {
  if (getBoardName(board) !== null) return;
  board.doc.transact(() => {
    board.yMeta.set(KEY_NAME, name);
  }, ORIGIN_META_INIT);
}

export function observeBoardName(
  board: BoardDoc,
  cb: (name: string | null) => void,
): () => void {
  const handler = (e: { keysChanged: Set<string> }) => {
    if (e.keysChanged.has(KEY_NAME)) cb(getBoardName(board));
  };
  board.yMeta.observe(handler);
  return () => board.yMeta.unobserve(handler);
}
