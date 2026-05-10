<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import type { ComponentData } from '@/schemas/nodes';

defineProps<NodeProps<ComponentData>>();
</script>

<template>
  <Card class="w-64 border-emerald-500/40">
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
    <CardContent class="p-4 pt-2 text-xs space-y-1">
      <div v-if="data.props?.length">
        <div class="text-muted-foreground mb-0.5">props</div>
        <ul class="font-mono space-y-0.5">
          <li v-for="p in data.props" :key="p">· {{ p }}</li>
        </ul>
      </div>
      <div v-if="data.mockItems > 0" class="text-muted-foreground">
        {{ data.mockItems }} Mock-Items
      </div>
    </CardContent>
    <Handle type="source" :position="Position.Right" />
  </Card>
</template>
