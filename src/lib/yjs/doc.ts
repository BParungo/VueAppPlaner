import * as Y from 'yjs';
import type { NodeKind } from '@/schemas/nodes';

export interface FlowNodeShape {
  id: string;
  type: NodeKind;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  width?: number;
  height?: number;
}

export interface FlowEdgeShape {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  animated?: boolean;
}

export interface BoardDoc {
  doc: Y.Doc;
  yNodes: Y.Map<FlowNodeShape>;
  yEdges: Y.Map<FlowEdgeShape>;
  yMeta: Y.Map<unknown>;
}

export function createBoardDoc(): BoardDoc {
  const doc = new Y.Doc();
  const yNodes = doc.getMap<FlowNodeShape>('nodes');
  const yEdges = doc.getMap<FlowEdgeShape>('edges');
  const yMeta = doc.getMap<unknown>('meta');
  return { doc, yNodes, yEdges, yMeta };
}

export function destroyBoardDoc(board: BoardDoc) {
  board.doc.destroy();
}
