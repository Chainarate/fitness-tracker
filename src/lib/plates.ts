/**
 * Plate calculator.
 *
 * Given a target weight and bar weight, return the per-side stack of plates
 * using a standard kg plate inventory (greedy descending). If the target
 * cannot be reached exactly, returns the closest achievable weight + remainder.
 */

export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
export const DEFAULT_BAR_KG = 20;

export interface PlateResult {
  /** Per-side list of plate sizes (in descending order). */
  perSide: number[];
  /** The actual weight achieved (bar + 2*perSide). */
  achieved: number;
  /** Difference vs requested target (achieved - target). */
  delta: number;
  /** Whether the target was reachable with the inventory. */
  exact: boolean;
}

export function computePlates(
  targetKg: number,
  options?: {
    barKg?: number;
    /** Either a flat list (treated as infinite supply) or per-side limits. */
    plates?: number[];
    inventory?: { weightKg: number; countPerSide: number }[];
  },
): PlateResult {
  const barKg = options?.barKg ?? DEFAULT_BAR_KG;

  if (targetKg <= barKg) {
    return { perSide: [], achieved: barKg, delta: barKg - targetKg, exact: targetKg === barKg };
  }

  // Build a mutable per-side stock map. If an inventory is supplied, respect
  // its counts; otherwise treat the plate list as effectively unlimited.
  const stock = new Map<number, number>();
  if (options?.inventory) {
    options.inventory.forEach(({ weightKg, countPerSide }) => {
      stock.set(weightKg, (stock.get(weightKg) ?? 0) + countPerSide);
    });
  } else {
    (options?.plates ?? DEFAULT_PLATES_KG).forEach((w) => stock.set(w, Infinity));
  }
  const weights = Array.from(stock.keys()).sort((a, b) => b - a);

  let perSideRemaining = (targetKg - barKg) / 2;
  const perSide: number[] = [];

  while (perSideRemaining >= (weights[weights.length - 1] ?? Infinity) - 0.0001) {
    const plate = weights.find((p) => p <= perSideRemaining + 0.0001 && (stock.get(p) ?? 0) > 0);
    if (!plate) break;
    perSide.push(plate);
    perSideRemaining -= plate;
    stock.set(plate, (stock.get(plate) ?? 0) - 1);
  }

  const achieved = barKg + 2 * perSide.reduce((s, p) => s + p, 0);
  const delta = +(achieved - targetKg).toFixed(2);
  return { perSide, achieved, delta, exact: Math.abs(delta) < 0.01 };
}

/** Group consecutive identical plates for display: [25, 25, 10] -> "2×25, 10" */
export function summarizePlates(perSide: number[]): string {
  if (perSide.length === 0) return "Bar only";
  const counts = new Map<number, number>();
  perSide.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1));
  return Array.from(counts.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([weight, count]) => (count > 1 ? `${count}×${weight}` : `${weight}`))
    .join(", ");
}
