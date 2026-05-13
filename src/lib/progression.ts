import { db } from "@/db";
import type { Exercise, LoggedSet, TemplateExercise, WorkoutSession } from "@/db/schema";

/**
 * Auto-progression engine — deterministic, rule-based.
 *
 * Algorithm (per exercise):
 * 1. Look at the most recent completed/modified session containing this exercise.
 * 2. Compare actual working sets vs the session's plannedExercises target.
 *    - "Hit" = every working set reached the target rep count at the same weight.
 *    - "Failed" = ≥1 working set fell below target reps OR weight dropped.
 * 3. Suggest next weight:
 *    - If hit → +increment (compound or isolation)
 *    - If failed once → keep same weight, same reps
 *    - If failed back-to-back → suggest deload to 90%
 *
 * The increment is bigger for compound lifts because they recruit more muscle
 * and recover from small jumps faster than isolation lifts do.
 */

export type ProgressionVerdict = "hit" | "fail" | "deload" | "unknown";

export interface Suggestion {
  weight: number;
  verdict: ProgressionVerdict;
  reason: string;
}

const COMPOUND_PATTERNS = new Set(["squat", "hinge", "push", "pull"]);

function isCompound(exercise: Exercise): boolean {
  return exercise.movementPattern !== "isolation" &&
    exercise.movementPattern !== "cardio" &&
    exercise.movementPattern !== "core" &&
    COMPOUND_PATTERNS.has(exercise.movementPattern);
}

function defaultIncrement(exercise: Exercise): number {
  return isCompound(exercise) ? 2.5 : 1.25;
}

interface HistoryRow {
  date: string;
  workingSets: LoggedSet[];
  plannedTargetReps: number | null;
  plannedTargetSets: number;
  topWeight: number;
}

async function lastHistory(
  exerciseId: string,
  excludeSessionId?: string,
  limit = 2,
): Promise<HistoryRow[]> {
  const sessions = await db.workoutSessions
    .where("status")
    .anyOf(["done", "modified"])
    .reverse()
    .sortBy("date");

  const out: HistoryRow[] = [];
  for (const s of sessions) {
    if (s.id === excludeSessionId) continue;
    if (s.deletedAt) continue;
    const working = (s.sets ?? []).filter((x) => x.exerciseId === exerciseId && !x.isWarmup);
    if (working.length === 0) continue;
    const plan = s.plannedExercises?.find((p) => p.exerciseId === exerciseId);
    const targetReps =
      plan && Number.isFinite(+plan.targetReps) ? Number(plan.targetReps) : null;
    out.push({
      date: s.date,
      workingSets: working,
      plannedTargetReps: targetReps,
      plannedTargetSets: plan?.targetSets ?? working.length,
      topWeight: Math.max(...working.map((w) => w.weight ?? 0)),
    });
    if (out.length >= limit) break;
  }
  return out;
}

function verdictFor(row: HistoryRow): ProgressionVerdict {
  // No target reps means we can't judge — leave unknown.
  if (row.plannedTargetReps == null) return "unknown";
  const target = row.plannedTargetReps;
  const expected = row.plannedTargetSets;
  const top = row.topWeight;
  // Count working sets that hit target at the top weight.
  const hits = row.workingSets.filter(
    (s) => (s.weight ?? 0) >= top && (s.reps ?? 0) >= target,
  ).length;
  return hits >= expected ? "hit" : "fail";
}

/**
 * Compute the next-weight suggestion for an exercise. Returns null if there's
 * no usable history.
 */
export async function suggestNextWeight(
  exerciseId: string,
  excludeSessionId?: string,
): Promise<Suggestion | null> {
  const exercise = await db.exercises.get(exerciseId);
  if (!exercise) return null;
  const history = await lastHistory(exerciseId, excludeSessionId, 2);
  if (history.length === 0) return null;

  const [last, prev] = history;
  const v1 = verdictFor(last);

  // Two failures in a row → deload.
  if (prev && v1 === "fail" && verdictFor(prev) === "fail") {
    const next = Math.round(last.topWeight * 0.9 * 4) / 4; // round to nearest 0.25kg
    return {
      weight: next,
      verdict: "deload",
      reason: "Two missed sessions — try a deload at 90%.",
    };
  }

  if (v1 === "hit") {
    const inc = defaultIncrement(exercise);
    return {
      weight: +(last.topWeight + inc).toFixed(2),
      verdict: "hit",
      reason: `Hit ${last.plannedTargetReps} reps last time — bump +${inc} kg.`,
    };
  }
  if (v1 === "fail") {
    return {
      weight: last.topWeight,
      verdict: "fail",
      reason: "Missed reps last time — repeat the same weight.",
    };
  }
  return {
    weight: last.topWeight,
    verdict: "unknown",
    reason: "No target rep count to judge against — repeating last weight.",
  };
}

/**
 * Lighter version: just the suggested weight, falling back to plan or last set.
 * Use this when populating a fresh set's default weight.
 */
export async function defaultWeightFor(
  exerciseId: string,
  plan: TemplateExercise,
  currentSession: WorkoutSession,
): Promise<{ weight: number | undefined; suggestion: Suggestion | null }> {
  const inSession = (currentSession.sets ?? []).filter((s) => s.exerciseId === exerciseId);
  // If user already logged a set this session, reuse that weight (no surprises mid-workout).
  const last = inSession.at(-1);
  if (last?.weight) {
    return { weight: last.weight, suggestion: null };
  }
  const suggestion = await suggestNextWeight(exerciseId, currentSession.id);
  if (suggestion) return { weight: suggestion.weight, suggestion };
  return { weight: plan.targetWeight, suggestion: null };
}
