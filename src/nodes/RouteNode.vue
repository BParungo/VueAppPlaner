<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import type { RouteData } from '@/schemas/nodes';

defineProps<NodeProps<RouteData>>();
</script>

<template>
  <Card class="w-64 border-amber-500/40">
    <CardHeader class="p-4 pb-2">
      <CardTitle class="text-sm flex items-center gap-2">
        <span
          class="inline-block h-2 w-2 rounded-full bg-amber-500"
          aria-hidden="true"
        />
        {{ data.label }}
      </CardTitle>
      <CardDescription class="text-xs font-mono">
        {{ data.path }}
      </CardDescription>
    </CardHeader>
    <CardContent class="p-4 pt-2 text-xs">
      <div v-if="data.componentRef" class="font-mono text-muted-foreground">
        → &lt;{{ data.componentRef }} /&gt;
      </div>
    </CardContent>
    <Handle type="source" :position="Position.Right" />
  </Card>
</template>
