-- ─────────────────────────────────────────────────────────
-- One emoji per task, showing what Eitan understood (decided 2026-11-26).
--
-- Eitan picks a kind from the catalog in lib/emoji.ts ("groceries" → 🛒,
-- "dentist" → 🦷 …) when he saves a task. The key is stored, not the emoji,
-- so the catalog can change an emoji without touching rows. Null = not
-- chosen (added by hand, or older): the app guesses from the title.
-- No check constraint: the catalog grows in code; the tools validate keys.
--
-- Additive, idempotent.
-- ─────────────────────────────────────────────────────────

alter table public.tasks
  add column if not exists emoji_key text;
