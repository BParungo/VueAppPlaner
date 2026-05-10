import { markRaw, type Component } from 'vue';
import DataSourceNode from './DataSourceNode.vue';
import ComponentNode from './ComponentNode.vue';
import RouteNode from './RouteNode.vue';
import StoreNode from './StoreNode.vue';
import type { NodeKind } from '@/schemas/nodes';

export const nodeTypes: Record<NodeKind, Component> = {
  dataSource: markRaw(DataSourceNode),
  component: markRaw(ComponentNode),
  route: markRaw(RouteNode),
  store: markRaw(StoreNode),
};

export { DataSourceNode, ComponentNode, RouteNode, StoreNode };
