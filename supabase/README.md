# Supabase Migrations

Diese SQL-Dateien beschreiben das V1-Schema. Anwendung:

## Cloud (existierendes Projekt)

Im Supabase Dashboard → **SQL Editor** → Inhalt der Migrations-Dateien in
chronologischer Reihenfolge ausführen:

1. `20260510000001_init_boards.sql`
2. `20260510000002_storage_bucket.sql`

Alternativ via Supabase CLI:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

## Local Dev (optional, für später)

```bash
supabase init
supabase start
supabase db reset   # spielt alle Migrations ein
```

## Bewusste V1-Tradeoffs

- `delete` für Boards und Storage-Objekte ist **bewusst nicht** zugelassen.
  Y.js Undo + Snapshots sind das einzige Sicherheitsnetz.
- Keine Auth, keine `team_id`. Wer den Link hat, editiert.
