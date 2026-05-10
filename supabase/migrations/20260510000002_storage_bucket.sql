-- Storage Bucket "boards" für Y.Doc-Snapshots.
-- Public read; insert/update für anon erlaubt; delete NICHT.

insert into storage.buckets (id, name, public)
values ('boards', 'boards', true)
on conflict (id) do nothing;

drop policy if exists "boards bucket: anyone can read" on storage.objects;
create policy "boards bucket: anyone can read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'boards');

drop policy if exists "boards bucket: anyone can insert" on storage.objects;
create policy "boards bucket: anyone can insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'boards');

drop policy if exists "boards bucket: anyone can update" on storage.objects;
create policy "boards bucket: anyone can update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'boards')
  with check (bucket_id = 'boards');

-- delete: bewusst KEINE policy.
