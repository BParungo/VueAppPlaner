<script setup lang="ts">
import { computed, toRef } from 'vue';
import { Handle, Position, type NodeProps } from '@vue-flow/core';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import FieldList, {
  type FieldStatus,
} from '@/components/FieldList.vue';
import { useBoardContext } from '@/composables/boardContext';
import { useConnectedTypes } from '@/composables/useConnectedTypes';
import { buildNodeReport } from '@/lib/types/match';
import { asTypedFields, type ComponentData } from '@/schemas/nodes';

const props = defineProps<NodeProps<ComponentData>>();

const ctx = useBoardContext();
const idRef = toRef(props, 'id');
const connected = ctx
  ? useConnectedTypes(idRef, ctx.nodes, ctx.edges)
  : computed(() => []);

const report = computed(() => {
  if (!ctx) return null;
  return buildNodeReport(props.id, ctx.nodes.value, ctx.edges.value);
});

const propStatuses = computed<(FieldStatus | undefined)[]>(() =>
  (report.value?.propStatuses ?? []).map((s) => ({
    mode: s.status,
    expectedType: s.expectedType,
    actualType: s.actualType,
  })),
);

const emitStatuses = computed<(FieldStatus | undefined)[]>(() =>
  (report.value?.emitStatuses ?? []).map((s) => ({
    mode: s.status,
    expectedType: s.expectedType,
    actualType: s.actualType,
  })),
);

// Felder einer verbundenen Quelle: 'unused' wenn Component sie nicht in props
// erwartet — gilt pro Source-Block in der "consumes"-Sektion.
function statusesForSource(sourceFields: { name: string }[]): FieldStatus[] {
  const propNames = new Set(asTypedFields(props.data.props).map((f) => f.name));
  return sourceFields.map((f) =>
    propNames.has(f.name)
      ? { mode: 'match' as const }
      : { mode: 'unused' as const },
  );
}
</script>

<template>
  <Card class="w-72 border-emerald-500/40">
    <Handle type="target" :position="Position.Left" />
    <CardHeader class="p-4 pb-2">
      <CardTitle class="text-sm flex items-center gap-2">
        <span
          class="inline-block h-2 w-2 rounded-full bg-emerald-500"
          aria-hidden="true"
        />
        {{ data.label }}
      </CardTitle>
      <CardDescription class="text-xs font-mono">
        &lt;{{ data.componentName }} /&gt;
      </CardDescription>
    </CardHeader>
    <CardContent class="p-4 pt-2 text-xs space-y-2">
      <div v-if="data.props?.length">
        <div class="text-muted-foreground mb-0.5">props</div>
        <FieldList :fields="data.props" :statuses="propStatuses" />
      </div>
      <div v-if="data.emits?.length">
        <div class="text-muted-foreground mb-0.5">emits</div>
        <FieldList :fields="data.emits" :statuses="emitStatuses" />
      </div>
      <div v-if="data.mockItems > 0" class="text-muted-foreground">
        {{ data.mockItems }} Mock-Items
      </div>

      <div
        v-if="connected.length"
        class="pt-2 mt-1 border-t border-dashed border-muted-foreground/30 space-y-1"
      >
        <div class="text-muted-foreground">consumes</div>
        <div
          v-for="src in connected"
          :key="src.sourceId"
          class="space-y-0.5"
        >
          <div class="text-muted-foreground/80">
            ← {{ src.sourceLabel }}
            <span class="text-muted-foreground/60">
              ({{ src.sourceType }})
            </span>
          </div>
          <FieldList
            :fields="src.fields"
            :statuses="statusesForSource(src.fields)"
          />
        </div>
      </div>
    </CardContent>
    <Handle type="source" :position="Position.Right" />
  </Card>
</template>
