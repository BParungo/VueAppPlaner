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

export const composableSchema = z.object({
  label: z.string().default('Composable'),
  composableName: z.string().default('useThing'),
  params: z.array(typedFieldSchema).default([]),
  returns: z.array(typedFieldSchema).default([]),
});

export const NOTE_COLORS = ['yellow', 'blue', 'green', 'red', 'gray'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export const noteSchema = z.object({
  label: z.string().default('Note'),
  body: z.string().default(''),
  color: z.enum(NOTE_COLORS).default('yellow'),
});

export type DataSourceData = z.infer<typeof dataSourceSchema>;
export type ComponentData = z.infer<typeof componentSchema>;
export type RouteData = z.infer<typeof routeSchema>;
export type StoreData = z.infer<typeof storeSchema>;
export type ComposableData = z.infer<typeof composableSchema>;
export type NoteData = z.infer<typeof noteSchema>;

export type NodeKind =
  | 'dataSource'
  | 'component'
  | 'route'
  | 'store'
  | 'composable'
  | 'note';

export const NODE_LABELS: Record<NodeKind, string> = {
  dataSource: 'Data Source',
  component: 'Component',
  route: 'Route',
  store: 'Store',
  composable: 'Composable',
  note: 'Note',
};

export const NODE_DEFAULTS: Record<NodeKind, () => unknown> = {
  dataSource: () => dataSourceSchema.parse({}),
  component: () => componentSchema.parse({}),
  route: () => routeSchema.parse({}),
  store: () => storeSchema.parse({}),
  composable: () => composableSchema.parse({}),
  note: () => noteSchema.parse({}),
};

export function asTypedFields(value: unknown): TypedField[] {
  return Array.isArray(value) ? (value as TypedField[]) : [];
}
