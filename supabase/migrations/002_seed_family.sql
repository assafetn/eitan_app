-- Seed the four family members.
-- Run this AFTER migration 001. auth_user_id is set to null here
-- and will be linked automatically on first Google sign-in.
-- Adjust birthdates if needed.

insert into public.family_members (id, name, type, birthdate, color, auth_user_id)
values
  (
    'a1000000-0000-0000-0000-000000000001',
    'Assaf',
    'adult',
    '1990-01-01',   -- placeholder — update if desired
    'jmh-blue',
    null
  ),
  (
    'a2000000-0000-0000-0000-000000000002',
    'Nathalie',
    'adult',
    '1990-01-01',   -- placeholder — update if desired
    'jmh-periwinkle',
    null
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'Nur',
    'child',
    '2020-07-01',   -- ~6 years old
    'jmh-gold',
    null
  ),
  (
    'c2000000-0000-0000-0000-000000000004',
    'Yarden',
    'child',
    '2024-01-01',   -- ~2.5 years old
    'jmh-sage',
    null
  )
on conflict (id) do nothing;
