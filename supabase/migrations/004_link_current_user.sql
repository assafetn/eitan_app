-- ─────────────────────────────────────────────────────────
-- Automatic first-login account linking.
--
-- Problem: the auth callback links a logged-in user to their
-- family_members row by setting auth_user_id. Doing that as the user,
-- through RLS, is blocked on first login because is_adult() is still
-- false (no row links to their uid yet) — a chicken-and-egg deadlock.
--
-- Fix: a SECURITY DEFINER RPC that performs the link with the function
-- owner's rights (bypassing RLS), but only for the two allowlisted adult
-- emails, and only when the caller-supplied email matches the verified
-- email on their own auth.users record (so no one can link to another
-- person's row).
--
-- Idempotent: re-linking the same uid is a no-op; an already-linked row
-- owned by a different uid is never stolen. Safe to call on every login.
-- ─────────────────────────────────────────────────────────

create or replace function public.link_current_user(email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_real_email text;
  v_name       text;
begin
  -- Must be authenticated.
  if v_uid is null then
    return false;
  end if;

  -- Source of truth is the verified email on the auth user, NOT the
  -- parameter. We then require the supplied email to match it, so a
  -- caller cannot pass someone else's address to hijack their row.
  select u.email into v_real_email
  from auth.users u
  where u.id = v_uid;

  if v_real_email is null or lower(v_real_email) <> lower(email) then
    return false;
  end if;

  -- Explicit email -> member mapping (position-independent).
  v_name := case lower(v_real_email)
    when 'first.adult@example.com'  then 'Assaf'
    when 'second.adult@example.com' then 'Nathalie'
    else null
  end;

  -- Not an allowlisted adult: link nothing.
  if v_name is null then
    return false;
  end if;

  -- Link the correct adult row. Idempotent and non-stealing:
  --   * unlinked row (auth_user_id is null) -> claim it
  --   * already linked to this same uid       -> no-op
  --   * linked to a different uid             -> left untouched
  update public.family_members
  set auth_user_id = v_uid
  where name = v_name
    and type = 'adult'
    and (auth_user_id is null or auth_user_id = v_uid);

  return true;
end;
$$;

-- Only authenticated users may call it; never anon/public.
revoke all on function public.link_current_user(text) from public;
grant execute on function public.link_current_user(text) to authenticated;
