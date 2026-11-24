-- ─────────────────────────────────────────────────────────
-- Reminder timing (decided 2026-11-24):
--   • each adult's morning push with the day's tasks at 07:30
--   • every timed reminder arrives 30 minutes before its time
-- New adults get the same defaults.
-- ─────────────────────────────────────────────────────────

alter table public.family_members alter column digest_time set default '07:30';
alter table public.family_members alter column reminder_lead_minutes set default 30;

update public.family_members
set digest_time = '07:30', reminder_lead_minutes = 30
where type = 'adult';
