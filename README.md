# Fitness Tracker

A local-first PWA for planning, executing, and tracking strength training and cardio. Built for personal use — minimal friction in the gym, your data lives in your browser, optional cloud sync via Supabase.

📋 Full PRD, schema, and design rationale: **[`PLAN.md`](./PLAN.md)**

---

## Features

**Planning**
- Month / week calendar with drag-and-drop session moves
- Strength templates (Push / Pull / Legs etc.)
- Repeat last week's workout in one tap
- Cardio quick-log (Z2, intervals, tempo, long run, bike, row)

**Execution**
- Live rest timer with sound + vibration
- Auto-progression suggestions (e.g. +2.5 kg if you hit all target reps)
- Plate calculator (respects your own plate inventory)
- PR detection per set (weight PR + e1RM PR)
- Warm-up toggle (excluded from volume)
- Per-set notes
- Quick-add exercise mid-workout
- Live elapsed-time badge

**Tracking**
- Activity heatmap (12 weeks) + weekly streak
- Daily check-in (mood / energy / sleep)
- Body metrics (weight, BF %, sleep, RHR, steps)
- Body measurements (chest / waist / hip / arms / thighs)
- Per-exercise e1RM trend chart
- Volume-balance warnings (e.g. push:pull imbalance, undertrained groups)

**Data ownership**
- Local-first IndexedDB (works fully offline)
- Optional Supabase cloud sync (cross-device, automatic backups)
- Full JSON + CSV export & import

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Local DB | Dexie.js (IndexedDB) + `dexie-react-hooks` |
| State | Zustand (lightweight) + reactive DB queries |
| Charts | Recharts |
| Forms | react-hook-form + Zod |
| PWA | Serwist (service worker + offline shell) |
| Cloud (optional) | Supabase (Postgres + Auth) |
| Hosting | Vercel |

---

## Quick start (local dev)

```bash
git clone https://github.com/<your-username>/fitness-tracker.git
cd fitness-tracker
npm install
npm run dev
```

Open http://localhost:3000. Without any further setup the app works fully — all data lives in your browser's IndexedDB.

Available scripts:

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve production build
npm run typecheck  # tsc --noEmit (strict)
npm run lint       # next lint
```

---

## Cloud sync setup (optional, ~5 min)

Without this step, the app works fully offline but data stays on one device. Set up Supabase to sync across phone + laptop and get automatic daily backups.

**Detailed click-by-click guide: [`supabase/SETUP.md`](./supabase/SETUP.md)**

TL;DR:

1. Create a free Supabase project at <https://supabase.com>.
2. In the SQL Editor, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) and Run.
3. Copy your Project URL + anon key (Settings → API) into a new `.env.local` file:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
4. In Supabase → Authentication → URL Configuration, add your site URLs (`http://localhost:3000` for dev, your Vercel URL for prod) and add `<that-url>/auth/callback` to redirect URLs.
5. Restart `npm run dev`. Go to Settings → Cloud sync → enter your email → click magic link.
6. Your local data uploads automatically. Every write syncs going forward.

---

## Deploy to Vercel

```bash
npx vercel           # first time — links the project
npx vercel --prod    # subsequent deploys
```

After the first deploy:

1. Go to <https://vercel.com> → your project → Settings → Environment Variables.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same values as `.env.local`).
3. Redeploy: `npx vercel --prod`.
4. Add your production URL + `/auth/callback` to Supabase redirect URLs.

The PWA install prompt requires HTTPS — once deployed, open your Vercel URL on mobile → "Add to Home Screen" — and it behaves like a native app, working offline.

---

## Project layout

```
src/
├── app/                       # Next.js App Router pages
│   ├── page.tsx                   # Today (dashboard)
│   ├── calendar/                  # Month / week planner
│   ├── workout/[id]/              # Execute / view a session
│   ├── exercises/                 # Library + custom exercises
│   ├── templates/                 # Strength template editor
│   ├── cardio/new/                # Quick-log cardio
│   ├── metrics/                   # Body metrics + measurements
│   ├── progress/                  # Charts + volume warnings
│   ├── settings/                  # Units, theme, sync, export
│   ├── auth/callback/             # Supabase magic-link landing
│   └── sw.ts                      # Service worker (PWA)
├── components/
│   ├── AppShell.tsx               # Layout, theme, auth, sync wiring
│   ├── Nav.tsx                    # Bottom tabs / side rail
│   ├── ActivityHeatmap.tsx        # 12-week streak heatmap
│   ├── DailyNoteCard.tsx          # Today's check-in
│   ├── ExercisePicker.tsx         # Quick-add exercise dialog
│   ├── HomeBodyMetric.tsx         # Weight quick-log card
│   ├── MoveSessionDialog.tsx      # Mobile-friendly reschedule
│   ├── PlateCalculator.tsx        # Barbell loading helper
│   ├── RestTimer.tsx              # Floating rest countdown
│   ├── ScheduleDialog.tsx         # Add session to calendar
│   ├── TemplateEditor.tsx         # Build / edit a template
│   └── ui/                        # Button, Input, Card primitives
├── db/
│   ├── index.ts                   # Dexie instance + versioned migrations
│   ├── schema.ts                  # All TypeScript types
│   ├── seed.ts                    # Default exercise library
│   └── queries.ts                 # High-level DB operations
├── lib/
│   ├── audio.ts                   # Web-audio beep + vibrate
│   ├── date.ts                    # date-fns wrappers
│   ├── export.ts                  # JSON + CSV import/export
│   ├── id.ts                      # UUID generator
│   ├── plates.ts                  # Pure plate-loading math
│   ├── pr.ts                      # PR detection logic
│   ├── progression.ts             # Auto-progression engine
│   ├── streak.ts                  # Streak + heatmap math
│   ├── supabase.ts                # Supabase client + auth helpers
│   ├── sync.ts                    # Pull/push sync engine
│   ├── utils.ts                   # cn(), e1RM, volume, formatters
│   └── volume.ts                  # Weekly volume analysis
supabase/
├── schema.sql                     # Postgres schema + RLS
└── SETUP.md                       # Click-by-click setup guide
```

---

## Updating the schema

The local Dexie schema is versioned. To add a field:

1. Add the field to `src/db/schema.ts`.
2. If it's a new table or a new index, bump `this.version(N).stores({...})` in `src/db/index.ts`.
3. For optional fields on existing tables, no migration is needed — IndexedDB doesn't enforce shape.
4. If using Supabase too, add the column with `alter table ... add column if not exists ...;` in the SQL editor.

---

## Known limitations

- **Hard deletes don't propagate via sync** — deleting a session locally removes it from this device but the cloud row remains, and other devices will see it again on next sync. Workaround: delete while online + run `delete` directly in Supabase SQL editor if needed.
- **No realtime push** — devices sync on app load + tab focus + after writes. Manual "Sync now" is available in Settings.
- **Conflict resolution is last-write-wins on `updatedAt`** — fine for personal single-user use; not designed for concurrent multi-user editing.

---

## License

MIT — personal project, do whatever you want with it.
