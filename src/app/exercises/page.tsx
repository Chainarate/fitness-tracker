"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import type { MuscleGroup } from "@/db/schema";
import { Plus, Layers } from "lucide-react";

const MUSCLE_GROUPS: ("all" | MuscleGroup)[] = [
  "all", "chest", "back", "shoulders", "biceps", "triceps", "forearms",
  "quads", "hamstrings", "glutes", "calves", "core", "full_body", "cardio",
];

export default function ExercisesPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | MuscleGroup>("all");

  const exercises = useLiveQuery(
    () => db.exercises.filter((e) => !e.deletedAt).toArray(),
    [],
  );

  const filtered = useMemo(() => {
    if (!exercises) return [];
    const q = query.toLowerCase().trim();
    return exercises
      .filter((e) => filter === "all" || e.muscleGroup === filter)
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, query, filter]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Exercises</h1>
        <div className="flex gap-2">
          <Link href="/templates">
            <Button variant="secondary">
              <Layers size={16} /> Templates
            </Button>
          </Link>
          <Link href="/exercises/new">
            <Button>
              <Plus size={16} /> New
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex gap-2">
        <Input
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | MuscleGroup)}
          className="w-40"
        >
          {MUSCLE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g === "all" ? "All groups" : g.replace("_", " ")}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No exercises match" description="Try clearing filters or add a custom exercise." />
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => (
            <li key={e.id}>
              <Link href={`/exercises/${e.id}`}>
                <Card className="hover:bg-muted/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-subtle capitalize">
                        {e.muscleGroup.replace("_", " ")} · {e.equipment} · {e.movementPattern}
                      </div>
                    </div>
                    <div className="text-xs text-subtle">
                      {e.defaultSets ?? "–"}×{e.defaultReps ?? "–"}
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
