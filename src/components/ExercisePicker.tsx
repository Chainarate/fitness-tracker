"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import type { MuscleGroup } from "@/db/schema";

const MUSCLE_GROUPS: ("all" | MuscleGroup)[] = [
  "all", "chest", "back", "shoulders", "biceps", "triceps", "forearms",
  "quads", "hamstrings", "glutes", "calves", "core", "full_body", "cardio",
];

/**
 * Modal exercise picker for "quick add" during a workout.
 * Reuses the same library; supports search + muscle-group filter.
 */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  excludeIds = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
  excludeIds?: string[];
}) {
  const exercises = useLiveQuery(
    () => db.exercises.filter((e) => !e.deletedAt).toArray(),
    [],
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | MuscleGroup>("all");

  const filtered = useMemo(() => {
    if (!exercises) return [];
    const q = query.toLowerCase().trim();
    const excludeSet = new Set(excludeIds);
    return exercises
      .filter((e) => !excludeSet.has(e.id))
      .filter((e) => filter === "all" || e.muscleGroup === filter)
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, query, filter, excludeIds]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-lg font-semibold">Add exercise</h2>
        <div className="mb-3 flex gap-2">
          <Input
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | MuscleGroup)}
            className="w-32"
          >
            {MUSCLE_GROUPS.map((g) => (
              <option key={g} value={g}>{g === "all" ? "All" : g.replace("_", " ")}</option>
            ))}
          </Select>
        </div>
        <ul className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
          {filtered.length === 0 ? (
            <li className="text-sm text-subtle py-6 text-center">No matches.</li>
          ) : filtered.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-border bg-bg p-2 text-left hover:bg-muted/40"
                onClick={() => {
                  onPick(e.id);
                  onClose();
                }}
              >
                <div>
                  <div className="text-sm font-medium">{e.name}</div>
                  <div className="text-xs text-subtle capitalize">
                    {e.muscleGroup.replace("_", " ")} · {e.equipment}
                  </div>
                </div>
                <div className="text-xs text-subtle">{e.defaultSets ?? "–"}×{e.defaultReps ?? "–"}</div>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
