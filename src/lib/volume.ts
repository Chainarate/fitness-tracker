import type { Exercise, MuscleGroup, WorkoutSession } from "@/db/schema";

/**
 * Per-muscle-group volume analysis. Computes a "weekly working sets" count
 * (warm-ups excluded) per muscle group across a given session list, then
 * returns warnings the lifter can act on.
 */

export interface VolumeReport {
  setsByGroup: Map<MuscleGroup, number>;
  warnings: string[];
}

/** Generally-accepted minimum effective volume (MEV) per major group, per week. */
const MIN_SETS_PER_WEEK: Partial<Record<MuscleGroup, number>> = {
  chest: 10,
  back: 10,
  shoulders: 8,
  quads: 10,
  hamstrings: 6,
  glutes: 6,
  biceps: 6,
  triceps: 6,
};

/** Push vs pull antagonist pairs to check balance. */
const ANTAGONIST_PAIRS: [MuscleGroup, MuscleGroup][] = [
  ["chest", "back"],
];

export function weeklyVolumeReport(
  sessions: WorkoutSession[],
  exercises: Exercise[],
): VolumeReport {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const setsByGroup = new Map<MuscleGroup, number>();

  for (const s of sessions) {
    if (s.kind !== "strength") continue;
    for (const set of s.sets ?? []) {
      if (set.isWarmup) continue;
      if ((set.reps ?? 0) <= 0) continue;
      const ex = exMap.get(set.exerciseId);
      if (!ex) continue;
      setsByGroup.set(ex.muscleGroup, (setsByGroup.get(ex.muscleGroup) ?? 0) + 1);
    }
  }

  const warnings: string[] = [];

  // Under-volume warnings.
  for (const [group, min] of Object.entries(MIN_SETS_PER_WEEK) as [MuscleGroup, number][]) {
    const count = setsByGroup.get(group) ?? 0;
    if (count > 0 && count < min) {
      warnings.push(
        `${prettyGroup(group)} is at ${count} working sets — below the rule-of-thumb minimum of ${min}.`,
      );
    } else if (count === 0) {
      // Don't nag about groups the lifter clearly didn't train this week.
      // (Different programs hit different groups on different days.)
    }
  }

  // Antagonist imbalance warnings (push vs pull within the same week).
  for (const [a, b] of ANTAGONIST_PAIRS) {
    const ca = setsByGroup.get(a) ?? 0;
    const cb = setsByGroup.get(b) ?? 0;
    if (ca > 0 && cb > 0) {
      const ratio = Math.max(ca, cb) / Math.min(ca, cb);
      if (ratio >= 2) {
        const more = ca > cb ? a : b;
        const less = ca > cb ? b : a;
        warnings.push(
          `${prettyGroup(more)} (${Math.max(ca, cb)} sets) is more than 2× ${prettyGroup(less)} (${Math.min(ca, cb)} sets) this week — consider rebalancing.`,
        );
      }
    }
  }

  return { setsByGroup, warnings };
}

function prettyGroup(g: MuscleGroup): string {
  return g.charAt(0).toUpperCase() + g.slice(1).replace("_", " ");
}
