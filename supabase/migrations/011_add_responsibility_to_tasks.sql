-- ─────────────────────────────────────────────────────────
-- Slice 7.1 — tasks.responsibility_id
--
-- Links a task to an optional responsibility (אחריות). Nullable, so a
-- task can stand alone with no responsibility. On delete of the parent
-- responsibility the link is cleared (set null) — the task survives.
--
-- No RLS change: tasks already has the adults_all_tasks policy.
-- ─────────────────────────────────────────────────────────

alter table public.tasks
  add column if not exists responsibility_id uuid
    references public.responsibilities(id) on delete set null;

create index if not exists tasks_responsibility_id_idx
  on public.tasks (responsibility_id);
