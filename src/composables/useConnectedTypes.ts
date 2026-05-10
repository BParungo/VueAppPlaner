import { computed, type ComputedRef, type Ref } from 'vue';
import type { FlowEdgeShape, FlowNodeShape } from '@/lib/yjs/doc';
import {
  asTypedFields,
  type TypedField,
} from '@/schemas/nodes';

export interface ConnectedSource {
  sourceId: string;
  sourceType: 'dataSource' | 'store' | 'component' | 'route' | 'composable' | 'note';
  sourceLabel: string;
  fields: TypedField[];
}

function fieldsFromNode(node: FlowNodeShape): TypedField[] {
  const data = (node.data ?? {}) as Record<string, unknown>;
  switch (node.type) {
    case 'dataSource':
      return asTypedFields(data.fields);
    case 'store':
      return asTypedFields(data.state);
    case 'component':
      return asTypedFields(data.props);
    case 'composable':
      return asTypedFields(data.returns);
    default:
      return [];
  }
}

function labelFromNode(node: FlowNodeShape): string {
  const data = (node.data ?? {}) as Record<string, unknown>;
  if (typeof data.label === 'string' && data.label.trim()) return data.label;
  if (typeof data.componentName === 'string') return data.componentName;
  if (typeof data.storeName === 'string') return data.storeName;
  if (typeof data.composableName === 'string') return data.composableName;
  if (typeof data.path === 'string') return data.path;
  return node.id.slice(0, 6);
}

export function useConnectedTypes(
  nodeId: Ref<string> | string,
  allNodes: Ref<FlowNodeShape[]>,
  allEdges: Ref<FlowEdgeShape[]>,
): ComputedRef<ConnectedSource[]> {
  return computed(() => {
    const id = typeof nodeId === 'string' ? nodeId : nodeId.value;
    const incoming = allEdges.value.filter((e) => e.target === id);
    if (!incoming.length) return [];

    const nodeMap = new Map<string, FlowNodeShape>(
      allNodes.value.map((n) => [n.id, n]),
    );

    return incoming
      .map<ConnectedSource | null>((edge) => {
        const src = nodeMap.get(edge.source);
        if (!src) return null;
        return {
          sourceId: src.id,
          sourceType: src.type,
          sourceLabel: labelFromNode(src),
          fields: fieldsFromNode(src),
        };
      })
      .filter((s): s is ConnectedSource => s !== null);
  });
}
