-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────
-- family_members
-- ─────────────────────────────────────────────────────────
create table if not exists public.family_members (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  type          text not null check (type in ('adult', 'child')),
  birthdate     date,
  color         text not null default 'jmh-blue',
  avatar_url    text,
  auth_user_id  uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.family_members enable row level security;

-- Adults can read/write all family_members rows
create policy "adults_all_family_members"
  on public.family_members
  for all
  using (
    auth.uid() in (
      select auth_user_id from public.family_members
      where type = 'adult' and auth_user_id is not null
    )
  );

-- ─────────────────────────────────────────────────────────
-- tasks
-- ─────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id                    uuid primary key default uuid_generate_v4(),
  title                 text not null,
  notes                 text,
  category              text not null default 'general' check (category in ('chore', 'errand', 'kid', 'general')),
  assignee_id           uuid references public.family_members(id) on delete set null,
  child_id              uuid references public.family_members(id) on delete set null,
  due_date              date,
  due_time              time,
  status                text not null default 'open' check (status in ('open', 'done')),
  priority              text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  recurrence_rule       jsonb,
  recurrence_parent_id  uuid references public.tasks(id) on delete cascade,
  created_by            uuid not null references public.family_members(id),
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "adults_all_tasks"
  on public.tasks
  for all
  using (
    auth.uid() in (
      select auth_user_id from public.family_members
      where type = 'adult' and auth_user_id is not null
    )
  );

-- Index for quick open-task queries
create index if not exists tasks_status_due_date_idx on public.tasks (status, due_date);

-- ─────────────────────────────────────────────────────────
-- shopping_items
-- ─────────────────────────────────────────────────────────
create table if not exists public.shopping_items (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  quantity    text,
  is_checked  boolean not null default false,
  added_by    uuid not null references public.family_members(id),
  created_at  timestamptz not null default now()
);

alter table public.shopping_items enable row level security;

create policy "adults_all_shopping"
  on public.shopping_items
  for all
  using (
    auth.uid() in (
      select auth_user_id from public.family_members
      where type = 'adult' and auth_user_id is not null
    )
  );
