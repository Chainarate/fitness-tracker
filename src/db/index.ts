import Dexie, { type Table } from "dexie";
import type {
  Exercise,
  Template,
  WorkoutSession,
  BodyMetric,
  BodyMeasurement,
  DailyNote,
  Settings,
} from "./schema";

/**
 * Dexie database. Bump `.version()` and add a new `.stores()` call when
 * the schema changes. Dexie handles migration of existing rows automatically —
 * for additive changes (new tables, new indexes), no upgrade function needed.
 *
 * Version history:
 *   1 — exercises, templates, workoutSessions, bodyMetrics, settings
 *   2 — added bodyMeasurements, dailyNotes
 */
export class FitnessDB extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<Template, string>;
  workoutSessions!: Table<WorkoutSession, string>;
  bodyMetrics!: Table<BodyMetric, string>;
  bodyMeasurements!: Table<BodyMeasurement, string>;
  dailyNotes!: Table<DailyNote, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("fitness-tracker");

    // v1 — original schema (kept here so existing browsers still upgrade cleanly).
    this.version(1).stores({
      exercises: "id, name, muscleGroup, movementPattern, deletedAt",
      templates: "id, name",
      workoutSessions: "id, date, kind, status, [date+status]",
      bodyMetrics: "id, date",
      settings: "id",
    });

    // v2 — add two new tables. Existing tables are unchanged so existing rows
    // are preserved automatically.
    this.version(2).stores({
      exercises: "id, name, muscleGroup, movementPattern, deletedAt",
      templates: "id, name",
      workoutSessions: "id, date, kind, status, [date+status]",
      bodyMetrics: "id, date",
      bodyMeasurements: "id, date",
      dailyNotes: "id, &date", // unique date — only one journal entry per day
      settings: "id",
    });
  }
}

export const db = new FitnessDB();

/**
 * One-time initialization: seed default exercises + settings if empty.
 * Called from the client root layout.
 */
export async function ensureInitialized(): Promise<void> {
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.put({
      id: "singleton",
      units: "metric",
      defaultRestSec: 120,
      weekStartsOn: 1,
      theme: "system",
      weeklySessionTarget: 3,
    });
  } else {
    // Backfill the new field for users upgrading from v1.
    const s = await db.settings.get("singleton");
    if (s && s.weeklySessionTarget == null) {
      await db.settings.put({ ...s, weeklySessionTarget: 3 });
    }
  }

  const exerciseCount = await db.exercises.count();
  if (exerciseCount === 0) {
    const { seedExercises } = await import("./seed");
    await db.exercises.bulkAdd(seedExercises());
  }
}
