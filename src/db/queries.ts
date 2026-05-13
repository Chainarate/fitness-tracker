import { db } from "./index";
import { newId } from "@/lib/id";
import { todayLocal } from "@/lib/date";
import type {
  Template,
  WorkoutSession,
  CardioDetails,
  LoggedSet,
  BodyMetric,
  BodyMeasurement,
  DailyNote,
} from "./schema";

/**
 * High-level DB operations. All UI mutations go through these so the
 * underlying schema can be refactored without touching every component.
 */

/**
 * Find the most recent completed strength session on the same weekday in the
 * past 4 weeks. Used by the "Repeat last week" button on the home screen.
 */
export async function findRepeatableLastWorkout(today: string): Promise<WorkoutSession | null> {
  const todayDate = new Date(today);
  const targetDow = todayDate.getDay();
  const sessions = await db.workoutSessions
    .where("status")
    .anyOf(["done", "modified"])
    .reverse()
    .sortBy("date");
  for (const s of sessions) {
    if (s.kind !== "strength") continue;
    if (s.date >= today) continue;
    const d = new Date(s.date);
    const diffDays = Math.floor((todayDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 28) break; // sessions are sorted desc so we can stop early
    if (d.getDay() === targetDow) return s;
  }
  return null;
}

/**
 * Clone a session into a brand-new planned session on the target date.
 * Copies plannedExercises but DROPS logged sets — the new session is empty.
 */
export async function cloneSessionToDate(
  sourceId: string,
  date: string,
): Promise<string | null> {
  const source = await db.workoutSessions.get(sourceId);
  if (!source) return null;
  const now = new Date().toISOString();
  const id = newId();
  const cloned: WorkoutSession = {
    id,
    date,
    kind: source.kind,
    status: "planned",
    templateId: source.templateId,
    name: source.name,
    plannedExercises: structuredClone(source.plannedExercises ?? []),
    sets: [],
    createdAt: now,
    updatedAt: now,
  };
  await db.workoutSessions.add(cloned);
  return id;
}

export async function scheduleStrengthSession(
  template: Template,
  date: string,
): Promise<string> {
  const now = new Date().toISOString();
  const id = newId();
  const session: WorkoutSession = {
    id,
    date,
    kind: "strength",
    status: "planned",
    templateId: template.id,
    name: template.name,
    plannedExercises: structuredClone(template.exercises),
    sets: [],
    createdAt: now,
    updatedAt: now,
  };
  await db.workoutSessions.add(session);
  return id;
}

export async function logCardioSession(
  date: string,
  name: string,
  cardio: CardioDetails,
): Promise<string> {
  const now = new Date().toISOString();
  const id = newId();
  const session: WorkoutSession = {
    id,
    date,
    kind: "cardio",
    status: "done",
    name,
    cardio,
    startedAt: now,
    completedAt: now,
    durationSec: cardio.durationSec,
    createdAt: now,
    updatedAt: now,
  };
  await db.workoutSessions.add(session);
  return id;
}

export async function startSession(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.workoutSessions.update(id, {
    status: "in_progress",
    startedAt: now,
    updatedAt: now,
  });
}

export async function finishSession(id: string, modified = false): Promise<void> {
  const session = await db.workoutSessions.get(id);
  if (!session) return;
  const now = new Date().toISOString();
  const startedAt = session.startedAt ?? now;
  const durationSec = Math.max(
    0,
    Math.round((new Date(now).getTime() - new Date(startedAt).getTime()) / 1000),
  );
  await db.workoutSessions.update(id, {
    status: modified ? "modified" : "done",
    completedAt: now,
    durationSec,
    updatedAt: now,
  });
}

export async function skipSession(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.workoutSessions.update(id, { status: "skipped", updatedAt: now });
}

export async function moveSession(id: string, newDate: string): Promise<void> {
  const session = await db.workoutSessions.get(id);
  if (!session) return;
  if (session.status === "done") {
    throw new Error("Cannot move a completed session.");
  }
  await db.workoutSessions.update(id, {
    date: newDate,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteSession(id: string): Promise<void> {
  await db.workoutSessions.delete(id);
}

/**
 * Add an exercise to an in-flight session's plannedExercises list.
 * Defaults are read from the exercise library row.
 */
export async function addPlannedExercise(
  sessionId: string,
  exerciseId: string,
): Promise<void> {
  const [session, exercise] = await Promise.all([
    db.workoutSessions.get(sessionId),
    db.exercises.get(exerciseId),
  ]);
  if (!session || !exercise) return;
  const planned = session.plannedExercises ?? [];
  planned.push({
    exerciseId,
    order: planned.length,
    targetSets: exercise.defaultSets ?? 3,
    targetReps: String(exercise.defaultReps ?? 8),
    restSec: exercise.defaultRestSec ?? 120,
  });
  await db.workoutSessions.update(sessionId, {
    plannedExercises: planned,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Remove a planned exercise from an in-flight session. Refuses if any sets
 * have already been logged for it — the caller should warn the user first.
 */
export async function removePlannedExercise(
  sessionId: string,
  index: number,
): Promise<void> {
  const session = await db.workoutSessions.get(sessionId);
  if (!session?.plannedExercises) return;
  const removed = session.plannedExercises[index];
  if (!removed) return;
  const hasSets = (session.sets ?? []).some((s) => s.exerciseId === removed.exerciseId);
  if (hasSets) {
    throw new Error("This exercise has logged sets — delete the sets first.");
  }
  const planned = session.plannedExercises
    .filter((_, i) => i !== index)
    .map((p, i) => ({ ...p, order: i }));
  await db.workoutSessions.update(sessionId, {
    plannedExercises: planned,
    updatedAt: new Date().toISOString(),
  });
}

export async function appendSet(
  sessionId: string,
  set: Omit<LoggedSet, "id">,
): Promise<void> {
  const session = await db.workoutSessions.get(sessionId);
  if (!session) return;
  const sets = session.sets ?? [];
  sets.push({ id: newId(), ...set });
  await db.workoutSessions.update(sessionId, {
    sets,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateSet(
  sessionId: string,
  setId: string,
  patch: Partial<LoggedSet>,
): Promise<void> {
  const session = await db.workoutSessions.get(sessionId);
  if (!session?.sets) return;
  const sets = session.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s));
  await db.workoutSessions.update(sessionId, {
    sets,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteSet(sessionId: string, setId: string): Promise<void> {
  const session = await db.workoutSessions.get(sessionId);
  if (!session?.sets) return;
  const sets = session.sets.filter((s) => s.id !== setId);
  await db.workoutSessions.update(sessionId, {
    sets,
    updatedAt: new Date().toISOString(),
  });
}

export async function logBodyMetric(metric: Omit<BodyMetric, "id" | "createdAt">) {
  const entry: BodyMetric = {
    id: newId(),
    createdAt: new Date().toISOString(),
    ...metric,
  };
  await db.bodyMetrics.add(entry);
  return entry.id;
}

export async function logBodyMeasurement(m: Omit<BodyMeasurement, "id" | "createdAt">) {
  const entry: BodyMeasurement = {
    id: newId(),
    createdAt: new Date().toISOString(),
    ...m,
  };
  await db.bodyMeasurements.add(entry);
  return entry.id;
}

/**
 * Upsert the daily note for a given date — only one note per date by design,
 * so editing the journal is just "open today's entry".
 */
export async function upsertDailyNote(
  date: string,
  patch: Partial<Omit<DailyNote, "id" | "date" | "createdAt" | "updatedAt">>,
): Promise<string> {
  const existing = await db.dailyNotes.where("date").equals(date).first();
  const now = new Date().toISOString();
  if (existing) {
    const updated: DailyNote = { ...existing, ...patch, updatedAt: now };
    await db.dailyNotes.put(updated);
    return existing.id;
  }
  const entry: DailyNote = {
    id: newId(),
    date,
    ...patch,
    createdAt: now,
    updatedAt: now,
  };
  await db.dailyNotes.add(entry);
  return entry.id;
}

/**
 * Returns the most recent `n` performances of a given exercise across all
 * sessions, newest first. Used by the workout execution screen to show
 * "last time you did this".
 */
export async function previousPerformance(
  exerciseId: string,
  n = 3,
): Promise<Array<{ session: WorkoutSession; sets: LoggedSet[] }>> {
  const sessions = await db.workoutSessions
    .where("status")
    .anyOf(["done", "modified"])
    .reverse()
    .sortBy("date");

  const results: Array<{ session: WorkoutSession; sets: LoggedSet[] }> = [];
  for (const session of sessions) {
    const sets = (session.sets ?? []).filter((s) => s.exerciseId === exerciseId);
    if (sets.length > 0) {
      results.push({ session, sets });
      if (results.length >= n) break;
    }
  }
  return results;
}

export const todayDateString = () => todayLocal();
