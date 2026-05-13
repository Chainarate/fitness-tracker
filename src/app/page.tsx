"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db } from "@/db";
import { Card, CardHeader, EmptyState, Stat } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { todayLocal, weekRange, prettyDate, fromDateString, toDateString } from "@/lib/date";
import { computeVolume, formatDuration } from "@/lib/utils";
import { Play, Plus, RotateCcw } from "lucide-react";
import { HomeBodyMetric } from "@/components/HomeBodyMetric";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { DailyNoteCard } from "@/components/DailyNoteCard";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { findRepeatableLastWorkout, cloneSessionToDate } from "@/db/queries";
import type { WorkoutSession } from "@/db/schema";

export default function TodayPage() {
  const today = todayLocal();
  const settings = useLiveQuery(() => db.settings.get("singleton"), []);
  const weekStartsOn = settings?.weekStartsOn ?? 1;
  const { start, end } = useMemo(
    () => weekRange(fromDateString(today), weekStartsOn),
    [today, weekStartsOn],
  );

  // toDateString uses local-time formatting, avoiding UTC shift bugs.
  const startStr = toDateString(start);
  const endStr = toDateString(end);

  const weekSessions = useLiveQuery(
    () =>
      db.workoutSessions
        .where("date")
        .between(startStr, endStr, true, true)
        .filter((s) => !s.deletedAt)
        .toArray(),
    [startStr, endStr],
  );

  const todaySessions = useLiveQuery(
    () =>
      db.workoutSessions
        .where("date")
        .equals(today)
        .filter((s) => !s.deletedAt)
        .toArray(),
    [today],
  );

  const planned = weekSessions?.filter((s) => s.status === "planned").length ?? 0;
  const done = weekSessions?.filter((s) => s.status === "done" || s.status === "modified").length ?? 0;
  const totalPlannedOrDone = planned + done;
  const adherence = totalPlannedOrDone ? Math.round((done / totalPlannedOrDone) * 100) : 0;

  const weekVolume = useMemo(() => {
    if (!weekSessions) return 0;
    return weekSessions
      .filter((s) => s.kind === "strength" && (s.status === "done" || s.status === "modified"))
      .reduce((sum, s) => sum + computeVolume(s.sets ?? []), 0);
  }, [weekSessions]);

  const weekCardioSec = useMemo(() => {
    if (!weekSessions) return 0;
    return weekSessions
      .filter((s) => s.kind === "cardio" && s.status === "done")
      .reduce((sum, s) => sum + (s.cardio?.durationSec ?? 0), 0);
  }, [weekSessions]);

  return (
    <div className="space-y-6">
      <header>
        <div className="text-sm text-subtle">{prettyDate(today)}</div>
        <h1 className="text-2xl font-bold">Today</h1>
      </header>

      <section>
        <CardHeader title="Today's sessions" />
        {todaySessions && todaySessions.length > 0 ? (
          <div className="space-y-2">
            {todaySessions.map((s) => (
              <Card key={s.id} className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-subtle">{s.kind}</div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-subtle capitalize">{s.status.replace("_", " ")}</div>
                </div>
                {s.status === "planned" || s.status === "in_progress" ? (
                  <Link href={`/workout/${s.id}`}>
                    <Button>
                      <Play size={16} />
                      {s.status === "in_progress" ? "Resume" : "Start"}
                    </Button>
                  </Link>
                ) : (
                  <Link href={`/workout/${s.id}`}>
                    <Button variant="secondary">View</Button>
                  </Link>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <NothingPlannedToday today={today} />
        )}
      </section>

      <section>
        <CardHeader title="This week" />
        <Card>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Adherence" value={`${adherence}%`} hint={`${done}/${totalPlannedOrDone}`} />
            <Stat label="Volume" value={`${Math.round(weekVolume).toLocaleString()} kg`} hint="strength" />
            <Stat label="Cardio" value={formatDuration(weekCardioSec)} hint="total time" />
          </div>
        </Card>
      </section>

      <DailyNoteCard />

      <ActivityHeatmap />

      <HomeBodyMetric />
    </div>
  );
}

/**
 * Empty-state for the "Today's sessions" card. Adds a "Repeat from last week"
 * action if a session from the same weekday exists in the last 4 weeks.
 */
function NothingPlannedToday({ today }: { today: string }) {
  const router = useRouter();
  const [candidate, setCandidate] = useState<WorkoutSession | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void findRepeatableLastWorkout(today).then(setCandidate);
  }, [today]);

  const onRepeat = async () => {
    if (!candidate) return;
    setBusy(true);
    try {
      const id = await cloneSessionToDate(candidate.id, today);
      if (id) router.push(`/workout/${id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <EmptyState
      title="Nothing planned today"
      description={
        candidate
          ? `You did "${candidate.name}" on the same weekday ${candidate.date}. Want to repeat it?`
          : "Schedule a workout or quick-log a cardio session."
      }
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {candidate && (
            <Button onClick={onRepeat} disabled={busy}>
              <RotateCcw size={16} /> Repeat &ldquo;{candidate.name}&rdquo;
            </Button>
          )}
          <Link href="/calendar">
            <Button variant="secondary">
              <Plus size={16} /> Plan workout
            </Button>
          </Link>
          <Link href="/cardio/new">
            <Button variant="secondary">
              <Plus size={16} /> Log cardio
            </Button>
          </Link>
        </div>
      }
    />
  );
}
