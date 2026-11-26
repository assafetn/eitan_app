-- ─────────────────────────────────────────────────────────
-- Per-task push choice (decided 2026-11-26).
--
-- Under each of Eitan's confirmations the chat shows buttons: who the
-- task is for, and whether / when its push goes out. Defaults keep the
-- existing behaviour: push on, the owner's reminder_lead_minutes (30).
--
--   push_enabled       false = no push for this task (it is still posted
--                      in the chat at its time)
--   push_lead_minutes  minutes before due_time; null = the owner's
--                      family_members.reminder_lead_minutes
--
-- Additive, idempotent.
-- ─────────────────────────────────────────────────────────

alter table public.tasks
  add column if not exists push_enabled      boolean  not null default true,
  add column if not exists push_lead_minutes smallint;

alter table public.tasks drop constraint if exists tasks_push_lead_range;
alter table public.tasks
  add constraint tasks_push_lead_range
  check (push_lead_minutes is null or push_lead_minutes between 0 and 1440);
