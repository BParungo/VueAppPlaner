<script setup lang="ts">
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { NODE_LABELS, type NodeKind } from '@/schemas/nodes';

const items: {
  kind: NodeKind;
  description: string;
  dot: string;
}[] = [
  {
    kind: 'dataSource',
    description: 'REST · GraphQL · static JSON',
    dot: 'bg-blue-500',
  },
  {
    kind: 'component',
    description: 'Vue-Komponente mit Props',
    dot: 'bg-emerald-500',
  },
  {
    kind: 'route',
    description: 'Vue-Router Pfad',
    dot: 'bg-amber-500',
  },
  {
    kind: 'store',
    description: 'Pinia-Store',
    dot: 'bg-violet-500',
  },
  {
    kind: 'composable',
    description: 'useThing() — params & returns',
    dot: 'bg-teal-500',
  },
  {
    kind: 'note',
    description: 'Notiz / Platzhalter',
    dot: 'bg-yellow-500',
  },
];

function onDragStart(event: DragEvent, kind: NodeKind) {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData('application/vap-node-kind', kind);
  event.dataTransfer.effectAllowed = 'move';
}
</script>

<template>
  <aside
    class="w-64 shrink-0 border-r bg-muted/30 p-4 overflow-y-auto"
    aria-label="Node Palette"
  >
    <h2 class="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
      Palette
    </h2>
    <p class="text-xs text-muted-foreground mb-4">
      Per Drag &amp; Drop auf das Canvas ziehen.
    </p>
    <div class="space-y-2">
      <Card
        v-for="item in items"
        :key="item.kind"
        :draggable="true"
        class="cursor-grab active:cursor-grabbing select-none hover:border-foreground/30 transition-colors"
        @dragstart="(e: DragEvent) => onDragStart(e, item.kind)"
      >
        <CardHeader class="p-3">
          <CardTitle class="text-sm flex items-center gap-2">
            <span
              class="inline-block h-2 w-2 rounded-full"
              :class="item.dot"
              aria-hidden="true"
            />
            {{ NODE_LABELS[item.kind] }}
          </CardTitle>
          <CardDescription class="text-xs">
            {{ item.description }}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  </aside>
</template>
