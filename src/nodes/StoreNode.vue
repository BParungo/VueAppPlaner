<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import type { StoreData } from '@/schemas/nodes';

defineProps<NodeProps<StoreData>>();
</script>

<template>
  <Card class="w-64 border-violet-500/40">
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
    <CardContent class="p-4 pt-2 text-xs space-y-1">
      <div v-if="data.state?.length">
        <div class="text-muted-foreground mb-0.5">state</div>
        <ul class="font-mono space-y-0.5">
          <li v-for="s in data.state" :key="s">· {{ s }}</li>
        </ul>
      </div>
      <div v-if="data.actions?.length">
        <div class="text-muted-foreground mb-0.5 mt-1">actions</div>
        <ul class="font-mono space-y-0.5">
          <li v-for="a in data.actions" :key="a">· {{ a }}()</li>
        </ul>
      </div>
    </CardContent>
    <Handle type="source" :position="Position.Right" />
  </Card>
</template>
