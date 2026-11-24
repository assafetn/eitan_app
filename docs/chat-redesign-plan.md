# Eitan → shared AI chat: build plan

Decided 2026-11-23. This file is the source of truth for the redesign. Update it as steps land.

## Goal

The app becomes one simple **shared chat for the two adults**. Login stays as it is today (Google via Supabase plus the email allowlist).
Either adult writes, or later records, a message. **Eitan** (the AI, Claude) understands it and:

- sets reminders and to-dos for one adult or both
- answers questions about what's coming up ("מה יש מחר?")
- adds things to Google Calendar **only when asked**
- learns and remembers family facts

The UI is secondary. The chat is the product. Feel reference: "zero-UI" texting assistants such as Instinct.

## Decisions

| Topic | Decision |
|---|---|
| Channel | In-app chat (WhatsApp was considered and dropped) |
| Login | Unchanged: Google OAuth via Supabase, `ALLOWED_EMAILS` |
| AI model | Claude Opus 5.5 (`claude-opus-5-5`, effort `medium`), called server-side through the Messages API tool runner. Server-side refusal fallback is on (`fallbacks: "default"`). The key lives in `ANTHROPIC_API_KEY` and is never exposed to the browser |
| Live updates | Supabase Realtime on `chat_messages`, so both phones see messages instantly |
| Reminders | Existing reminder cron and Web Push stay. Reminders are also posted into the chat. Replying "בוצע" completes one |
| Calendar | Two-way Google Calendar access to **each adult's own calendar** (no new shared calendar) |
| Calendar writes | **Opt-in only.** Eitan writes to Google only when asked ("תוסיף ליומן") or when someone taps the **📅 הוסף ליומן** button under a confirmation. Never on its own |
| Calendar reads | Eitan reads both calendars for answers and the morning digest. Reading never changes anything |
| Memory | A `memories` table of family facts. Eitan says when it saves one ("📌 זכרתי: …"). "מה אתה זוכר?" and "תשכח את…" work. The whole list goes into the prompt (small data, no vector search) |
| Voice | Browser recording → Supabase Storage → Hebrew speech-to-text (a separate provider, since Claude doesn't take audio) → the same pipeline as text. The transcript is shown under the voice bubble |

## Calendar rules (when a write is requested)

- **"לי"** → the sender's primary calendar.
- **For the other adult** → that adult's primary calendar.
- **For both** → one event on the sender's calendar with the other adult invited:
  - `sendUpdates: "none"`, so no invitation emails
  - `guestsCanModify: true`
  - Eitan auto-accepts the invite using the other adult's token
- **Kids' activities** → both adults by default. Exceptions are learned through memory.
- **Date but no time** → an all-day event. **No date** → no calendar option and no button.
- **Once linked** (`google_event_id` is stored), edits and deletes made in chat are mirrored to Google. The button then shows "📅 ביומן ✓" and can't add twice.
- **Shared events** appear in both calendars. De-duplicate them by `iCalUID` when reading.
- **Events marked private** in Google show to the other adult as "busy".
- **Alerts:** Google sends its own alerts for calendar events, so Eitan doesn't push them again. Calendar events still appear in the morning digest.

## Safety rules

- Every action is confirmed in the chat, with the explicit day, date and time in Asia/Jerusalem: "ג׳ 25.11 · 16:00".
- Eitan asks before deleting. "בטל" undoes the last action.
- Each message is processed once. A client-generated id makes double-taps and retries harmless.
- Google refresh tokens live in a table only the service role can read (RLS deny-all). They are never sent to the browser.

## Build order

0. **Housekeeping.**
   - Capture the live-only schema (push subscriptions, reminder settings and the notification log exist in the live DB but have no migration in the repo) as a migration.
   - Add this plan.
1. **Chat screen plus live updates** (no AI yet).
   - `chat_messages` table with RLS
   - Realtime subscription
   - chat UI (RTL, bubbles per author)
   - chat becomes the home tab
2. **Eitan replies.**
   - `/api/chat` route that calls Claude with tools: create, list, update, complete and delete tasks
   - Eitan's reply is posted as a bot message
   - the confirmation shows the parsed result
3. **Reminders into chat.**
   - the cron posts due reminders and the morning digest into the chat, as well as pushing them
   - tapping a push opens the chat
   - "בוצע" completes
4. **Google Calendar: DEFERRED (2026-11-24).** The code is written but untested. It's kept in a local git stash named "step 4: Google Calendar". To resume: `git stash list`, then `git stash apply`. It still needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (in Vercel and `.env.local`), then migration 018. The privacy page it needed is already live (`/privacy`).
   - a "Connect Google Calendar" button in Settings for each adult (our own OAuth flow, separate from login)
   - token storage
   - read both calendars
   - the opt-in write tool plus the 📅 button
   - incremental pull of phone-side changes on the cron (`syncToken`)
   - **Google Cloud setup needed:**
     - enable the Calendar API
     - add the calendar scope
     - add a redirect URI
     - **publish the OAuth app.** In "Testing" mode, refresh tokens expire after 7 days.
5. **Memory.** `memories` table, remember / forget / list tools, injected into the prompt.
6. **Voice messages.** Record, upload, transcribe (Hebrew), then the same pipeline.
7. **Cleanup.** Retire the old home dashboard. Keep the task list as a secondary "רשימה" tab or remove it.

## Data model additions (planned)

- `chat_messages`: `id`, `author_id` (a family member, or null for Eitan), `role` (`user` or `assistant`), `body`, `client_id` (unique, for idempotency), `meta` (jsonb: linked task ids, button state, audio path, transcript), `created_at`.
- `memories` (step 5): `id`, `fact`, `about_member_id`, `source_message_id`, `created_by`, `created_at`.
- `google_accounts` (step 4, service-role only): `member_id`, `refresh_token`, `calendar_id`, `sync_token`, `updated_at`.
- `tasks` (step 4): add a nullable `google_event_id` and `google_calendar_owner_id`.
