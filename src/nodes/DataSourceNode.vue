<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import type { DataSourceData } from '@/schemas/nodes';

defineProps<NodeProps<DataSourceData>>();
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
    <CardContent class="p-4 pt-2 text-xs">
      <div v-if="data.endpoint" class="font-mono break-all text-muted-foreground">
        {{ data.endpoint }}
      </div>
      <ul v-if="data.fields?.length" class="mt-2 space-y-0.5 font-mono">
        <li v-for="f in data.fields" :key="f">· {{ f }}</li>
      </ul>
    </CardContent>
    <Handle type="source" :position="Position.Right" />
  </Card>
</template>
