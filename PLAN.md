# Personal Fitness Tracker — Plan & Architecture

> A local-first PWA for planning, executing, and tracking strength & cardio training.

---

## 1. Product Requirements Document (PRD)

### 1.1 Vision
A single, fast, offline-capable app where I can plan a training week, execute workouts (strength + cardio), log results, and see whether I'm actually progressing — without the bloat of mainstream fitness apps (no social feed, no AI coach, no paywalls).

### 1.2 Goals
- **One source of truth** for planned and completed training.
- **Frictionless logging during a workout** — minimize taps on mobile.
- **Visible progress** — both per-exercise (progressive overload) and per-week (adherence).
- **Own your data** — local-first storage + full CSV/JSON export.
- **Maintainable** — clean schema and component structure so features (Apple Health, cloud sync, multi-user) can be added later without a rewrite.

### 1.3 Non-Goals (for now)
- Social/sharing features.
- AI coaching, form analysis, generated programs.
- In-app payments / subscriptions.
- Real-time multi-device sync (deferred — local-first only at MVP).
- Native iOS/Android wrappers (PWA is good enough).

### 1.4 Target User
A single user (me) — intermediate lifter who also runs Z2/intervals, wants a simple planner + logger + progress view.

### 1.5 Success Criteria
- I open the app daily and log every workout for 4 weeks straight.
- Logging a strength set takes ≤ 2 taps from "start workout".
- I can answer "is my bench press going up?" in < 5 seconds.
- Full data export works and re-imports cleanly.

---

## 2. MVP Scope

### Build now (MVP — Phase 1)
- Calendar view (week + month), with workout sessions per day.
- Exercise library (CRUD, with muscle group, equipment, default sets/reps).
- Strength templates (Push/Pull/Legs etc.) — list of exercises with target sets/reps/RPE.
- Schedule a template to a date → creates a planned `WorkoutSession`.
- Workout execution screen: log sets (weight × reps, RPE, rest timer).
- Cardio session logging (type, duration, distance, avg HR, perceived effort).
- Body metrics: weight, body fat %, sleep hrs, steps, RHR (manual input).
- Dashboard: this week's planned vs done, total volume, cardio time, recent PRs.
- Per-exercise history chart (weight & estimated 1RM over time).
- CSV + JSON export / JSON import.
- PWA install, offline support, dark mode.

### Postpone (Phase 2+)
- Apple Health / HealthKit sync.
- Xiaomi Mi Fitness import (CSV ingestion).
- Cloud sync (Supabase) + multi-device.
- Auth.
- Notifications/reminders.
- Plate calculator / warm-up generator.
- 1RM testing protocol, RPE→%1RM tables.
- "Modified" session diff UI (will support the *flag* in MVP, but not a detailed diff view).
- Auto-program generators / periodization.

---

## 3. Recommended Tech Stack

| Layer | Choice | Reasoning |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | First-class PWA support, file-based routing, easy Vercel deploy, can add server features later without migration. |
| Styling | **Tailwind CSS + shadcn/ui** | Fast iteration, accessible primitives, no lock-in (copy-paste components). |
| Local DB | **Dexie.js (IndexedDB wrapper)** | Real database (indexes, transactions) in the browser. Survives offline. Versionable migrations. No backend needed. |
| State | **Zustand** + Dexie's `useLiveQuery` | Zustand for UI state (current workout in progress, timers). `useLiveQuery` for reactive DB reads — no manual cache management. |
| Charts | **Recharts** | Simple declarative API, works fine for the chart count we need. |
| Dates | **date-fns** | Tree-shakeable, immutable, no timezone surprises. |
| Validation | **Zod** | Same schemas for forms + import validation. |
| Forms | **react-hook-form + Zod resolver** | Minimal re-renders, integrates with Zod. |
| PWA | **Serwist** (successor to next-pwa) | Modern, maintained, works with App Router. |
| Icons | **lucide-react** | Matches shadcn aesthetics. |
| Testing (later) | Vitest + Playwright | Skipped at MVP for speed. |

### Why local-first?
- **Zero backend complexity** → ship in days, not weeks.
- **Offline by default** → log a workout in the gym basement with no signal.
- **Privacy** → no account, no data leaves the device.
- **Cheap** → static export deploys free.
- **Forward-compatible** → Dexie schema → Postgres schema is a straight port when we add Supabase.

---

## 4. Database Schema (Dexie / IndexedDB)

All tables use `id: string` (UUIDv7-like) as the primary key. Timestamps are ISO strings.

```ts
// Exercise library
exercises: {
  id: string
  name: string                      // "Bench Press"
  muscleGroup: MuscleGroup          // 'chest' | 'back' | 'legs' | ...
  equipment: Equipment              // 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'cable'
  movementPattern: Pattern          // 'push' | 'pull' | 'squat' | 'hinge' | 'carry' | 'core'
  notes?: string
  defaultSets?: number
  defaultReps?: number
  defaultRestSec?: number
  isCustom: boolean
  createdAt: string
  updatedAt: string
}

// A reusable strength workout template (Push, Pull, Legs, ...)
templates: {
  id: string
  name: string
  description?: string
  type: 'strength'                  // future-proofed; cardio uses a different model
  exercises: TemplateExercise[]     // ordered list
  createdAt: string
  updatedAt: string
}

// Embedded in `templates`
type TemplateExercise = {
  exerciseId: string
  order: number
  targetSets: number
  targetReps: string                // "5", "8-12", "AMRAP"
  targetWeight?: number             // kg, optional
  targetRPE?: number                // 1-10
  targetRIR?: number                // 0-5
  restSec?: number
  notes?: string
}

// A scheduled or completed workout session
workoutSessions: {
  id: string
  date: string                      // YYYY-MM-DD (local date)
  kind: 'strength' | 'cardio'
  status: 'planned' | 'done' | 'skipped' | 'modified'
  templateId?: string               // for strength sessions
  name: string                      // copy of template name OR cardio session name
  startedAt?: string                // when execution began
  completedAt?: string
  durationSec?: number              // computed at completion
  notes?: string
  // strength-specific:
  sets?: LoggedSet[]                // logged sets across all exercises
  // cardio-specific:
  cardio?: CardioDetails
  createdAt: string
  updatedAt: string
}

type LoggedSet = {
  id: string
  exerciseId: string
  setNumber: number                 // 1, 2, 3, ...
  weight?: number                   // kg
  reps?: number
  rpe?: number
  rir?: number
  restSec?: number
  isWarmup?: boolean
  completedAt?: string
  notes?: string
}

type CardioDetails = {
  type: 'zone2' | 'easy_run' | 'long_run' | 'tempo' | 'intervals' | 'bike' | 'row' | 'other'
  durationSec: number
  distanceKm?: number
  avgPaceSecPerKm?: number          // computed
  avgHr?: number
  maxHr?: number
  hrZone?: 1 | 2 | 3 | 4 | 5
  calories?: number
  perceivedEffort?: number          // 1-10 (RPE)
}

// Body / lifestyle metrics — one row per measurement event
bodyMetrics: {
  id: string
  date: string                      // YYYY-MM-DD
  weightKg?: number
  bodyFatPct?: number
  muscleMassKg?: number
  sleepHours?: number
  steps?: number
  restingHr?: number
  notes?: string
  source: 'manual' | 'apple_health' | 'xiaomi' | 'import'  // future-proofed
  createdAt: string
}

// App preferences
settings: {
  id: 'singleton'                   // always one row
  units: 'metric' | 'imperial'
  defaultRestSec: number
  weekStartsOn: 0 | 1               // 0=Sunday, 1=Monday
  theme: 'system' | 'light' | 'dark'
  lastBackupAt?: string
}
```

### Dexie indexes
```ts
exercises:       'id, name, muscleGroup, movementPattern'
templates:       'id, name'
workoutSessions: 'id, date, kind, status, [date+status]'
bodyMetrics:     'id, date'
```

The compound `[date+status]` index makes the calendar view fast (fetch all planned/done sessions for a date range in one query).

---

## 5. Main Entities & Relationships

```
Exercise (library) ──┐
                     │ referenced by id
                     ▼
TemplateExercise ── belongs to ──► Template
                                       │
                                       │ optionally based on
                                       ▼
                                  WorkoutSession ──contains──► LoggedSet ──refs──► Exercise
                                       │
                                       │ (if kind='cardio')
                                       ▼
                                  CardioDetails (embedded)

BodyMetric ── standalone, joined only by date in the dashboard

Settings ── singleton
```

Key design notes:
- **Exercises are referenced by ID, never copied.** Renaming "Bench Press" updates everywhere — but historical logs keep their `weight/reps` numbers untouched.
- **Templates are immutable snapshots when scheduled.** When a template is dropped on a calendar day, we *copy* its `TemplateExercise` list into the `WorkoutSession`'s expected structure. Editing the template later does not retroactively change scheduled sessions. (This is the right call: the gym yesterday wasn't done with today's template.)
- **`LoggedSet` lives inside the `WorkoutSession`** — denormalized for fast reads. The whole session is one IndexedDB record.
- **Body metrics are independent** — they're not "owned" by anything, queryable purely by date range.

---

## 6. User Stories

**Planning**
- As me, I can open the calendar and see what's scheduled this week so I know what's coming.
- As me, I can drop a "Push" template onto Wednesday so I plan my week in one place.
- As me, I can drag a workout from Tuesday to Thursday when life gets in the way.
- As me, I can see a month overview with done/planned/skipped color dots so I see adherence at a glance.

**Strength**
- As me, I can create a "Push Day" template with bench, OHP, incline DB, triceps in 30 seconds.
- As me, I can start a planned workout and see each exercise pre-populated with last session's weights.
- As me, I can log a set in two taps (weight already there, just confirm reps).
- As me, I can hit a rest timer that auto-starts after I log a set.
- As me, I can see my last 3 sessions of bench press while doing bench press today.
- As me, I can mark a session "Modified" if I substituted dumbbells for barbell.

**Cardio**
- As me, I can log a 45-min Z2 run with distance and avg HR in under 20 seconds.
- As me, I can schedule a long run for Sunday and tick it off when done.

**Body Metrics**
- As me, I can enter morning weight + sleep hours from the home screen.
- As me, I can see a 30/90-day weight trend chart.

**Progress**
- As me, I can see "bench press estimated 1RM trending up 5% over 8 weeks".
- As me, I can see weekly volume per muscle group.
- As me, I can see this week's planned vs completed percentage.

**Data**
- As me, I can export everything as JSON and re-import it on a fresh install.
- As me, I can export a CSV of all sets for spreadsheet analysis.

---

## 7. Screen List & Navigation

```
┌──────────────────────────────────────────────────────────────────┐
│ Bottom tab bar (mobile) / Side nav (desktop):                    │
│  [Today] [Calendar] [Workout+] [Progress] [More]                 │
└──────────────────────────────────────────────────────────────────┘

/                       → Today / Dashboard (this week summary + today's session)
/calendar               → Month + week view, schedule/move workouts
/calendar/[date]        → Day detail (list of sessions that day)
/workout/[id]           → Active workout execution (strength or cardio)
/templates              → List of strength templates
/templates/new          → Create template
/templates/[id]         → Edit template
/exercises              → Exercise library (search/filter)
/exercises/new          → Add custom exercise
/exercises/[id]         → Exercise detail + history chart
/cardio/new             → Quick-log a cardio session
/metrics                → Body metrics list + charts
/metrics/new            → Log today's metrics
/progress               → Charts: volume per muscle, exercise PRs, adherence
/settings               → Units, theme, export/import, week-start
```

### Navigation principles
- **Bottom tab bar on mobile** (one-thumb reach). Side rail on ≥ md breakpoint.
- **Big "Workout+" FAB in the center tab** — the most frequent action.
- **Today screen** is the default route: surfaces today's planned session with a "Start" button.

---

## 8. UX Flow — Plan & Complete a Workout

### Flow A: Schedule a workout (Sunday planning)
```
Calendar (month) 
  → tap Wednesday 
  → "Add session" 
  → choose [Strength template] [Cardio session]
  → pick "Push Day" template
  → confirm → WorkoutSession created with status='planned'
  → dot appears on Wednesday
```

### Flow B: Execute a planned workout (Wednesday at the gym)
```
Today screen
  → "Push Day — planned" card
  → tap "Start"
  → status flips to 'in-progress', startedAt recorded
  → Exercise 1: Bench Press
       • Shows "Last time: 80 kg × 5,5,4"
       • Pre-filled with 80 kg × 5
       • [Log set] → set saved, rest timer auto-starts (180s)
       • Adjust weight/reps inline if needed
       • [+ Add set] for extra working set
  → Swipe / tap next exercise
  → Repeat
  → "Finish workout" → status='done', completedAt + durationSec recorded
  → Brief summary screen: total volume, time, vs last session
```

### Flow C: Modified workout
```
During execution
  → user swaps Barbell Bench → DB Bench
  → just logs DB Bench sets (the original is left empty)
  → on finish: app detects ≥1 unfilled exercise OR exercise swap → 
    asks "Mark as Modified?" → flag set
```

### Flow D: Skipped
```
End of day, or user opens session card
  → "Mark Skipped" → status='skipped', no sets recorded
```

### Flow E: Quick cardio log (after a run)
```
FAB → "Log Cardio"
  → preset chips: [Z2] [Easy Run] [Long Run] [Tempo] [Intervals]
  → duration (min:sec wheel), distance (km), avg HR
  → Save → done, appears on today's calendar with status='done'
```

---

## 9. Roadmap

### Phase 1 — MVP (Weeks 1–3)
- Project scaffold, Dexie schema, seed data.
- Exercise library (CRUD).
- Templates (CRUD).
- Calendar: month + week, schedule sessions, move sessions.
- Workout execution (strength).
- Cardio quick-log.
- Body metrics manual entry + trend chart.
- Dashboard / Today.
- Export/import JSON + CSV.
- PWA install, offline.

### Phase 2 — Polish & Insights (Week 4)
- Per-exercise history chart + estimated 1RM (Epley formula).
- Weekly volume per muscle group chart.
- Rest timer with sound/vibration.
- "Last time" hints during workout execution.
- Plate calculator.
- Keyboard shortcuts on desktop.

### Phase 3 — Sync & Health (Months 2–3)
- Supabase backend + sync layer (replicate Dexie → Postgres).
- Auth (magic link).
- Apple Health import (HealthKit via PWA shortcut → CSV → import flow).
- Xiaomi Mi Fitness CSV importer.
- Notifications (workout reminders).

### Phase 4 — Smart Features (later)
- Program builder (multi-week mesocycles).
- Auto-progression suggestions.
- Deload detection.
- Heart-rate zone calculator from age + resting HR.

---

## 10. Edge Cases & Considerations

**Data integrity**
- Deleting an exercise that's referenced by logs → soft-delete (`deletedAt`), keep the row, hide from pickers.
- Editing a template after sessions are scheduled → only affects *future* schedulings (template is copied at schedule time).
- IndexedDB quota exhaustion → warn at 80% of quota, offer export-and-purge.

**Time & dates**
- All session dates are **local calendar dates** (no timezones for "what day did I work out"). Timestamps for `startedAt`/`completedAt` are ISO with TZ.
- Midnight workouts: a session started 11:50 PM and finished 12:30 AM stays attached to its `date` field, not split.
- DST transitions: don't compute durations from `startedAt` math against local clocks; use UTC under the hood.

**Workout execution**
- App closed mid-workout → on relaunch, detect any session with `startedAt` and no `completedAt` → "Resume Push Day?"
- Phone dies → sets logged so far are persisted to IndexedDB synchronously after each set, so nothing is lost.
- Same exercise appears twice in a template (e.g. bench at start, then DB bench at end) → each is its own `exerciseId+position` slot; `LoggedSet.setNumber` is unique within a session+exercise.

**Cardio**
- Distance entered without duration (or vice versa) → pace not computed, no error.
- Heart rate zones differ per person; for MVP, store the user's input (`hrZone`) directly without auto-classification.

**Body metrics**
- Two entries the same day → keep the latest, but show both in a list view (don't dedupe destructively).
- Future Apple Health import will have duplicate detection by `(date, source)`.

**Calendar**
- Moving a `done` session to a future date → block this. Done sessions are historical.
- Moving a `planned` session to a past date → allow, but warn ("Mark as done?").

**Imports**
- JSON re-import on a populated DB → offer Merge vs Replace. Default: Merge with ID conflict resolution = "keep newer `updatedAt`".

**PWA**
- Stale service worker shipping old schema → use Dexie versioned migrations; bump SW cache key on every release.

**Accessibility**
- All numeric inputs must accept keyboard on desktop; use `<input type="number" inputmode="decimal">` on mobile.
- Tap targets ≥ 44px.
- Sufficient contrast in dark mode for low-light gyms.

---

## 11. Implementation — Starting Now

See sibling files in this folder for the scaffolded MVP code. Key files:

- `package.json` — dependencies
- `src/db/schema.ts` — Dexie schema + TypeScript types
- `src/db/index.ts` — Dexie database instance + initialization
- `src/db/seed.ts` — default exercise library
- `src/app/layout.tsx` — root layout with bottom nav
- `src/app/page.tsx` — Today / dashboard
- `src/app/calendar/page.tsx` — calendar planner
- `src/app/workout/[id]/page.tsx` — workout execution
- `src/app/exercises/page.tsx` — exercise library
- `src/app/templates/page.tsx` — strength templates
- `src/app/metrics/page.tsx` — body metrics
- `src/app/settings/page.tsx` — settings + export/import
- `src/lib/export.ts` — CSV/JSON export utilities
- `src/components/*` — shared UI

### Build & run
```bash
cd fitness-tracker
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```
