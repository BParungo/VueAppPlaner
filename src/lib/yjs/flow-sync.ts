import type { Ref } from 'vue';
import type {
  EdgeChange,
  NodeChange,
} from '@vue-flow/core';
import type { BoardDoc, FlowEdgeShape, FlowNodeShape } from './doc';

const ORIGIN_LOCAL = 'local';
export const ORIGIN_REMOTE = 'remote';
export const ORIGIN_INIT = 'init';

function readNodes(board: BoardDoc): FlowNodeShape[] {
  return Array.from(board.yNodes.values()).map(cloneNode);
}

function readEdges(board: BoardDoc): FlowEdgeShape[] {
  return Array.from(board.yEdges.values()).map(cloneEdge);
}

function cloneNode(n: FlowNodeShape): FlowNodeShape {
  return {
    id: n.id,
    type: n.type,
    position: { x: n.position.x, y: n.position.y },
    data: { ...n.data },
    width: n.width,
    height: n.height,
  };
}

function cloneEdge(e: FlowEdgeShape): FlowEdgeShape {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    label: e.label,
    animated: e.animated,
  };
}

export function bindFlowToYDoc(
  board: BoardDoc,
  nodes: Ref<FlowNodeShape[]>,
  edges: Ref<FlowEdgeShape[]>,
) {
  nodes.value = readNodes(board);
  edges.value = readEdges(board);

  const onNodes = () => {
    nodes.value = readNodes(board);
  };
  const onEdges = () => {
    edges.value = readEdges(board);
  };

  board.yNodes.observeDeep(onNodes);
  board.yEdges.observeDeep(onEdges);

  return () => {
    board.yNodes.unobserveDeep(onNodes);
    board.yEdges.unobserveDeep(onEdges);
  };
}

export function applyNodeChangesToYDoc(
  board: BoardDoc,
  changes: NodeChange[],
) {
  board.doc.transact(() => {
    for (const change of changes) {
      switch (change.type) {
        case 'add': {
          const n = change.item as unknown as FlowNodeShape;
          board.yNodes.set(n.id, cloneNode(n));
          break;
        }
        case 'remove': {
          board.yNodes.delete(change.id);
          break;
        }
        case 'position': {
          if (!change.position) break;
          const existing = board.yNodes.get(change.id);
          if (!existing) break;
          board.yNodes.set(change.id, {
            ...cloneNode(existing),
            position: { x: change.position.x, y: change.position.y },
          });
          break;
        }
        case 'dimensions': {
          const existing = board.yNodes.get(change.id);
          if (!existing) break;
          const dims = (
            change as unknown as {
              dimensions?: { width: number; height: number };
            }
          ).dimensions;
          if (!dims) break;
          board.yNodes.set(change.id, {
            ...cloneNode(existing),
            width: dims.width,
            height: dims.height,
          });
          break;
        }
        // 'select' und andere UI-only-Changes ignorieren wir bewusst.
        default:
          break;
      }
    }
  }, ORIGIN_LOCAL);
}

export function applyEdgeChangesToYDoc(
  board: BoardDoc,
  changes: EdgeChange[],
) {
  board.doc.transact(() => {
    for (const change of changes) {
      switch (change.type) {
        case 'add': {
          const e = change.item as unknown as FlowEdgeShape;
          board.yEdges.set(e.id, cloneEdge(e));
          break;
        }
        case 'remove': {
          board.yEdges.delete(change.id);
          break;
        }
        default:
          break;
      }
    }
  }, ORIGIN_LOCAL);
}

export function addNode(board: BoardDoc, node: FlowNodeShape) {
  board.doc.transact(() => {
    board.yNodes.set(node.id, cloneNode(node));
  }, ORIGIN_LOCAL);
}

export function addEdge(board: BoardDoc, edge: FlowEdgeShape) {
  board.doc.transact(() => {
    board.yEdges.set(edge.id, cloneEdge(edge));
  }, ORIGIN_LOCAL);
}

export function updateNodeData(
  board: BoardDoc,
  id: string,
  data: Record<string, unknown>,
) {
  const existing = board.yNodes.get(id);
  if (!existing) return;
  board.doc.transact(() => {
    board.yNodes.set(id, {
      ...cloneNode(existing),
      data: { ...existing.data, ...data },
    });
  }, ORIGIN_LOCAL);
}
