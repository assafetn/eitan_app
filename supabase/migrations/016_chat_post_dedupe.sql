-- ─────────────────────────────────────────────────────────
-- Redesign step 3: the reminder cron posts into the chat.
--
-- Each automated post (a due reminder, the daily digest) carries a
-- meta.dedupe_key such as "chat:task:<task_id>:<date>" or
-- "chat:digest:<date>". This index makes a second insert of the same
-- key fail. Overlapping cron runs and retries therefore can never post
-- the same reminder twice.
--
-- Additive, idempotent.
-- ─────────────────────────────────────────────────────────

create unique index if not exists chat_messages_one_post_per_dedupe_key
  on public.chat_messages ((meta->>'dedupe_key'))
  where role = 'assistant' and meta ? 'dedupe_key';
