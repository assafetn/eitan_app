-- ─────────────────────────────────────────────────────────
-- Display-name fix: Nathalie's name was seeded misspelled.
-- Corrects ONLY the display name. Does not touch her email,
-- auth_user_id, allowlist, or any other column.
--
-- SAFE because migration 005 re-keyed link_current_user() to match on
-- the member's stable seeded UUID instead of name. Renaming the row no
-- longer affects account linking, regardless of login order.
--
-- MUST be applied AFTER migration 005 (the email re-key).
-- ─────────────────────────────────────────────────────────

update public.family_members
set name = 'נטלי'
where name = 'Nathalie';
