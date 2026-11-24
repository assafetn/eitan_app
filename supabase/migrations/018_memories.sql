-- ─────────────────────────────────────────────────────────
-- Family memory (redesign step 5, see docs/chat-redesign-plan.md).
--
-- Short facts Eitan learns from the chat ("נועה אלרגית לבוטנים",
-- "חוג כדורגל של איתן בימי שלישי 17:00"). The whole list goes into
-- Eitan's prompt on every turn, so it stays small: no embeddings.
--
-- Eitan's tools run with the sender's session, so RLS applies: both
-- adults read, add, change and remove facts. Additive / safe to re-run.
-- ─────────────────────────────────────────────────────────

create table if not exists public.memories (
  id                uuid primary key default gen_random_uuid(),
  fact              text not null check (char_length(fact) between 1 and 500),
  -- The family member the fact is about, if any.
  about_member_id   uuid references public.family_members(id) on delete set null,
  -- The chat message it was learned from, if any.
  source_message_id uuid references public.chat_messages(id) on delete set null,
  created_by        uuid references public.family_members(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists memories_created_at_idx on public.memories (created_at);

alter table public.memories enable row level security;

drop policy if exists "adults_read_memories" on public.memories;
create policy "adults_read_memories"
  on public.memories for select
  using (public.is_adult());

drop policy if exists "adults_insert_memories" on public.memories;
create policy "adults_insert_memories"
  on public.memories for insert
  with check (public.is_adult() and created_by = public.current_member_id());

drop policy if exists "adults_update_memories" on public.memories;
create policy "adults_update_memories"
  on public.memories for update
  using (public.is_adult())
  with check (public.is_adult());

drop policy if exists "adults_delete_memories" on public.memories;
create policy "adults_delete_memories"
  on public.memories for delete
  using (public.is_adult());
