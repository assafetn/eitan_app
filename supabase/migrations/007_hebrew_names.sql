-- ─────────────────────────────────────────────────────────
-- Normalize all family_members display names to Hebrew.
--
-- DISPLAY-NAME-ONLY. Does not touch email, auth_user_id, birthdate, or
-- any auth/RPC/allowlist logic. Account linking is email-keyed (migration
-- 005), so renames are safe regardless of login order.
--
-- Rows are matched by their CURRENT name value. Each statement is
-- idempotent: if a name is already in its final Hebrew form, the WHERE
-- clause simply matches nothing and the statement is a safe no-op.
-- ─────────────────────────────────────────────────────────

-- Father
update public.family_members set name = 'אסף'  where name = 'Assaf';

-- Mother (already 'נטלי' from migration 006; this only fires if it isn't)
update public.family_members set name = 'נטלי' where name = 'Nathalie';

-- Child — was 'Nur' or an interim 'נור'
update public.family_members set name = 'נורי' where name in ('Nur', 'נור');

-- Child
update public.family_members set name = 'ירדן' where name = 'Yarden';
