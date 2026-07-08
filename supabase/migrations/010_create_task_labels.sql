-- ─────────────────────────────────────────────────────────
-- Slice 7.1 — task_labels (many-to-many join)
--
-- Connects tasks to labels. A task can have multiple labels; a label
-- can be on multiple tasks. The composite (task_id, label_id) primary
-- key prevents duplicate pairs.
--
-- Both FKs cascade on delete: removing a task or a label cleans up its
-- join rows automatically.
--
-- RLS reuses is_adult() (migration 003). Family-scoped: both adults
-- read+write.
-- ─────────────────────────────────────────────────────────

create table if not exists public.task_labels (
  task_id   uuid not null references public.tasks(id)  on delete cascade,
  label_id  uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create index if not exists task_labels_label_id_idx
  on public.task_labels (label_id);

alter table public.task_labels enable row level security;

drop policy if exists "adults_all_task_labels" on public.task_labels;

create policy "adults_all_task_labels"
  on public.task_labels
  for all
  using (public.is_adult())
  with check (public.is_adult());
