-- ─────────────────────────────────────────────────────────
-- Re-key account linking on EMAIL (stable identity), not display name.
--
-- The previous link_current_user() (migration 004) matched the target
-- family_members row by `name = 'Assaf' / 'Nathalie'`. That made display
-- names a join key, so renaming a member (migration 006) would silently
-- break first-login linking.
--
-- This version maps the authenticated user's verified email to the
-- member's STABLE seeded UUID (from migration 002) and links by id.
-- Renaming the row afterwards has no effect on linking.
--
-- APPLY THIS BEFORE the rename migration (006). See order note below.
--
-- Unchanged from 004: SECURITY DEFINER, pinned search_path, idempotent,
-- non-clobbering. is_adult() and all RLS policies are left untouched.
-- ─────────────────────────────────────────────────────────

create or replace function public.link_current_user(email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_email     text;
  v_member_id uuid;
begin
  -- Must be authenticated.
  if v_uid is null then
    return false;
  end if;

  -- Identity comes from the verified JWT email (auth.email()), with a
  -- fallback to the auth.users record. The `email` parameter is accepted
  -- for call-signature compatibility but is NOT trusted as identity.
  v_email := lower(coalesce(
    auth.email(),
    (select u.email from auth.users u where u.id = v_uid)
  ));

  if v_email is null then
    return false;
  end if;

  -- Explicit email -> STABLE member UUID (seeded in migration 002).
  -- Immune to display-name changes.
  v_member_id := case v_email
    when 'first.adult@example.com'  then 'a1000000-0000-0000-0000-000000000001'::uuid
    when 'second.adult@example.com' then 'a2000000-0000-0000-0000-000000000002'::uuid
    else null
  end;

  -- Not an allowlisted adult: link nothing.
  if v_member_id is null then
    return false;
  end if;

  -- Link by stable id. Idempotent and non-clobbering:
  --   * unlinked row (auth_user_id is null) -> claim it
  --   * already linked to this same uid       -> no-op (Assaf stays intact)
  --   * linked to a different uid             -> left untouched
  update public.family_members
  set auth_user_id = v_uid
  where id = v_member_id
    and type = 'adult'
    and (auth_user_id is null or auth_user_id = v_uid);

  return true;
end;
$$;

-- Only authenticated users may call it; never anon/public.
revoke all on function public.link_current_user(text) from public;
grant execute on function public.link_current_user(text) to authenticated;
