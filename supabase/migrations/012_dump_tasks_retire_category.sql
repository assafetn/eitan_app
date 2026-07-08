-- ─────────────────────────────────────────────────────────
-- Slice 7.1 — DUMP existing tasks + RETIRE category
--
-- DESTRUCTIVE BY DESIGN. The existing tasks are throwaway test data;
-- a clean slate is intended before the אחריות/label model goes live.
--
-- Scope of destruction (confirm before running):
--   • ALL rows in public.tasks are deleted — recurring parents,
--     non-recurring singles, AND recurrence override rows
--     (recurrence_parent_id not null).
--   • The category column is dropped from public.tasks. This also drops
--     its CHECK constraint (general/chore/kid/errand). There is NO
--     separate enum TYPE to drop — category was a `text` column with a
--     CHECK, never a Postgres enum — so no DROP TYPE is needed.
--
-- Explicitly NOT touched: family_members, shopping_items,
-- responsibilities, labels, task_labels.
--
-- task_labels rows would cascade-delete with their tasks, but the table
-- is brand-new and empty at this point, so nothing is there to remove.
-- ─────────────────────────────────────────────────────────

-- 1. Remove recurrence override rows first (explicit, though deleting all
--    tasks below would also remove them). These are the per-occurrence
--    "done" markers that carry a recurrence_parent_id.
delete from public.tasks
  where recurrence_parent_id is not null;

-- 2. Remove every remaining task (recurring parents + non-recurring singles).
delete from public.tasks;

-- 3. Retire category. Dropping the column also drops its inline CHECK
--    constraint. IF EXISTS keeps this idempotent / re-runnable.
alter table public.tasks
  drop column if exists category;
