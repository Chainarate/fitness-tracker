# Supabase setup — one-time, ~5 minutes

Follow these steps once. After this you'll never have to think about it again.

## 1. Create a Supabase project

1. Go to <https://supabase.com> and click **Start your project** (sign in with GitHub or email).
2. Click **New project**. Pick a name like `fitness-tracker` and a strong DB password (save it somewhere — you won't need it day-to-day but keep it).
3. Choose the **region closest to you** (e.g. Singapore for Thailand) so reads/writes are fast.
4. Wait ~1 minute for it to provision.

## 2. Run the SQL schema

1. In the left sidebar click **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this repo, copy the whole file, paste it into the editor.
3. Click **Run**. You should see `Success. No rows returned.`
4. To verify: in the sidebar click **Table Editor** — you should see 7 tables (`exercises`, `templates`, `workout_sessions`, `body_metrics`, `body_measurements`, `daily_notes`, `settings`).

## 3. Get your project's API keys

1. In the sidebar click **Project Settings** (gear icon) → **API**.
2. Copy two values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (a long string starting with `eyJ...`). Use the **anon** key, NOT the `service_role` one.

## 4. Add them to the app

### Local dev

Create a file at the project root called `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Restart `npm run dev`.

### Vercel (production)

1. Go to <https://vercel.com> → your `fitness-tracker` project → **Settings** → **Environment Variables**.
2. Add both variables with the same names and values.
3. Choose "Production, Preview, Development".
4. Click **Save**.
5. Redeploy: `npx vercel --prod`.

## 5. Configure auth redirect (so magic links work in production)

1. Back in Supabase, sidebar → **Authentication** → **URL Configuration**.
2. **Site URL**: paste your Vercel URL (e.g. `https://fitness-tracker-mu-wine.vercel.app`).
3. **Redirect URLs**: add the same URL + `/auth/callback`, e.g.
   - `https://fitness-tracker-mu-wine.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (for local dev)
4. Click **Save**.

## 6. Done — sign in inside the app

1. Open the app → **Settings**.
2. Find **Cloud sync** → enter your email → **Send magic link**.
3. Check your inbox, click the link. The app reloads signed in.
4. On first sign-in the app will **upload all your existing local data** to Supabase automatically. After that, every write syncs.
5. On any other device: install the app → Settings → sign in with the same email → all your data appears.

## Free tier limits

Supabase free tier gives you:

- 500 MB database (you'll never hit this with personal fitness data — millions of sets fit easily)
- 50,000 monthly active users (you = 1 user)
- 2 GB bandwidth per month
- Daily automated backups
- No credit card required

For personal use this is permanently free.

## Troubleshooting

**Magic link doesn't arrive** → check spam folder. Some providers block Supabase's default sender. You can configure a custom SMTP under Authentication → SMTP if needed.

**"Invalid login credentials"** → the redirect URL in Supabase doesn't match what the app is trying to use. Double-check Step 5.

**Sync seems stuck** → in the app, Settings → tap "Sync now". Check the browser console for errors.

**Want to wipe everything and start over** → in Supabase SQL editor, run `truncate exercises, templates, workout_sessions, body_metrics, body_measurements, daily_notes, settings cascade;` then in the app Settings → "Wipe all local data".
