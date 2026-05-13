import { db } from "@/db";
import { estimated1RM } from "@/lib/utils";
import type { LoggedSet } from "@/db/schema";

/**
 * PR benchmarks for an exercise — computed once and cached per session.
 *
 * `heaviestWeight`: heaviest weight ever lifted (any reps, non-warmup, done sessions).
 * `bestE1rm`: highest Epley-estimated 1RM ever logged.
 *
 * Both are pre-`set` — i.e. they represent the best _before_ the current
 * session, so a set logged today that beats these is a new PR.
 */
export interface PRBenchmarks {
  heaviestWeight: number;
  bestE1rm: number;
}

export async function loadPRBenchmarks(
  exerciseId: string,
  excludeSessionId?: string,
): Promise<PRBenchmarks> {
  const sessions = await db.workoutSessions
    .where("status")
    .anyOf(["done", "modified"])
    .filter((s) => !s.deletedAt)
    .toArray();

  let heaviestWeight = 0;
  let bestE1rm = 0;

  for (const s of sessions) {
    if (s.id === excludeSessionId) continue;
    for (const set of s.sets ?? []) {
      if (set.exerciseId !== exerciseId) continue;
      if (set.isWarmup) continue;
      const w = set.weight ?? 0;
      const r = set.reps ?? 0;
      if (w > heaviestWeight) heaviestWeight = w;
      const e = estimated1RM(w, r);
      if (e > bestE1rm) bestE1rm = e;
    }
  }
  return { heaviestWeight, bestE1rm };
}

export type PRKind = "weight" | "e1rm" | null;

/**
 * Determine whether a single set is a PR vs the given benchmarks.
 * Returns the strongest applicable badge:
 *   - "weight"  → new heaviest single lift
 *   - "e1rm"    → new estimated 1RM
 *   - null      → not a PR
 */
export function classifyPR(set: LoggedSet, benchmarks: PRBenchmarks): PRKind {
  if (set.isWarmup) return null;
  const w = set.weight ?? 0;
  const r = set.reps ?? 0;
  if (w <= 0 || r <= 0) return null;

  if (w > benchmarks.heaviestWeight) return "weight";
  const e = estimated1RM(w, r);
  if (e > benchmarks.bestE1rm) return "e1rm";
  return null;
}
