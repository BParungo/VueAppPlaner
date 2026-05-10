import { inject, provide, type InjectionKey, type Ref } from 'vue';
import type { FlowEdgeShape, FlowNodeShape } from '@/lib/yjs/doc';

export interface BoardContext {
  nodes: Ref<FlowNodeShape[]>;
  edges: Ref<FlowEdgeShape[]>;
}

export const boardContextKey: InjectionKey<BoardContext> =
  Symbol('vap.boardContext');

export function provideBoardContext(ctx: BoardContext) {
  provide(boardContextKey, ctx);
}

export function useBoardContext(): BoardContext | null {
  return inject(boardContextKey, null);
}
