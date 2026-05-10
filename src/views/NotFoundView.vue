<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div
    class="min-h-full flex flex-col items-center justify-center gap-4 text-center p-8"
  >
    <h1 class="text-3xl font-bold">404 — Nicht gefunden</h1>
    <p class="text-muted-foreground">
      Diese Seite existiert nicht.
    </p>
    <Button @click="router.push('/')">Zurück zur Startseite</Button>
  </div>
</template>
