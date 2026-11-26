-- ─────────────────────────────────────────────────────────
-- Eitan never guesses who a task is for (decided 2026-11-26).
--
-- When a chat message doesn't say whose it is, Eitan saves the task with
-- owner_pending = true and asks "למי התזכורת?" with three buttons
-- (אסף / נטלי / שניכם). Tapping one sets the owner and clears the flag.
-- Until then the task has no owner; the reminder cron treats an
-- owner-less task as both adults' so nothing goes silent.
--
-- The owner rule from migration 019 still holds for every other task.
-- Additive, idempotent.
-- ─────────────────────────────────────────────────────────

alter table public.tasks
  add column if not exists owner_pending boolean not null default false;

alter table public.tasks drop constraint if exists tasks_owner_required;
alter table public.tasks
  add constraint tasks_owner_required
  check (recurrence_parent_id is not null or is_shared or assignee_id is not null or owner_pending);
