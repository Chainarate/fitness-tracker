/**
 * Schema types for the local IndexedDB.
 *
 * Design notes:
 * - All IDs are UUIDs (string). All dates without time are `YYYY-MM-DD`.
 *   All timestamps are full ISO strings.
 * - Templates are *snapshots* at the time of scheduling — the session embeds
 *   `plannedExercises` so editing a template later does not retroactively
 *   change historical sessions.
 * - LoggedSets live inside the WorkoutSession (denormalized) for fast reads.
 */

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core"
  | "full_body"
  | "cardio";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "kettlebell"
  | "band"
  | "other";

export type MovementPattern =
  | "push"
  | "pull"
  | "squat"
  | "hinge"
  | "carry"
  | "core"
  | "isolation"
  | "cardio";

export type SessionStatus = "planned" | "in_progress" | "done" | "skipped" | "modified";
export type SessionKind = "strength" | "cardio";

// ─── Exercise library ───────────────────────────────────────────────────────

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  movementPattern: MovementPattern;
  notes?: string;
  defaultSets?: number;
  defaultReps?: number;
  defaultRestSec?: number;
  isCustom: boolean;
  deletedAt?: string; // soft delete
  createdAt: string;
  updatedAt: string;
}

// ─── Templates (reusable strength workout blueprints) ───────────────────────

export interface TemplateExercise {
  exerciseId: string;
  order: number;
  targetSets: number;
  targetReps: string; // "5", "8-12", "AMRAP"
  targetWeight?: number;
  targetRPE?: number;
  targetRIR?: number;
  restSec?: number;
  notes?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  type: "strength";
  exercises: TemplateExercise[];
  /** Soft-delete tombstone — when set, the row is hidden from UI but kept
   *  in Dexie so the sync engine can propagate the deletion to other devices. */
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Workout sessions (planned + completed) ─────────────────────────────────

export interface LoggedSet {
  id: string;
  exerciseId: string;
  setNumber: number;
  weight?: number;
  reps?: number;
  rpe?: number;
  rir?: number;
  restSec?: number;
  isWarmup?: boolean;
  completedAt?: string;
  notes?: string;
}

export type CardioType =
  | "zone2"
  | "easy_run"
  | "long_run"
  | "tempo"
  | "intervals"
  | "bike"
  | "row"
  | "other";

export interface CardioDetails {
  type: CardioType;
  durationSec: number;
  distanceKm?: number;
  avgPaceSecPerKm?: number;
  avgHr?: number;
  maxHr?: number;
  hrZone?: 1 | 2 | 3 | 4 | 5;
  calories?: number;
  perceivedEffort?: number; // 1-10
}

export interface WorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD (local)
  kind: SessionKind;
  status: SessionStatus;
  templateId?: string; // for strength
  name: string;
  /**
   * Snapshot of the template at schedule time. Empty for ad-hoc sessions.
   * The execution UI iterates this list to know "what was planned".
   */
  plannedExercises?: TemplateExercise[];
  /** Actual sets logged during execution. */
  sets?: LoggedSet[];
  cardio?: CardioDetails;
  startedAt?: string;
  completedAt?: string;
  durationSec?: number;
  notes?: string;
  /** Soft-delete tombstone — set instead of hard-deleting so the deletion
   *  propagates to other devices via sync. UI filters out rows with this set. */
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Body metrics ───────────────────────────────────────────────────────────

export type MetricSource = "manual" | "apple_health" | "xiaomi" | "import";

export interface BodyMetric {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg?: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  sleepHours?: number;
  steps?: number;
  restingHr?: number;
  notes?: string;
  source: MetricSource;
  deletedAt?: string;
  createdAt: string;
}

// ─── Body circumference measurements ────────────────────────────────────────
// Separate from BodyMetric because circumference is typically measured less
// frequently (weekly/monthly) and tracking it next to daily weight would
// noise up the data. One row per measurement session.

export interface BodyMeasurement {
  id: string;
  date: string; // YYYY-MM-DD
  /** All values are centimeters. All fields optional — log what you measured. */
  neckCm?: number;
  chestCm?: number;
  waistCm?: number;
  hipCm?: number;
  leftArmCm?: number;
  rightArmCm?: number;
  leftThighCm?: number;
  rightThighCm?: number;
  leftCalfCm?: number;
  rightCalfCm?: number;
  notes?: string;
  source: MetricSource;
  deletedAt?: string;
  createdAt: string;
}

// ─── Daily notes / journal ──────────────────────────────────────────────────
// A free-form daily journal — useful for rest days, gym observations,
// nutrition adherence, illness, etc. Independent of any session.

export interface DailyNote {
  id: string;
  date: string; // YYYY-MM-DD
  mood?: 1 | 2 | 3 | 4 | 5;        // 1=terrible, 5=great
  energy?: 1 | 2 | 3 | 4 | 5;
  sleepQuality?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];                 // e.g. ["sick", "deload", "vacation"]
  notes?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Settings ───────────────────────────────────────────────────────────────

export interface Settings {
  id: "singleton";
  units: "metric" | "imperial";
  defaultRestSec: number;
  weekStartsOn: 0 | 1; // 0=Sun, 1=Mon
  theme: "system" | "light" | "dark";
  lastBackupAt?: string;
  /** Weekly workout target — used by the streak counter. Default 3. */
  weeklySessionTarget?: number;
  /**
   * Plate inventory for the plate calculator — pairs of {weight, count}
   * where count is the number AVAILABLE PER SIDE.
   * Default is a typical commercial gym stack.
   * Local-only by design: plates differ between home and gym.
   */
  plateInventory?: { weightKg: number; countPerSide: number }[];
  /** Default bar weight in kg (typically 20). */
  barWeightKg?: number;
}

// Helper union for the export bundle.
// Bumped to v2 to include new entities. Importing a v1 bundle is still
// supported; missing tables just stay empty.
export interface ExportBundle {
  version: 1 | 2;
  exportedAt: string;
  exercises: Exercise[];
  templates: Template[];
  workoutSessions: WorkoutSession[];
  bodyMetrics: BodyMetric[];
  /** v2+ */
  bodyMeasurements?: BodyMeasurement[];
  /** v2+ */
  dailyNotes?: DailyNote[];
  settings: Settings;
}
