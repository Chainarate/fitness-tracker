-- Fitness Tracker — Supabase / Postgres schema
-- Run this once in the Supabase SQL editor of a fresh project.
-- Re-running is safe: every CREATE uses IF NOT EXISTS.

create extension if not exists "uuid-ossp";

-- ─── Settings (one row per user) ─────────────────────────────────────────────

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  units text not null default 'metric',
  default_rest_sec int not null default 120,
  week_starts_on int not null default 1,
  theme text not null default 'system',
  weekly_session_target int default 3,
  last_backup_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ─── Exercises ───────────────────────────────────────────────────────────────

create table if not exists public.exercises (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text not null,
  equipment text not null,
  movement_pattern text not null,
  notes text,
  default_sets int,
  default_reps int,
  default_rest_sec int,
  is_custom boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exercises_user_idx       on public.exercises(user_id);
create index if not exists exercises_user_updated   on public.exercises(user_id, updated_at);

-- ─── Templates ───────────────────────────────────────────────────────────────

create table if not exists public.templates (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  type text not null default 'strength',
  exercises jsonb not null default '[]'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists templates_user_idx       on public.templates(user_id);
create index if not exists templates_user_updated   on public.templates(user_id, updated_at);

-- ─── Workout sessions ────────────────────────────────────────────────────────

create table if not exists public.workout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  kind text not null,
  status text not null,
  template_id uuid,
  name text not null,
  planned_exercises jsonb,
  sets jsonb,
  cardio jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  duration_sec int,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sessions_user_date       on public.workout_sessions(user_id, date);
create index if not exists sessions_user_updated    on public.workout_sessions(user_id, updated_at);

-- ─── Body metrics ────────────────────────────────────────────────────────────

create table if not exists public.body_metrics (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric,
  body_fat_pct numeric,
  muscle_mass_kg numeric,
  sleep_hours numeric,
  steps int,
  resting_hr int,
  notes text,
  source text not null default 'manual',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists body_metrics_user_date   on public.body_metrics(user_id, date);
create index if not exists body_metrics_user_updated on public.body_metrics(user_id, updated_at);

-- ─── Body measurements ───────────────────────────────────────────────────────

create table if not exists public.body_measurements (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  neck_cm numeric,
  chest_cm numeric,
  waist_cm numeric,
  hip_cm numeric,
  left_arm_cm numeric,
  right_arm_cm numeric,
  left_thigh_cm numeric,
  right_thigh_cm numeric,
  left_calf_cm numeric,
  right_calf_cm numeric,
  notes text,
  source text not null default 'manual',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists body_meas_user_date      on public.body_measurements(user_id, date);
create index if not exists body_meas_user_updated   on public.body_measurements(user_id, updated_at);

-- ─── Daily notes ─────────────────────────────────────────────────────────────

create table if not exists public.daily_notes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  mood int,
  energy int,
  sleep_quality int,
  tags text[],
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);
create index if not exists daily_notes_user_date    on public.daily_notes(user_id, date);
create index if not exists daily_notes_user_updated on public.daily_notes(user_id, updated_at);

-- ─── Row-Level Security ──────────────────────────────────────────────────────
-- Every row is scoped to its user_id. Anonymous access is impossible.

alter table public.settings           enable row level security;
alter table public.exercises          enable row level security;
alter table public.templates          enable row level security;
alter table public.workout_sessions   enable row level security;
alter table public.body_metrics       enable row level security;
alter table public.body_measurements  enable row level security;
alter table public.daily_notes        enable row level security;

-- Generic "own rows only" policy applied to every table.
do $$
declare t text;
begin
  for t in select unnest(array[
    'settings','exercises','templates','workout_sessions',
    'body_metrics','body_measurements','daily_notes'
  ])
  loop
    execute format($f$
      drop policy if exists own_rows on public.%I;
      create policy own_rows on public.%I
        using       (user_id = auth.uid())
        with check  (user_id = auth.uid());
    $f$, t, t);
  end loop;
end$$;
