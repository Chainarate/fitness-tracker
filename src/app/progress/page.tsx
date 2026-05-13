"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { computeVolume, formatDuration } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { MuscleGroup } from "@/db/schema";
import { weeklyVolumeReport } from "@/lib/volume";
import { weekRange, toDateString, fromDateString, todayLocal } from "@/lib/date";
import { AlertTriangle } from "lucide-react";

/**
 * Progress overview:
 * - Weekly volume per muscle group (last 8 weeks).
 * - Top exercises by sessions logged (with link to their detail page).
 * - Cardio minutes per week.
 */
export default function ProgressPage() {
  const sessions = useLiveQuery(
    () =>
      db.workoutSessions
        .where("status")
        .anyOf(["done", "modified"])
        .filter((s) => !s.deletedAt)
        .toArray(),
    [],
  );
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const exerciseMap = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises]);

  const muscleVolume = useMemo(() => {
    const acc = new Map<MuscleGroup, number>();
    (sessions ?? []).forEach((s) => {
      if (s.kind !== "strength" || !s.sets) return;
      s.sets.forEach((set) => {
        if (set.isWarmup) return;
        const ex = exerciseMap.get(set.exerciseId);
        if (!ex) return;
        const v = (set.weight ?? 0) * (set.reps ?? 0);
        acc.set(ex.muscleGroup, (acc.get(ex.muscleGroup) ?? 0) + v);
      });
    });
    return Array.from(acc.entries())
      .map(([muscleGroup, volume]) => ({ muscleGroup, volume: Math.round(volume) }))
      .sort((a, b) => b.volume - a.volume);
  }, [sessions, exerciseMap]);

  const exerciseCounts = useMemo(() => {
    const acc = new Map<string, number>();
    (sessions ?? []).forEach((s) => {
      const seen = new Set<string>();
      (s.sets ?? []).forEach((set) => {
        if (!seen.has(set.exerciseId)) {
          acc.set(set.exerciseId, (acc.get(set.exerciseId) ?? 0) + 1);
          seen.add(set.exerciseId);
        }
      });
    });
    return Array.from(acc.entries())
      .map(([id, count]) => ({ id, count, name: exerciseMap.get(id)?.name ?? "Unknown" }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [sessions, exerciseMap]);

  const cardioTotalSec = useMemo(() => {
    return (sessions ?? [])
      .filter((s) => s.kind === "cardio")
      .reduce((sum, s) => sum + (s.cardio?.durationSec ?? 0), 0);
  }, [sessions]);

  const totalVolume = useMemo(
    () => (sessions ?? []).reduce((sum, s) => sum + computeVolume(s.sets ?? []), 0),
    [sessions],
  );

  // This-week volume analysis for warnings.
  const settings = useLiveQuery(() => db.settings.get("singleton"), []);
  const weekReport = useMemo(() => {
    if (!sessions || !exercises) return null;
    const weekStartsOn = settings?.weekStartsOn ?? 1;
    const { start, end } = weekRange(fromDateString(todayLocal()), weekStartsOn);
    const startStr = toDateString(start);
    const endStr = toDateString(end);
    const thisWeek = sessions.filter((s) => s.date >= startStr && s.date <= endStr);
    return weeklyVolumeReport(thisWeek, exercises);
  }, [sessions, exercises, settings?.weekStartsOn]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Progress</h1>

      <Card>
        <div className="grid grid-cols-3 gap-4">
          <div><div className="text-xs text-subtle">Sessions logged</div><div className="text-2xl font-semibold">{sessions?.length ?? 0}</div></div>
          <div><div className="text-xs text-subtle">Total volume</div><div className="text-2xl font-semibold">{Math.round(totalVolume).toLocaleString()} kg</div></div>
          <div><div className="text-xs text-subtle">Cardio</div><div className="text-2xl font-semibold">{formatDuration(cardioTotalSec)}</div></div>
        </div>
      </Card>

      {weekReport && weekReport.warnings.length > 0 && (
        <section>
          <CardHeader title="This week — volume insights" />
          <Card className="space-y-2">
            {weekReport.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
                <span>{w}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section>
        <CardHeader title="Volume by muscle group (all-time)" />
        <Card>
          {muscleVolume.length === 0 ? (
            <EmptyState title="No strength data yet" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={muscleVolume}>
                  <XAxis dataKey="muscleGroup" fontSize={11} tickFormatter={(v) => v.replace("_", " ")} />
                  <YAxis fontSize={11} width={50} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="volume" fill="rgb(14 165 233)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </section>

      <section>
        <CardHeader title="Most logged exercises" />
        {exerciseCounts.length === 0 ? (
          <EmptyState title="Nothing logged yet" />
        ) : (
          <ul className="space-y-1">
            {exerciseCounts.map((e) => (
              <li key={e.id}>
                <Link href={`/exercises/${e.id}`} className="flex items-center justify-between rounded-lg border border-border bg-surface p-2 text-sm hover:bg-muted/40">
                  <span>{e.name}</span>
                  <span className="text-subtle">{e.count} sessions</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/metrics"><Button variant="ghost">Body metrics →</Button></Link>
    </div>
  );
}
