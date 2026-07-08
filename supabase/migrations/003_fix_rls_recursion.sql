-- ─────────────────────────────────────────────────────────
-- Fix: infinite recursion (42P17) in RLS policies.
--
-- The original policies in 001 subqueried public.family_members from
-- inside a policy ON public.family_members, which Postgres rejects as
-- infinite recursion. Because tasks/shopping_items policies also
-- subqueried family_members, every query to all three tables failed.
--
-- This migration replaces that subquery with a SECURITY DEFINER helper
-- function. A SECURITY DEFINER function runs with the definer's rights
-- and does NOT re-evaluate the caller's RLS policies, so it can read
-- family_members safely without recursing.
--
-- Security model is unchanged: the two adults (rows in family_members
-- with type = 'adult' whose auth_user_id matches auth.uid()) get full
-- read/write on all rows; everyone else gets nothing.
--
-- Idempotent: function uses create or replace; policies are dropped if
-- they exist before being recreated. Safe to re-run.
-- ─────────────────────────────────────────────────────────

-- Helper: is the current authenticated user an adult family member?
create or replace function public.is_adult()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.family_members
    where auth_user_id = auth.uid()
      and type = 'adult'
  );
$$;

-- Lock down execution: only authenticated users may call it.
revoke all on function public.is_adult() from public;
grant execute on function public.is_adult() to authenticated;

-- ── family_members ───────────────────────────────────────
drop policy if exists "adults_all_family_members" on public.family_members;

create policy "adults_all_family_members"
  on public.family_members
  for all
  using (public.is_adult())
  with check (public.is_adult());

-- ── tasks ────────────────────────────────────────────────
drop policy if exists "adults_all_tasks" on public.tasks;

create policy "adults_all_tasks"
  on public.tasks
  for all
  using (public.is_adult())
  with check (public.is_adult());

-- ── shopping_items ───────────────────────────────────────
drop policy if exists "adults_all_shopping" on public.shopping_items;

create policy "adults_all_shopping"
  on public.shopping_items
  for all
  using (public.is_adult())
  with check (public.is_adult());
