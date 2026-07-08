# Supabase Setup

## 1. Create the project

Go to [supabase.com](https://supabase.com) → New project. Choose a region close to Israel (e.g. eu-west-1). Save the **Project URL** and **anon key** — you'll need them for `.env.local`.

## 2. Copy env vars

```bash
cp .env.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — your project URL (`https://xxxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — the service role key (Settings → API)
- `ALLOWED_EMAILS` — the two adults' Google account emails, comma-separated, no spaces
  (e.g. `first.adult@example.com,second.adult@example.com`). Server-only; never `NEXT_PUBLIC_`.

## 3. Run migrations

> **Placeholder emails.** `004_link_current_user.sql` and `005_rekey_linking_by_email.sql`
> map each adult's Google account email to their seeded `family_members` row. Those files
> ship with placeholder addresses (`first.adult@example.com`, `second.adult@example.com`)
> so real addresses stay out of this public repo. **When applying to a fresh Supabase
> project, substitute the two real allowlist addresses** — the same ones set in
> `ALLOWED_EMAILS` — or first login will silently fail to link the account.
>
> The existing live project already has these functions applied with the real addresses;
> nothing needs to change there.

Open the SQL Editor in your Supabase dashboard and run each file in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_seed_family.sql`

Or use the Supabase CLI if you have it installed:
```bash
supabase db push
```

## 4. Enable Google OAuth

1. Dashboard → Authentication → Providers → Google → Enable
2. Create a Google OAuth 2.0 client at [console.cloud.google.com](https://console.cloud.google.com):
   - Application type: Web application
   - Authorized redirect URIs: `https://xxxx.supabase.co/auth/v1/callback`
3. Paste the **Client ID** and **Client Secret** into Supabase's Google provider form.
4. In Supabase → Auth → URL Configuration:
   - Site URL: `http://localhost:3000` (dev) or your Vercel URL (prod)
   - Redirect URLs: add `http://localhost:3000/auth/callback` and `https://your-app.vercel.app/auth/callback`

## 5. Verify

- Run `npm run dev`
- Go to `http://localhost:3000` — you should be redirected to `/login`
- Sign in with Assaf's Google account → redirected to `/tasks`
- Sign in with any other Google account → redirected to `/no-access`
