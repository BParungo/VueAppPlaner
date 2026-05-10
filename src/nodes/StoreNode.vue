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
import { buildNodeReport, buildUnusedFromNode } from '@/lib/types/match';
import { asTypedFields, type StoreData } from '@/schemas/nodes';

const props = defineProps<NodeProps<StoreData>>();

const ctx = useBoardContext();
const idRef = toRef(props, 'id');
const connected = ctx
  ? useConnectedTypes(idRef, ctx.nodes, ctx.edges)
  : computed(() => []);

const report = computed(() => {
  if (!ctx) return null;
  return buildNodeReport(props.id, ctx.nodes.value, ctx.edges.value);
});

// state ist 'input' Vertrag des Stores — Match gegen verbundene Quellen
const stateStatuses = computed<(FieldStatus | undefined)[]>(() =>
  (report.value?.propStatuses ?? []).map((s) => ({
    mode: s.status,
    expectedType: s.expectedType,
    actualType: s.actualType,
  })),
);

// state ist auch 'output' fuer downstream Components -> 'unused' wenn niemand erwartet
const stateUnused = computed(() => {
  if (!ctx) return new Set<string>();
  return buildUnusedFromNode(idRef.value, ctx.nodes.value, ctx.edges.value);
});

// Wenn ein state-Feld einen Match-Status hat, gewinnt der; sonst pruefen wir 'unused'
const stateCombined = computed<(FieldStatus | undefined)[]>(() => {
  const fields = asTypedFields(props.data.state);
  return fields.map((f, i) => {
    const matchStatus = stateStatuses.value[i];
    if (matchStatus && matchStatus.mode !== 'missing') return matchStatus;
    if (stateUnused.value.has(f.name)) return { mode: 'unused' };
    return matchStatus;
  });
});

function statusesForSource(sourceFields: { name: string }[]): FieldStatus[] {
  const stateNames = new Set(asTypedFields(props.data.state).map((f) => f.name));
  return sourceFields.map((f) =>
    stateNames.has(f.name)
      ? { mode: 'match' as const }
      : { mode: 'unused' as const },
  );
}
</script>

<template>
  <Card class="w-72 border-violet-500/40">
    <Handle type="target" :position="Position.Left" />
    <CardHeader class="p-4 pb-2">
      <CardTitle class="text-sm flex items-center gap-2">
        <span
          class="inline-block h-2 w-2 rounded-full bg-violet-500"
          aria-hidden="true"
        />
        {{ data.label }}
      </CardTitle>
      <CardDescription class="text-xs font-mono">
        {{ data.storeName }}
      </CardDescription>
    </CardHeader>
    <CardContent class="p-4 pt-2 text-xs space-y-2">
      <div v-if="data.state?.length">
        <div class="text-muted-foreground mb-0.5">state</div>
        <FieldList :fields="data.state" :statuses="stateCombined" />
      </div>
      <div v-if="data.actions?.length">
        <div class="text-muted-foreground mb-0.5">actions</div>
        <FieldList :fields="data.actions" />
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
