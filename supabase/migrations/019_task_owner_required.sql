-- ─────────────────────────────────────────────────────────
-- Every task has an owner: one adult (assignee_id) or both (is_shared).
--
-- Responsibilities and labels are no longer used by the app; their tables
-- and tasks.responsibility_id are left in place (unused) so no data is lost.
--
-- Recurring-occurrence override rows (recurrence_parent_id not null) only
-- record a done date and inherit everything from their series parent, so
-- the rule applies to primary rows only.
-- ─────────────────────────────────────────────────────────

-- Existing tasks with nobody on them become "both".
update public.tasks
set is_shared = true
where recurrence_parent_id is null
  and not is_shared
  and assignee_id is null;

alter table public.tasks drop constraint if exists tasks_owner_required;
alter table public.tasks
  add constraint tasks_owner_required
  check (recurrence_parent_id is not null or is_shared or assignee_id is not null);
