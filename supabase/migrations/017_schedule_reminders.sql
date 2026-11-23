-- ─────────────────────────────────────────────────────────
-- Redesign step 3: actually run the reminder job.
--
-- Supabase calls https://eitan-app-xi.vercel.app/api/cron/reminders every
-- 5 minutes using pg_cron and pg_net. The route's window is also 5 minutes
-- (WINDOW_MINUTES), so a reminder fires at most 5 minutes early.
--
-- The bearer token is generated INSIDE the database and kept in Supabase
-- Vault. It is never written to this repo, to Vercel, or anywhere else.
-- The route checks an incoming token with verify_cron_secret(), which
-- only the service role may call.
--
-- Idempotent: the secret is created only if missing, and cron.schedule
-- replaces the job of the same name.
-- ─────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. The secret (generated here, only if it doesn't exist yet).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'eitan_cron_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'eitan_cron_secret',
      'Bearer token pg_cron sends to /api/cron/reminders'
    );
  end if;
end
$$;

-- 2. Server-side check, so the app never needs a copy of the secret.
create or replace function public.verify_cron_secret(token text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'eitan_cron_secret'
      and decrypted_secret = token
  );
$$;

revoke all on function public.verify_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_cron_secret(text) to service_role;

-- 3. The schedule.
select cron.schedule(
  'eitan-reminders',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := 'https://eitan-app-xi.vercel.app/api/cron/reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'eitan_cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);
