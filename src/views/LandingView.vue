<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createBoard } from '@/lib/supabase/boards';
import { useRecentBoards } from '@/composables/useRecentBoards';
import { useLocalUser } from '@/composables/useLocalUser';

const router = useRouter();
const { boards, remove } = useRecentBoards();
const { user } = useLocalUser();

const creating = ref(false);
const error = ref<string | null>(null);

async function onCreate() {
  creating.value = true;
  error.value = null;
  try {
    const board = await createBoard();
    await router.push({ name: 'board', params: { id: board.id } });
  } catch (e) {
    error.value = (e as Error).message;
    creating.value = false;
  }
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString();
}
</script>

<template>
  <div class="min-h-full bg-background">
    <header class="border-b">
      <div class="container flex h-16 items-center justify-between">
        <h1 class="text-xl font-semibold">Vue App Planner</h1>
        <span class="text-sm text-muted-foreground">
          {{ user.displayName }}
        </span>
      </div>
    </header>

    <main class="container py-12">
      <section class="mb-12">
        <h2 class="text-3xl font-bold tracking-tight mb-2">
          Plane visuell deine Vue-App.
        </h2>
        <p class="text-muted-foreground mb-6 max-w-2xl">
          Skizziere Komponenten-Architektur und Datenflüsse auf einem Canvas.
          Datenquellen, Komponenten, Stores und Routes als Nodes — verbunden
          durch Edges. Mehrere Personen arbeiten live zusammen, ohne Login.
        </p>
        <Button :disabled="creating" size="lg" @click="onCreate">
          {{ creating ? 'Wird erstellt …' : 'Neues Board erstellen' }}
        </Button>
        <p v-if="error" class="text-sm text-destructive mt-3">
          {{ error }}
        </p>
      </section>

      <section v-if="boards.length">
        <h3 class="text-lg font-semibold mb-4">Zuletzt besucht</h3>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="b in boards"
            :key="b.id"
            class="cursor-pointer hover:border-foreground/30 transition-colors"
            @click="router.push({ name: 'board', params: { id: b.id } })"
          >
            <CardHeader>
              <CardTitle>{{ b.name }}</CardTitle>
              <CardDescription>
                Besucht: {{ formatDate(b.visitedAt) }}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <code class="text-xs text-muted-foreground">{{ b.id }}</code>
              <Button
                variant="ghost"
                size="sm"
                class="mt-2 ml-auto block"
                @click.stop="remove(b.id)"
              >
                Aus Liste entfernen
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
      <section v-else>
        <p class="text-sm text-muted-foreground">
          Noch keine Boards besucht. Erstelle eines, um anzufangen.
        </p>
      </section>
    </main>
  </div>
</template>
