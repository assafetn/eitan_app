-- ─────────────────────────────────────────────────────────
-- Slice 7.1 — labels
--
-- Flexible, user-addable tags that REPLACE the old rigid
-- tasks.category enum. Both adults can create and manage labels.
-- A task can carry many labels via the task_labels join (migration 010).
--
-- RLS reuses is_adult() (migration 003). Family-scoped: both adults
-- read+write. No new auth logic.
-- ─────────────────────────────────────────────────────────

create table if not exists public.labels (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  color       text,            -- design-token reference (e.g. 'jmh-sage'), nullable
  created_at  timestamptz not null default now()
);

alter table public.labels enable row level security;

drop policy if exists "adults_all_labels" on public.labels;

create policy "adults_all_labels"
  on public.labels
  for all
  using (public.is_adult())
  with check (public.is_adult());
