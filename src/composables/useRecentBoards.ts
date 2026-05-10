import { useStorage } from '@vueuse/core';

export interface RecentBoard {
  id: string;
  name: string;
  visitedAt: number;
}

const MAX_RECENT = 10;

export function useRecentBoards() {
  const boards = useStorage<RecentBoard[]>('vap.recentBoards', []);

  function track(board: { id: string; name: string }) {
    const now = Date.now();
    const next = boards.value.filter((b) => b.id !== board.id);
    next.unshift({ ...board, visitedAt: now });
    boards.value = next.slice(0, MAX_RECENT);
  }

  function remove(id: string) {
    boards.value = boards.value.filter((b) => b.id !== id);
  }

  return { boards, track, remove };
}
