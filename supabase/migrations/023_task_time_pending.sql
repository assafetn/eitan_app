-- ─────────────────────────────────────────────────────────
-- Eitan never invents a reminder time (decided 2026-11-26).
--
-- A task Eitan saves without a time gets time_pending = true, and the chat
-- asks "מתי להזכיר?" once, with reminder options. Answering (a time, or
-- "בלי תזכורת") clears the flag and the buttons disappear. Older untimed
-- tasks stay false, so they are never asked about.
--
-- Additive, idempotent.
-- ─────────────────────────────────────────────────────────

alter table public.tasks
  add column if not exists time_pending boolean not null default false;
