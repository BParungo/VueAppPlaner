# Vue App Planner — Implementation Plan

**Version:** 1.0 (V1, ohne Auth)
**Stack:** Vue 3 SPA · Vue Flow · shadcn-vue · Supabase · Vercel · Bun

---

## Status (2026-05-10)

- ✅ **Phase 0** — Setup (Vite/Vue/TS, Tailwind, shadcn-vue, Pinia, Router, Supabase, ESLint/Prettier, Vitest, GH Actions)
- ✅ **Phase 1** — Boards & Editor-Skeleton (Migrations, Landing, BoardView, 4 Node Types, Sidebar mit Drag&Drop)
- ⏳ **Phase 2** — Y.js Single-User (nächster Schritt)
- ⏸️ Phase 3 — Realtime-Kollaboration
- ⏸️ Phase 4 — Polish
- ⏸️ Phase 5 — Deployment & Härtung

**Live im Browser getestet:** Board-Erstellung, Recent-Boards, Node-Drop, Edge-Verbindungen — alles funktioniert. Persistenz fehlt noch (Reload löscht Canvas — erwartbar, kommt mit Y.js in Phase 2).

Operative Hinweise und Setup-Erkenntnisse: siehe [CLAUDE.md](CLAUDE.md).

---

## 1. Vision

Ein visuelles Planungs-Tool für Vue-Apps. Nutzer skizzieren Komponenten-Architekturen
mit Datenflüssen auf einem Canvas: Datenquellen, Komponenten, Stores und Routes als
Nodes, verbunden durch Edges. Mehrere Personen arbeiten gleichzeitig am selben Board
mit Live-Cursorn und sofort sichtbaren Änderungen. Kein Login in V1 — wer den Board-Link
hat, kann editieren.

---

## 2. Tech Stack

| Bereich | Wahl |
|---|---|
| Frontend | Vue 3 SPA + Vite + TypeScript, `<script setup>`, Composition API |
| Routing | Vue Router 4 (History-Mode) |
| UI-State | Pinia |
| Canvas | Vue Flow (`@vue-flow/core`) + Background, Minimap, Controls |
| UI-Library | shadcn-vue + Tailwind CSS + Reka UI (Primitives) |
| Backend | Supabase (Postgres, Realtime, Storage) |
| Kollaboration | Y.js (CRDT) über Supabase Realtime Broadcast |
| Lokaler Cache | y-indexeddb |
| Deployment | Vercel (statisches SPA-Hosting) |
| Tooling | Bun (Install, Scripts, Build) |
| Validierung | zod |

---

## 3. Architektur-Überblick

Das Kernprinzip: **Sync und Persistenz sind getrennte Schichten.**

```
User A Änderung
    │
    ├──► Y.js Update (paar Bytes)
    │       │
    │       ├──► Realtime Broadcast ──► User B, C, D  (~100ms, kein DB-Touch)
    │       │
    │       └──► IndexedDB (lokal, sofort)
    │
    └──► alle 30s konsolidiert: Snapshot in Supabase Storage
```

**Drei Schichten:**

1. **Persistenz** — Supabase Postgres (Metadaten) + Supabase Storage (Y.Doc-Snapshots als binary). Wahrheit über Boards, Pfade, Timestamps.
2. **Sync** — Y.js-Dokument pro Board, gespiegelt über Supabase Realtime Broadcast Channels. Ephemer, berührt die DB nicht.
3. **UI** — Vue Flow rendert aus dem Y.Doc; alle Mutationen schreiben in Y.js, nicht direkt in Pinia.

**Warum Y.js statt nur Realtime:** Reine Broadcasts führen bei gleichzeitigen Edits an derselben Node zu Last-Write-Wins-Konflikten. Y.js löst das deterministisch via CRDT.

**Warum Snapshots statt jedes Update zu speichern:** Vue Flow feuert beim Draggen 30–60 Updates/Sekunde. Naives „on every change save" sprengt jedes Free Tier. Snapshots sind debounced (30s) und inkrementell (Deltas, nicht Voll-State).

---

## 4. V1-Konzept: Open Editing

- **Kein Login.** Jeder mit Board-URL kann editieren (Konzept wie tldraw, Excalidraw).
- **Lokale User-Identität:** beim ersten Besuch wird in `localStorage` eine `clientId` (UUID), ein zufälliger Anzeigename und eine Farbe generiert. Änderbar im Settings-Popover. Reicht für Awareness/Cursor.
- **Recent Boards:** zuletzt besuchte Boards werden client-seitig in `localStorage` gehalten, nicht serverseitig.
- **RLS bewusst permissiv:** `select`, `insert`, `update` für `anon` erlaubt; `delete` nicht.
- **Bewusste Tradeoffs:** keine Privatsphäre, jeder mit Link kann editieren oder Nodes löschen. Y.js Undo + Snapshots sind die einzige Versicherung. Akzeptabel für Prototyp, klar kommunizieren.

---

## 5. Datenmodell V1

```sql
boards (
  id            uuid primary key default gen_random_uuid(),
  name          text default 'Untitled Board',
  storage_path  text,                           -- Pfad zum aktuellen Snapshot in Supabase Storage
  ydoc_size     int,                            -- für Monitoring
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
)
```

**Bewusste Entscheidungen:**

- Y.Doc liegt **nicht** als `bytea` in Postgres, sondern als binary blob in **Supabase Storage**. Vorteil: separate Egress-Quote, größeres Storage-Limit, schnelleres CDN-Delivery.
- Keine `board_snapshots`-Tabelle in V1. Versionierung kommt später, falls nötig (dann mit File-Naming-Convention im Storage Bucket).
- Kein `profiles`, `teams`, `team_members`, `projects`. Wird in V2 additiv ergänzt.

### Storage Bucket

- Bucket: `boards` (public Read, Write nur via RLS Policy)
- Pfad-Schema: `{board_id}/current.ydoc` für aktuellen Stand, optional `{board_id}/snapshots/{timestamp}.ydoc` für historische Versionen

### RLS-Policies

```sql
-- boards
alter table boards enable row level security;
create policy "anyone can read boards"   on boards for select to anon using (true);
create policy "anyone can create boards" on boards for insert to anon with check (true);
create policy "anyone can update boards" on boards for update to anon using (true);
-- delete bewusst NICHT erlaubt

-- storage bucket "boards"
-- analog: read/insert/update für anon, delete nicht
```

---

## 6. Realtime-Kollaboration im Detail

### Live-Sync (sofort)

- Pro Board ein **Supabase Realtime Channel**: `board:{board_id}`
- Y.js-Updates werden als `broadcast`-Messages durch den Channel geschickt
- Latenz: ~50–200ms zwischen Clients
- **Kein DB-Touch beim Editieren** — entscheidend fürs Free Tier

### Awareness (Cursor, Selektion, User-Liste)

- Y.js Awareness-Protocol über denselben Channel
- Live-Cursor mit Avatar, Name, Farbe
- Optisches Highlight: „User X editiert gerade Node N"
- Aktive Mitglieder oben rechts im Header

### Persistenz (verzögert)

- Y.Doc-Update lokal sofort in IndexedDB (`y-indexeddb`)
- Server-Snapshot **debounced auf 30s** nach letzter Aktivität
- Harter Cap: max alle 2 Minuten ein Snapshot, auch bei Dauer-Aktivität
- Bei `beforeunload` zusätzlich finaler Snapshot
- Inkrementelle Deltas: `Y.encodeStateAsUpdate(doc, lastSnapshotState)` statt Voll-Snapshot
- Periodische Compaction (z. B. 1× pro Stunde): voller Snapshot, alte Deltas löschen

### Initial-Load eines Boards

1. Lade `current.ydoc` aus Supabase Storage (eine HTTP-Request)
2. Wende auf lokales `Y.Doc` an
3. Verbinde mit Realtime Channel
4. Awareness-Protocol synchronisiert fehlende Updates seit Snapshot direkt von anderen Clients
5. Vue Flow rendert aus Y.Doc

### Reconnect

- Bei verlorener Verbindung: Updates landen lokal in IndexedDB
- Bei Reconnect: Y.js synct automatisch alles nach (CRDT-Eigenschaft)
- User merkt es nicht — funktioniert auch bei kurzem WLAN-Aussetzer

---

## 7. Vue Flow Integration

### Custom Node Types

Alle als shadcn-vue Cards mit konsistentem Look:

- **DataSourceNode** — REST-Endpoint, GraphQL-Query, statisches JSON; zeigt Schema-Felder
- **ComponentNode** — Vue-Komponente; zeigt Komponentennamen, Props, gemockte Listen-Items
- **RouteNode** — Vue-Router-Route; zeigt Path und referenzierte Komponenten
- **StoreNode** — Pinia-Store; zeigt State-Shape und Actions

### Datenfluss

- Nodes/Edges werden in `Y.Map` gehalten
- Vue Flows `applyNodeChanges` / `applyEdgeChanges` schreiben in Y.js, nicht in Pinia
- Pinia hält nur UI-State (Sidebar offen, ausgewählte Node, Zoom-Level)

### UI-Komponenten

- **Sidebar links:** Palette mit Drag & Drop neuer Nodes
- **Canvas:** Vue Flow + Background + Minimap + Controls
- **Properties-Panel rechts:** bearbeitet ausgewählte Node (zod-validierte Forms mit Reka UI)
- **Header:** Board-Name, aktive Mitglieder, Settings-Popover (eigener Name/Farbe)

---

## 8. Phasenplan

### Phase 0 — Setup ✅

- ✅ `bun create vite` mit Vue + TypeScript Template
- ✅ Tailwind CSS + shadcn-vue + Reka UI (Komponenten manuell statt CLI — Card und Button reichen für V1-Start)
- ✅ Vue Router 4, History-Mode, `vercel.json` mit Rewrites auf `/index.html`
- ✅ Pinia (UI-Store: Sidebar, Properties-Panel, Selection)
- ✅ Supabase Cloud-Projekt verknüpft (Migrations via SQL-Editor angewendet, Local CLI optional)
- ⏸️ Vercel-Projekt — kommt mit Phase 5
- ✅ ESLint (flat config) + Prettier + Vitest. Husky/lint-staged konfiguriert, aktiv erst nach `git init`.
- ✅ GitHub Actions mit `oven-sh/setup-bun@v2`

**Erkenntnisse**

- TypeScript bewusst auf `~5.6.3` gepinnt (Vite-Scaffold-Default war TS 6.0-Beta + Vite 8 + `erasableSyntaxOnly`, brach `vue-tsc 2.x`).
- Vue-Flow-CSS muss in [src/main.ts](src/main.ts) importiert werden, nicht via `@import` in `style.css` (PostCSS-Reihenfolge mit `@tailwind`).
- Supabase-Key-Format ist seit 2025 `sb_publishable_…` statt `eyJ…`-JWT — beide kompatibel mit `@supabase/supabase-js` v2.

### Phase 1 — Boards & Editor-Skeleton ✅

- ✅ Migrations: `boards`-Tabelle + Storage Bucket + RLS-Policies (`delete` bewusst nicht erlaubt) — siehe [supabase/migrations/](supabase/migrations/)
- ✅ Routes `/` und `/board/:id` mit lazy-loaded Views
- ✅ Landing: „Neues Board erstellen" → POST `boards` → Redirect auf `/board/:id`
- ✅ Recent-Boards-Liste aus `localStorage` ([src/composables/useRecentBoards.ts](src/composables/useRecentBoards.ts))
- ✅ Lokale User-Identität ([src/composables/useLocalUser.ts](src/composables/useLocalUser.ts)) mit zufälligem Namen + Farbe
- ✅ Vue Flow Canvas mit Background, Minimap, Controls
- ✅ 4 Custom Node Types als shadcn-Cards in [src/nodes/](src/nodes/) — DataSource (blau), Component (grün), Route (amber), Store (violett)
- ✅ zod-Schemas für alle Node-Daten ([src/schemas/nodes.ts](src/schemas/nodes.ts))
- ✅ Sidebar-Palette mit Drag & Drop ([src/components/NodePalette.vue](src/components/NodePalette.vue))

**Erkenntnisse**

- Vue Flows `Node`-Typ ist zu generisch für Vues Reactivity-Inferenz → `ref<Node[]>` mit Spread löst `TS2589` aus. Workaround: `shallowRef<any[]>` in [src/views/BoardView.vue](src/views/BoardView.vue). Wird in Phase 2 durch Y.Map-Backend ersetzt.
- Nodes/Edges leben aktuell nur lokal in `shallowRef` — Reload löscht Canvas. Persistenz ist Phase 2.
- Property-Panel (rechts) ist bewusst noch nicht da — kommt mit Phase 2 zusammen mit Y.js, damit Edits direkt persistieren.

### Phase 2 — Y.js Persistenz Single-User (2 Tage)

- Y.Doc pro Board, gecached in IndexedDB
- `useLocalUser()` Composable (clientId, displayName, color)
- Inkrementelle Snapshots in Supabase Storage, debounced 30s + max 2min Cap
- Properties-Panel mit zod-Validierung
- Undo/Redo via Y.js UndoManager
- `beforeunload`-Hook für finalen Snapshot

### Phase 3 — Realtime-Kollaboration (3–5 Tage, Kernstück)

- Custom Y.js-Provider auf Basis von Supabase Realtime Broadcast Channels
- Awareness: Cursor, Selektion, Userliste mit lokaler Identität
- Konfliktszenarien manuell testen (zwei Browser, parallel editieren)
- Reconnect-Logik, Offline-Buffer
- Edge Function (Deno) für periodische Compaction (Cron, nicht Request)
- **Plan B falls Performance nicht reicht:** eigener `y-websocket`-Server mit `Bun.serve()`, deployed auf Fly.io oder Railway

### Phase 4 — Polish (2 Tage)

- Settings-Popover: Display-Name + Farbe editieren
- Keyboard Shortcuts (Delete, Copy/Paste, Multi-Select, Undo/Redo)
- Dark Mode (shadcn-vue native)
- Export: JSON, PNG (Canvas-Snapshot), Mermaid-Code
- Read-Only-View per Query-Param `?readonly=1`

### Phase 5 — Deployment & Härtung (1–2 Tage)

- Vercel Production + Preview-Deployments für PRs
- Supabase Production-Keys, RLS-Audit
- Sentry für Error Reporting
- Vercel Cron als Anti-Pause-Ping (Supabase Free pausiert nach 7d Inaktivität)
- Rate-Limiting auf Edge Functions (gegen Snapshot-Spam)
- Monitoring: Supabase-Dashboard regelmäßig checken
- Hard-Limit-Logik: bei >80% Quote Snapshot-Frequenz drosseln

---

## 9. Free-Tier-Strategie

### Supabase Free Tier 2026

- 500 MB Datenbank · 1 GB File Storage · 5 GB DB-Egress · 5 GB Storage-Egress
- 500.000 Edge Function Invocations / Monat
- API-Requests und Realtime-Verbindungen unlimitiert
- Projekt pausiert nach 7d Inaktivität → Anti-Pause-Ping nötig

### Warum das reicht

- **Live-Editing kostet keinen DB-Egress** (Realtime Broadcast statt Postgres Changes)
- **Snapshots sind klein** dank inkrementeller Deltas (1–5 KB statt 200 KB)
- **30s-Debounce** begrenzt Schreibrate massiv
- **Storage statt bytea** entlastet Postgres und nutzt zweite Egress-Quote

### Realistische Größenrechnung

| Szenario | Egress/Monat |
|---|---|
| 50 Boards, 5 aktive Editoren, 2h/Tag pro Board | ~1–2 GB |
| 200 Boards, gemischte Aktivität | ~3–4 GB |
| 500+ Boards, viele parallele Sessions | sprengt 5 GB |

V1 läuft komfortabel im Free Tier. Erst bei breiter Nutzung wird Pro ($25/Monat) nötig.

### Migration-Pfad zu Cloudflare R2

Falls Egress später eng wird: R2 hat 10 GB Storage und **0 € Egress** im Free Tier. Datenmodell ist so gebaut (`storage_path` als String), dass nur die Upload-Funktion ausgetauscht werden muss. Kein Datenmodell-Refactor nötig.

---

## 10. Migrationspfad zu V2 (Auth)

V1 ist bewusst keine Sackgasse:

- `boards` bekommt optionale `team_id` (nullable). Boards ohne `team_id` bleiben „Open Boards"
- Neue Tabellen `profiles`, `teams`, `team_members`, `projects`, `invitations` werden additiv ergänzt
- RLS-Policies werden umgeschrieben: „erlaubt wenn `team_id IS NULL` ODER `is_team_member(team_id)`"
- Lokale `clientId` aus V1 kann als `guest_id` auf einem Profil weiterleben, falls jemand sich später registriert
- Bestehende Boards bleiben offen oder können einem Team „adopted" werden

---

## 11. Kritische Risiken

| Risiko | Mitigation |
|---|---|
| Y.js + Supabase Realtime ist nicht „out of the box" | Phase 3 als größte Unbekannte einplanen; Plan B: eigener `y-websocket`-Server mit Bun |
| Bundle-Size (Vue Flow + Y.js + shadcn) | Code-Splitting per Route, Editor-Bundle lazy-loaded |
| RLS-Fallstricke | Früh und automatisiert testen gegen Supabase Local |
| Vue Router History-Mode auf Vercel | `vercel.json` mit `rewrites` ist Pflicht (sonst 404 bei Reload) |
| Y.Doc wächst mit jedem Edit | Snapshots + GC + periodische Compaction |
| Free Tier Egress-Cap | Inkrementelle Deltas + Storage statt bytea + 30s Debounce |
| Supabase pausiert nach 7d | Vercel Cron Anti-Pause-Ping |
| „Jeder kann alles löschen" in V1 | Y.js Undo + Snapshots + delete-Policy ausgeschaltet |

---

## 12. Bibliotheken

```json
{
  "dependencies": {
    "vue": "^3",
    "vue-router": "^4",
    "pinia": "^2",
    "@vue-flow/core": "latest",
    "@vue-flow/background": "latest",
    "@vue-flow/minimap": "latest",
    "@vue-flow/controls": "latest",
    "@supabase/supabase-js": "^2",
    "yjs": "^13",
    "y-indexeddb": "^9",
    "y-protocols": "^1",
    "@vueuse/core": "^11",
    "zod": "^3"
  },
  "devDependencies": {
    "vite": "^5",
    "typescript": "^5",
    "tailwindcss": "^3",
    "vitest": "^2",
    "eslint": "^9",
    "prettier": "^3",
    "husky": "^9",
    "lint-staged": "^15"
  }
}
```

shadcn-vue wird per CLI installiert (`bunx shadcn-vue@latest add ...`), nicht als Dependency.

---

## 13. Definition of Done für V1

- [ ] User kann ohne Login ein Board erstellen
- [ ] Board ist über `/board/:id` erreichbar und shareable
- [ ] Vue Flow Canvas mit 4 Custom Node Types
- [ ] Drag & Drop neuer Nodes aus Sidebar
- [ ] Properties-Panel zur Node-Bearbeitung
- [ ] Mehrere User sehen Änderungen in <300ms
- [ ] Live-Cursor mit Name + Farbe
- [ ] Undo/Redo funktioniert
- [ ] Stand bleibt nach Reload erhalten
- [ ] Funktioniert offline (Reconnect synct nach)
- [ ] Dark Mode
- [ ] Production-Deployment auf Vercel läuft
- [ ] Free Tier Quoten bei moderater Nutzung nicht überschritten

---

## 14. Out of Scope für V1

- Auth, Teams, Projekte, Permissions
- Private Boards
- Versionshistorie / Time-Travel
- Code-Generation aus Boards (Vue-Komponenten-Skeletons)
- Templates / Vorlagen-Boards
- Kommentare auf Nodes
- Mobile-optimiertes UI
- Collaborative Editing in Property-Forms (nur Canvas-Sync)

---

**Nächster Schritt:** Phase 0 starten — Repo-Skeleton anlegen.
