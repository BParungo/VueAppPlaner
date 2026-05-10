-- Vue App Planner — V1 Schema
-- Open Editing: anon kann lesen / erstellen / aktualisieren. Delete bewusst NICHT.

create table if not exists public.boards (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default 'Untitled Board',
  storage_path  text,
  ydoc_size     int default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists boards_updated_at_idx on public.boards (updated_at desc);

-- updated_at automatisch pflegen
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();

-- RLS
alter table public.boards enable row level security;

drop policy if exists "anyone can read boards" on public.boards;
create policy "anyone can read boards"
  on public.boards for select
  to anon, authenticated
  using (true);

drop policy if exists "anyone can create boards" on public.boards;
create policy "anyone can create boards"
  on public.boards for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anyone can update boards" on public.boards;
create policy "anyone can update boards"
  on public.boards for update
  to anon, authenticated
  using (true)
  with check (true);

-- delete: bewusst KEINE policy.
