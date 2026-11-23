-- ─────────────────────────────────────────────────────────
-- Redesign step 2: at most ONE Eitan reply per user message.
--
-- The respond endpoint stores the triggering message id in
-- meta.reply_to. A double-tap, a retry, or two devices racing can
-- each start a run; this index makes the second insert fail
-- instead of posting a duplicate answer.
--
-- Additive, idempotent.
-- ─────────────────────────────────────────────────────────

create unique index if not exists chat_messages_one_reply_per_message
  on public.chat_messages ((meta->>'reply_to'))
  where role = 'assistant' and meta ? 'reply_to';
