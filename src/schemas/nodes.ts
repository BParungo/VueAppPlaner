import { z } from 'zod';

export const typedFieldSchema = z.object({
  name: z.string().min(1, 'Name leer'),
  type: z.string().min(1, 'Type leer'),
});
export type TypedField = z.infer<typeof typedFieldSchema>;

export const dataSourceSchema = z.object({
  label: z.string().default('Data Source'),
  kind: z.enum(['rest', 'graphql', 'static']).default('rest'),
  endpoint: z.string().default(''),
  fields: z.array(typedFieldSchema).default([]),
});

export const componentSchema = z.object({
  label: z.string().default('Component'),
  componentName: z.string().default('MyComponent'),
  props: z.array(typedFieldSchema).default([]),
  emits: z.array(typedFieldSchema).default([]),
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
  state: z.array(typedFieldSchema).default([]),
  actions: z.array(typedFieldSchema).default([]),
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

export function asTypedFields(value: unknown): TypedField[] {
  return Array.isArray(value) ? (value as TypedField[]) : [];
}
