-- ─────────────────────────────────────────────────────────
-- Capture schema that exists in the live DB but was never committed.
--
-- The Web Push / reminder-cron work added these objects directly in the
-- live project:
--   • family_members reminder settings columns
--   • public.push_subscriptions
--   • public.notification_log
-- This file records them so a fresh project can be rebuilt from the repo.
--
-- Against the LIVE project this is a no-op: every statement is
-- idempotent (if not exists / drop-if-exists + recreate an identical
-- policy). Mirrors the live definitions as of 2026-11-23.
--
-- NOT captured here: whatever schedules the reminder cron, because it
-- carries CRON_SECRET and this repo is public.
-- ─────────────────────────────────────────────────────────

-- family_members: per-adult reminder settings
alter table public.family_members
  add column if not exists reminders_enabled     boolean not null default false,
  add column if not exists digest_time           time    not null default '07:00',
  add column if not exists reminder_lead_minutes integer not null default 0,
  add column if not exists quiet_from            time,
  add column if not exists quiet_to              time;

-- push_subscriptions: one row per device/browser
create table if not exists public.push_subscriptions (
  id              uuid primary key default uuid_generate_v4(),
  member_id       uuid not null references public.family_members(id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);

create index if not exists push_subscriptions_member_idx
  on public.push_subscriptions (member_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "adults_all_push_subscriptions" on public.push_subscriptions;
create policy "adults_all_push_subscriptions"
  on public.push_subscriptions
  for all
  using (public.is_adult())
  with check (public.is_adult());

-- notification_log: dedupe ledger for the reminder cron (service role writes)
create table if not exists public.notification_log (
  dedupe_key text primary key,
  member_id  uuid not null references public.family_members(id) on delete cascade,
  kind       text not null check (kind in ('digest', 'task')),
  sent_at    timestamptz not null default now()
);

create index if not exists notification_log_sent_at_idx
  on public.notification_log (sent_at);

alter table public.notification_log enable row level security;

drop policy if exists "adults_read_notification_log" on public.notification_log;
create policy "adults_read_notification_log"
  on public.notification_log
  for select
  using (public.is_adult());
