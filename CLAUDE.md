# Vue App Planner — Claude Guide

Visuelles Planungs-Tool für Vue-Apps. Multi-User, kein Login in V1. Volle Spec: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Aktueller Stand (2026-05-10)

**Phase 0 + Phase 1 abgeschlossen.** Build sauber, Dev-Server läuft, Supabase Cloud verbunden, Migrations gelaufen. Im Browser getestet: Board-Erstellung, Drag&Drop von Nodes, Edge-Verbindungen, Recent-Boards-Liste funktionieren. Nodes/Edges sind aktuell nur in `shallowRef` — Reload löscht den Canvas (erwartbar, Persistenz kommt in Phase 2).

**Nächster Schritt:** Phase 2 — Y.js + IndexedDB + Storage-Snapshots.

## Stack

- **Frontend:** Vue 3 SPA + Vite + TypeScript, `<script setup>` + Composition API
- **Routing:** Vue Router 4 (History-Mode — `vercel.json` Rewrites Pflicht)
- **State:** Pinia (nur UI-State, NICHT für Canvas-Daten)
- **Canvas:** Vue Flow (`@vue-flow/core`) + Background, Minimap, Controls
- **UI:** shadcn-vue (per CLI, nicht als Dep) + Tailwind + Reka UI
- **Backend:** Supabase (Postgres + Realtime + Storage)
- **Sync:** Y.js (CRDT) über Supabase Realtime Broadcast
- **Lokal-Cache:** y-indexeddb
- **Validierung:** zod
- **Tooling:** Bun (install/scripts/build), Vercel (Deploy)

## Kern-Architektur — Drei Schichten

**Sync ≠ Persistenz.** Verstehen, sonst sprengt jede Änderung das Free Tier.

1. **Persistenz** — Postgres (Metadaten in `boards`) + Storage (`boards`-Bucket, Y.Doc als Binary). Wahrheit über Boards.
2. **Sync** — Y.Doc pro Board, gespiegelt via Supabase Realtime Broadcast Channels (`board:{board_id}`). **Berührt die DB nicht.**
3. **UI** — Vue Flow rendert aus Y.Doc. Mutationen schreiben in Y.js, NICHT direkt in Pinia.

**Datenfluss:**
```
User-Edit → Y.js Update → Broadcast (50–200ms zu allen Clients)
                       → IndexedDB (lokal sofort)
                       → Storage Snapshot (debounced 30s, Cap 2min)
```

## Goldene Regeln

- **Vue Flow `applyNodeChanges`/`applyEdgeChanges` schreiben in Y.Map**, nicht in Pinia.
- **Pinia hält nur UI-State** (Sidebar-Zustand, ausgewählte Node, Zoom). Niemals Nodes/Edges.
- **Snapshots inkrementell**: `Y.encodeStateAsUpdate(doc, lastSnapshotState)` statt Voll-State. Voll-Snapshot nur bei Compaction (~1×/h).
- **Snapshot-Debounce 30s**, harter Cap max alle 2min, plus `beforeunload`-Hook.
- **Storage-Pfad-Schema:** `{board_id}/current.ydoc`, optional `{board_id}/snapshots/{timestamp}.ydoc`.
- **Egress-Schoner:** Live-Editing geht NICHT durch Postgres Changes — Realtime Broadcast.

## V1-Konzept (Open Editing)

- Kein Login. Wer den Link hat, editiert.
- Lokale Identität in `localStorage`: `clientId` (UUID), `displayName`, `color`. Composable: `useLocalUser()`.
- Recent Boards: client-seitig in `localStorage`, NICHT serverseitig.
- RLS permissiv: `select`/`insert`/`update` für `anon`. `delete` BEWUSST nicht erlaubt.
- Sicherheitsnetz: Y.js Undo + Snapshots.

## Datenmodell (V1)

Eine Tabelle, ein Bucket. Mehr wird in V2 additiv ergänzt.

```sql
boards (id uuid pk, name text, storage_path text, ydoc_size int, created_at, updated_at)
```

- Y.Doc als Binary in Storage Bucket `boards`, NICHT als `bytea` in Postgres.
- Keine `board_snapshots`-Tabelle. Keine `profiles`/`teams`/`projects` in V1.

## Custom Node Types (Vue Flow)

Alle als shadcn-vue Cards mit konsistentem Look:
- `DataSourceNode` — REST/GraphQL/JSON, Schema-Felder
- `ComponentNode` — Vue-Komponente, Props, Mock-Items
- `RouteNode` — Vue-Router Path + Komponenten-Refs
- `StoreNode` — Pinia-Store, State-Shape, Actions

## Ordnerstruktur (vorgeschlagen)

```
src/
  components/        # shadcn-vue Cards, generische UI
  nodes/             # Vue Flow Custom Node Types
  composables/       # useLocalUser, useYDoc, useAwareness, …
  stores/            # Pinia (nur UI-State)
  lib/
    yjs/             # YDoc-Setup, Provider, Snapshot-Logik
    supabase/        # Client, Storage-Adapter
  views/             # Landing, BoardView
  router/
  schemas/           # zod-Schemas für Node-Properties
supabase/
  migrations/
```

## Kritische Stolperfallen

- **Vue Router History-Mode auf Vercel** → `vercel.json` mit `rewrites` (sonst 404 bei Reload).
- **Vue Flow feuert beim Draggen 30–60 Updates/s** → debounce auf Snapshot-Layer, NICHT auf Y.js-Layer.
- **Last-Write-Wins ist NICHT akzeptabel** → deshalb Y.js, kein direktes Realtime-Patchen.
- **Supabase Free pausiert nach 7d** → Vercel Cron als Anti-Pause-Ping (Phase 5).
- **Phase 3 ist die größte Unbekannte** — Y.js × Supabase Realtime ist nicht out-of-the-box. Plan B: eigener `y-websocket`-Server (Bun.serve, Fly/Railway).

## Erkenntnisse aus dem Setup (Phase 0+1)

- **Supabase-Key-Format hat sich 2025 geändert.** Der neue Publishable Key heißt `sb_publishable_…` (~46 Zeichen, kein JWT) statt des alten `eyJ…`-JWT. Beide funktionieren mit `@supabase/supabase-js` v2 — Frontend-Code muss nichts unterscheiden. Im Dashboard heißt es weiterhin "anon / public", aber neue Projekte zeigen das `sb_…`-Format.
- **Vite-Scaffold-Default war zu bleeding-edge.** `bun create vite` zog TypeScript 6.0-Beta + Vite 8 + `@vue/tsconfig 0.9` mit der `erasableSyntaxOnly`-Option. Das brach `vue-tsc 2.x`. Stabile Kombination: TS 5.6, Vite 5, `@vue/tsconfig 0.5.1`, ohne `erasableSyntaxOnly` in `tsconfig.app.json` und `tsconfig.node.json`.
- **Vue Flow's `Node`-Typ ist zu generisch für Vue-Reactivity-Inferenz** → bei `ref<Node[]>` mit Spread-Operationen kommt `TS2589: Type instantiation is excessively deep`. Workaround in [src/views/BoardView.vue](src/views/BoardView.vue): `shallowRef<any[]>` statt `ref<Node[]>`. Wird in Phase 2 ohnehin durch Y.Map-Backend ersetzt.
- **Vue Flow CSS gehört nicht in `style.css` via `@import`** — PostCSS warnt "@import must precede all other statements", weil `@tailwind base` davor steht. Lösung: Vue-Flow-CSS in [src/main.ts](src/main.ts) importieren, dann `style.css`.
- **Husky `prepare`-Skript schlägt im Non-Git-Repo fehl** (nur Warning, kein Fatal). Husky aktiviert sich automatisch sobald `git init` läuft. Bis dahin sind die `lint-staged`-Configs in [package.json](package.json) inert.
- **Vitest-Config in `vite.config.ts`** braucht `/// <reference types="vitest" />` als ersten Zeile, sonst kennt TS die `test`-Property nicht.
- **Vite-Dev-Port-Konflikte** entstehen, wenn `bun run dev` nicht sauber gestoppt wurde — Vite weicht dann auf 5174 aus. Bei "Permission denied" auf Log-Files: `Get-Process bun, node | Stop-Process -Force`.

## Phasenplan (Kurz)

0. ✅ **Setup** — Vite/Vue/TS, Tailwind, shadcn-vue, Pinia, Router, Supabase-Projekt, Vercel, ESLint/Prettier/Husky, Vitest, GH Actions mit `oven-sh/setup-bun@v2`.
1. ✅ **Boards & Editor-Skeleton** — Migration, Routes `/` und `/board/:id`, Canvas + 4 Node Types, Sidebar-Palette mit Drag & Drop.
2. ⏳ **Y.js Single-User** — Y.Doc + IndexedDB, Snapshots in Storage (30s/2min), Properties-Panel mit zod, Undo/Redo, `beforeunload`.
3. **Realtime-Kollaboration (Kernstück, 3–5d)** — Custom Y.js-Provider auf Supabase Broadcast, Awareness (Cursor/Selektion/User-Liste), Reconnect, Edge Function für Compaction.
4. **Polish** — Settings-Popover, Keyboard Shortcuts, Dark Mode, Export (JSON/PNG/Mermaid), Read-Only via `?readonly=1`.
5. **Deploy & Härtung** — Production-Keys, RLS-Audit, Sentry, Anti-Pause-Cron, Rate-Limits, Quoten-Drosselung bei >80%.

## Befehle

```bash
bun install
bun run dev
bun run build
bun run test          # Vitest
bunx shadcn-vue@latest add <component>
supabase start        # Local Dev
supabase db push      # Migrations
```

## Definition of Done (V1)

Siehe IMPLEMENTATION_PLAN.md §13. Kurz: 4 Node-Types, Multi-User Sync <300ms, Live-Cursor, Undo/Redo, Reload-Persistenz, Offline+Reconnect, Dark Mode, Vercel Production läuft, Free Tier hält.

## Out of Scope (V1)

Auth, Teams, Permissions, private Boards, Versionshistorie, Code-Generation, Templates, Kommentare, Mobile-UI, kollaborative Property-Forms.
