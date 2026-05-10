import { z } from 'zod';

export const dataSourceSchema = z.object({
  label: z.string().default('Data Source'),
  kind: z.enum(['rest', 'graphql', 'static']).default('rest'),
  endpoint: z.string().default(''),
  fields: z.array(z.string()).default([]),
});

export const componentSchema = z.object({
  label: z.string().default('Component'),
  componentName: z.string().default('MyComponent'),
  props: z.array(z.string()).default([]),
  mockItems: z.number().int().nonnegative().default(0),
});

export const routeSchema = z.object({
  label: z.string().default('Route'),
  path: z.string().default('/'),
  componentRef: z.string().default(''),
});

export const storeSchema = z.object({
  label: z.string().default('Store'),
  storeName: z.string().default('useMyStore'),
  state: z.array(z.string()).default([]),
  actions: z.array(z.string()).default([]),
});

export type DataSourceData = z.infer<typeof dataSourceSchema>;
export type ComponentData = z.infer<typeof componentSchema>;
export type RouteData = z.infer<typeof routeSchema>;
export type StoreData = z.infer<typeof storeSchema>;

export type NodeKind = 'dataSource' | 'component' | 'route' | 'store';

export const NODE_LABELS: Record<NodeKind, string> = {
  dataSource: 'Data Source',
  component: 'Component',
  route: 'Route',
  store: 'Store',
};

export const NODE_DEFAULTS: Record<NodeKind, () => unknown> = {
  dataSource: () => dataSourceSchema.parse({}),
  component: () => componentSchema.parse({}),
  route: () => routeSchema.parse({}),
  store: () => storeSchema.parse({}),
};
