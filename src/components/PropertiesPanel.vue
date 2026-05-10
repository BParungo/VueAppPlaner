<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import TypedFieldList from '@/components/TypedFieldList.vue';
import {
  componentSchema,
  dataSourceSchema,
  routeSchema,
  storeSchema,
  type NodeKind,
  type TypedField,
} from '@/schemas/nodes';
import type { BoardDoc, FlowNodeShape } from '@/lib/yjs/doc';
import { updateNodeData } from '@/lib/yjs/flow-sync';

const props = defineProps<{
  board: BoardDoc | null;
  nodes: FlowNodeShape[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const selectedNode = computed<FlowNodeShape | null>(() => {
  if (!props.selectedId) return null;
  return props.nodes.find((n) => n.id === props.selectedId) ?? null;
});

const draft = ref<Record<string, unknown>>({});
const errorMsg = ref<string | null>(null);

watch(
  selectedNode,
  (node) => {
    if (!node) {
      draft.value = {};
      errorMsg.value = null;
      return;
    }
    draft.value = JSON.parse(JSON.stringify(node.data));
    errorMsg.value = null;
  },
  { immediate: true },
);

function schemaFor(kind: NodeKind) {
  switch (kind) {
    case 'dataSource':
      return dataSourceSchema;
    case 'component':
      return componentSchema;
    case 'route':
      return routeSchema;
    case 'store':
      return storeSchema;
  }
}

function commit() {
  if (!props.board || !selectedNode.value) return;
  const schema = schemaFor(selectedNode.value.type);
  const result = schema.safeParse(draft.value);
  if (!result.success) {
    errorMsg.value = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('; ');
    return;
  }
  errorMsg.value = null;
  updateNodeData(props.board, selectedNode.value.id, result.data);
}

function setFieldList(key: string, value: TypedField[]) {
  (draft.value as Record<string, unknown>)[key] = value;
  commit();
}
</script>

<template>
  <aside
    class="w-80 shrink-0 border-l bg-muted/30 overflow-y-auto"
    aria-label="Properties Panel"
  >
    <div class="p-4 border-b flex items-center justify-between">
      <h2
        class="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
      >
        Properties
      </h2>
      <Button variant="ghost" size="sm" @click="emit('close')">
        Schließen
      </Button>
    </div>

    <div v-if="!selectedNode" class="p-4 text-sm text-muted-foreground">
      Wähle eine Node auf dem Canvas, um sie zu bearbeiten.
    </div>

    <div v-else class="p-4 space-y-4">
      <Card>
        <CardHeader class="p-4 pb-2">
          <CardTitle class="text-sm">{{ selectedNode.type }}</CardTitle>
          <CardDescription class="text-xs font-mono break-all">
            {{ selectedNode.id }}
          </CardDescription>
        </CardHeader>
        <CardContent class="p-4 pt-2 space-y-4 text-xs">
          <div>
            <label class="block mb-1 text-muted-foreground">label</label>
            <input
              v-model="(draft as any).label"
              class="w-full border rounded px-2 py-1 bg-background"
              @blur="commit"
            />
          </div>

          <template v-if="selectedNode.type === 'dataSource'">
            <div>
              <label class="block mb-1 text-muted-foreground">kind</label>
              <select
                v-model="(draft as any).kind"
                class="w-full border rounded px-2 py-1 bg-background"
                @change="commit"
              >
                <option value="rest">REST</option>
                <option value="graphql">GraphQL</option>
                <option value="static">Static JSON</option>
              </select>
            </div>
            <div>
              <label class="block mb-1 text-muted-foreground">endpoint</label>
              <input
                v-model="(draft as any).endpoint"
                class="w-full border rounded px-2 py-1 bg-background font-mono"
                @blur="commit"
              />
            </div>
            <TypedFieldList
              :model-value="(draft as any).fields ?? []"
              label="fields"
              type-placeholder="string"
              @update:model-value="setFieldList('fields', $event)"
            />
          </template>

          <template v-if="selectedNode.type === 'component'">
            <div>
              <label class="block mb-1 text-muted-foreground">
                componentName
              </label>
              <input
                v-model="(draft as any).componentName"
                class="w-full border rounded px-2 py-1 bg-background font-mono"
                @blur="commit"
              />
            </div>
            <TypedFieldList
              :model-value="(draft as any).props ?? []"
              label="props"
              type-placeholder="string"
              @update:model-value="setFieldList('props', $event)"
            />
            <TypedFieldList
              :model-value="(draft as any).emits ?? []"
              label="emits"
              name-placeholder="event-name"
              type-placeholder="(payload: T) => void"
              @update:model-value="setFieldList('emits', $event)"
            />
            <div>
              <label class="block mb-1 text-muted-foreground">
                mockItems
              </label>
              <input
                v-model.number="(draft as any).mockItems"
                type="number"
                min="0"
                class="w-full border rounded px-2 py-1 bg-background"
                @blur="commit"
              />
            </div>
          </template>

          <template v-if="selectedNode.type === 'route'">
            <div>
              <label class="block mb-1 text-muted-foreground">path</label>
              <input
                v-model="(draft as any).path"
                class="w-full border rounded px-2 py-1 bg-background font-mono"
                @blur="commit"
              />
            </div>
            <div>
              <label class="block mb-1 text-muted-foreground">
                componentRef
              </label>
              <input
                v-model="(draft as any).componentRef"
                class="w-full border rounded px-2 py-1 bg-background font-mono"
                @blur="commit"
              />
            </div>
          </template>

          <template v-if="selectedNode.type === 'store'">
            <div>
              <label class="block mb-1 text-muted-foreground">storeName</label>
              <input
                v-model="(draft as any).storeName"
                class="w-full border rounded px-2 py-1 bg-background font-mono"
                @blur="commit"
              />
            </div>
            <TypedFieldList
              :model-value="(draft as any).state ?? []"
              label="state"
              type-placeholder="string"
              @update:model-value="setFieldList('state', $event)"
            />
            <TypedFieldList
              :model-value="(draft as any).actions ?? []"
              label="actions"
              name-placeholder="actionName"
              type-placeholder="(arg: T) => Promise<R>"
              @update:model-value="setFieldList('actions', $event)"
            />
          </template>

          <p v-if="errorMsg" class="text-destructive text-xs mt-2">
            {{ errorMsg }}
          </p>
        </CardContent>
      </Card>
    </div>
  </aside>
</template>
