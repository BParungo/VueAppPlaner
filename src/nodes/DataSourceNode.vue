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
import { buildUnusedFromNode } from '@/lib/types/match';
import { asTypedFields, type DataSourceData } from '@/schemas/nodes';

const props = defineProps<NodeProps<DataSourceData>>();

const ctx = useBoardContext();
const idRef = toRef(props, 'id');

const fieldStatuses = computed<(FieldStatus | undefined)[]>(() => {
  if (!ctx) return [];
  const unused = buildUnusedFromNode(
    idRef.value,
    ctx.nodes.value,
    ctx.edges.value,
  );
  return asTypedFields(props.data.fields).map((f) =>
    unused.has(f.name) ? { mode: 'unused' as const } : undefined,
  );
});
</script>

<template>
  <Card class="w-64 border-blue-500/40">
    <CardHeader class="p-4 pb-2">
      <CardTitle class="text-sm flex items-center gap-2">
        <span
          class="inline-block h-2 w-2 rounded-full bg-blue-500"
          aria-hidden="true"
        />
        {{ data.label }}
      </CardTitle>
      <CardDescription class="text-xs uppercase tracking-wide">
        {{ data.kind }}
      </CardDescription>
    </CardHeader>
    <CardContent class="p-4 pt-2 text-xs space-y-2">
      <div
        v-if="data.endpoint"
        class="font-mono break-all text-muted-foreground"
      >
        {{ data.endpoint }}
      </div>
      <FieldList
        :fields="data.fields"
        :statuses="fieldStatuses"
        empty-hint="keine Felder definiert"
      />
    </CardContent>
    <Handle type="source" :position="Position.Right" />
  </Card>
</template>
