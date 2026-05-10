import type { Component } from 'vue';
import DataSourceNode from './DataSourceNode.vue';
import ComponentNode from './ComponentNode.vue';
import RouteNode from './RouteNode.vue';
import StoreNode from './StoreNode.vue';
import type { NodeKind } from '@/schemas/nodes';

export const nodeTypes: Record<NodeKind, Component> = {
  dataSource: DataSourceNode,
  component: ComponentNode,
  route: RouteNode,
  store: StoreNode,
};

export { DataSourceNode, ComponentNode, RouteNode, StoreNode };
