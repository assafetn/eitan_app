-- ─────────────────────────────────────────────────────────
-- Slice 7.1 — responsibilities (אחריות)
--
-- A new top-level container that sits ABOVE tasks. Each one is owned
-- by a single ADULT family member (the parent who "owns" that area of
-- responsibility). Tasks will link to a responsibility via a nullable
-- FK added in migration 011.
--
-- owner_id MUST point at an adult. That invariant is enforced in app
-- logic (the 7.2 UI only offers adults as owners); a DB-level trigger
-- would be the only way to enforce it in Postgres (a CHECK can't
-- subquery another table) and that is more machinery than this rule
-- warrants right now — so we deliberately do NOT add one here.
--
-- RLS reuses the is_adult() SECURITY DEFINER helper from migration 003.
-- No new auth logic, no recursion. Family-scoped: both adults read+write.
-- ─────────────────────────────────────────────────────────

create table if not exists public.responsibilities (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  owner_id    uuid not null references public.family_members(id) on delete cascade,
  color       text,            -- design-token reference (e.g. 'jmh-blue'), nullable
  created_at  timestamptz not null default now()
);

create index if not exists responsibilities_owner_id_idx
  on public.responsibilities (owner_id);

alter table public.responsibilities enable row level security;

drop policy if exists "adults_all_responsibilities" on public.responsibilities;

create policy "adults_all_responsibilities"
  on public.responsibilities
  for all
  using (public.is_adult())
  with check (public.is_adult());
