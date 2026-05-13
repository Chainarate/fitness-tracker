"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { Card, CardHeader, EmptyState, Stat } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { computeVolume, estimated1RM } from "@/lib/utils";

export default function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const exercise = useLiveQuery(() => db.exercises.get(id), [id]);

  const sessions = useLiveQuery(
    () => db.workoutSessions.where("status").anyOf(["done", "modified"]).toArray(),
    [],
  );

  const history = useMemo(() => {
    if (!sessions) return [];
    return sessions
      .map((s) => {
        const sets = (s.sets ?? []).filter((x) => x.exerciseId === id && !x.isWarmup);
        if (sets.length === 0) return null;
        const topSet = sets.reduce((best, cur) =>
          (estimated1RM(cur.weight ?? 0, cur.reps ?? 0) >
            estimated1RM(best.weight ?? 0, best.reps ?? 0))
            ? cur : best,
        );
        return {
          date: s.date,
          e1rm: estimated1RM(topSet.weight ?? 0, topSet.reps ?? 0),
          topWeight: topSet.weight ?? 0,
          topReps: topSet.reps ?? 0,
          volume: computeVolume(sets),
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions, id]);

  const bestE1rm = history.length ? Math.max(...history.map((h) => h.e1rm)) : 0;
  const lastE1rm = history.at(-1)?.e1rm ?? 0;

  if (!exercise) return <div className="text-subtle">Loading…</div>;

  return (
    <div className="space-y-4">
      <header>
        <div className="text-xs uppercase text-subtle">
          {exercise.muscleGroup.replace("_", " ")} · {exercise.equipment} · {exercise.movementPattern}
        </div>
        <h1 className="text-2xl font-bold">{exercise.name}</h1>
        {exercise.notes && <p className="text-sm text-subtle mt-1">{exercise.notes}</p>}
      </header>

      <Card>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Best e1RM" value={`${bestE1rm} kg`} />
          <Stat label="Last e1RM" value={`${lastE1rm} kg`} />
          <Stat label="Sessions" value={history.length} />
        </div>
      </Card>

      <section>
        <CardHeader title="Estimated 1RM over time" />
        <Card>
          {history.length === 0 ? (
            <EmptyState title="No history yet" description="Log this exercise in a workout to see progress." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <XAxis dataKey="date" fontSize={11} tickMargin={6} />
                  <YAxis fontSize={11} width={40} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="e1rm" stroke="rgb(14 165 233)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </section>

      <section>
        <CardHeader title="Recent sessions" />
        {history.length === 0 ? null : (
          <ul className="space-y-1">
            {history.slice(-5).reverse().map((h) => (
              <li key={h.date} className="flex items-center justify-between rounded-lg border border-border bg-surface p-2 text-sm">
                <span>{h.date}</span>
                <span className="text-subtle">{h.topWeight} kg × {h.topReps}</span>
                <span className="font-medium">{h.e1rm} kg e1RM</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-between">
        <Link href="/exercises"><Button variant="ghost">← Back</Button></Link>
      </div>
    </div>
  );
}
