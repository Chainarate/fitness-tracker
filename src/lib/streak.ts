import { addDays, format, startOfWeek, subDays } from "date-fns";
import type { WorkoutSession } from "@/db/schema";

/**
 * Streak + heatmap helpers, built from the same input (a flat list of
 * sessions). Pure functions — testable, no DB access here.
 */

const isCompleted = (s: WorkoutSession) => s.status === "done" || s.status === "modified";

/**
 * Compute consecutive weeks (going back from today) that hit a target number
 * of completed sessions. Current week counts if already at target.
 */
export function weeklyStreak(
  sessions: WorkoutSession[],
  target: number,
  weekStartsOn: 0 | 1,
  now = new Date(),
): {
  current: number;
  thisWeekCount: number;
  thisWeekTarget: number;
} {
  if (target <= 0) return { current: 0, thisWeekCount: 0, thisWeekTarget: 0 };
  const completed = sessions.filter(isCompleted);
  const buckets = new Map<string, number>(); // key = ISO date of week start
  for (const s of completed) {
    const d = new Date(s.date);
    const k = format(startOfWeek(d, { weekStartsOn }), "yyyy-MM-dd");
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }

  const thisStart = startOfWeek(now, { weekStartsOn });
  const thisKey = format(thisStart, "yyyy-MM-dd");
  const thisWeekCount = buckets.get(thisKey) ?? 0;

  let streak = 0;
  // Look back week by week from `thisStart`. The current week counts only if
  // it already met the target — otherwise we still have time.
  let cursor = thisStart;
  let firstWeek = true;
  while (true) {
    const key = format(cursor, "yyyy-MM-dd");
    const count = buckets.get(key) ?? 0;
    if (count >= target) {
      streak += 1;
    } else if (!firstWeek) {
      break;
    }
    firstWeek = false;
    cursor = addDays(cursor, -7);
    if (streak > 500) break; // safety
  }

  return { current: streak, thisWeekCount, thisWeekTarget: target };
}

/**
 * GitHub-style heatmap data: returns the last `weeks` weeks (default 12) as
 * a 2D array of day cells. Each cell has the date and number of completed
 * sessions on that day.
 */
export interface HeatmapCell {
  date: string; // yyyy-MM-dd
  count: number;
  inFuture: boolean;
}

export function buildHeatmap(
  sessions: WorkoutSession[],
  weekStartsOn: 0 | 1,
  weeks = 12,
  now = new Date(),
): HeatmapCell[][] {
  const completed = sessions.filter(isCompleted);
  const counts = new Map<string, number>();
  for (const s of completed) {
    counts.set(s.date, (counts.get(s.date) ?? 0) + 1);
  }

  const endOfCurrentWeek = addDays(startOfWeek(now, { weekStartsOn }), 6);
  const firstDay = subDays(endOfCurrentWeek, weeks * 7 - 1);
  const today = format(now, "yyyy-MM-dd");

  const grid: HeatmapCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(firstDay, w * 7 + d);
      const ds = format(day, "yyyy-MM-dd");
      row.push({
        date: ds,
        count: counts.get(ds) ?? 0,
        inFuture: ds > today,
      });
    }
    grid.push(row);
  }
  return grid;
}
