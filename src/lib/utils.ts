import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combine Tailwind class names with conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Epley formula — estimated 1RM from weight × reps. */
export function estimated1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** Format seconds as `M:SS` or `H:MM:SS`. */
export function formatDuration(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "0:00";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Format a kg/lb value compactly. */
export function formatWeight(kg: number | undefined, units: "metric" | "imperial" = "metric"): string {
  if (kg == null) return "—";
  if (units === "imperial") {
    const lb = kg * 2.20462;
    return `${lb.toFixed(lb < 100 ? 1 : 0)} lb`;
  }
  return `${kg.toFixed(kg < 100 ? 1 : 0)} kg`;
}

/** Total volume = sum of weight × reps (working sets only). */
export function computeVolume(sets: Array<{ weight?: number; reps?: number; isWarmup?: boolean }>): number {
  return sets
    .filter((s) => !s.isWarmup)
    .reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
}
