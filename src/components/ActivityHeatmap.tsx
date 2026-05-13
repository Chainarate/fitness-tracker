"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { buildHeatmap, weeklyStreak } from "@/lib/streak";
import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";

const INTENSITY = [
  "bg-muted",
  "bg-success/30",
  "bg-success/55",
  "bg-success/80",
  "bg-success",
];

function intensity(count: number, inFuture: boolean): string {
  if (inFuture) return "bg-transparent border border-dashed border-border";
  if (count === 0) return INTENSITY[0];
  if (count === 1) return INTENSITY[1];
  if (count === 2) return INTENSITY[2];
  if (count === 3) return INTENSITY[3];
  return INTENSITY[4];
}

export function ActivityHeatmap({ weeks = 12 }: { weeks?: number }) {
  const settings = useLiveQuery(() => db.settings.get("singleton"), []);
  const sessions = useLiveQuery(
    () => db.workoutSessions.where("status").anyOf(["done", "modified"]).toArray(),
    [],
  );

  const weekStartsOn = settings?.weekStartsOn ?? 1;
  const target = settings?.weeklySessionTarget ?? 3;

  const grid = useMemo(
    () => buildHeatmap(sessions ?? [], weekStartsOn, weeks),
    [sessions, weekStartsOn, weeks],
  );
  const streak = useMemo(
    () => weeklyStreak(sessions ?? [], target, weekStartsOn),
    [sessions, target, weekStartsOn],
  );

  const totalCompleted = useMemo(
    () => grid.flat().reduce((sum, c) => sum + c.count, 0),
    [grid],
  );

  return (
    <section>
      <CardHeader title="Activity" />
      <Card>
        <div className="mb-3 flex flex-wrap items-baseline gap-4">
          <div className="flex items-center gap-1.5">
            <Flame
              size={18}
              className={streak.current > 0 ? "text-warning" : "text-subtle"}
            />
            <span className="text-xl font-semibold">
              {streak.current}
            </span>
            <span className="text-xs text-subtle">
              week{streak.current === 1 ? "" : "s"} streak
            </span>
          </div>
          <div className="text-xs text-subtle">
            This week: <span className="font-medium text-fg">{streak.thisWeekCount}</span> / {streak.thisWeekTarget}
          </div>
          <div className="text-xs text-subtle ml-auto">
            {totalCompleted} sessions in last {weeks} weeks
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="flex gap-[3px]">
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((cell) => (
                  <div
                    key={cell.date}
                    title={`${cell.date}: ${cell.count} session${cell.count === 1 ? "" : "s"}`}
                    className={cn("h-3.5 w-3.5 rounded-sm", intensity(cell.count, cell.inFuture))}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-subtle">
          <span>less</span>
          {INTENSITY.map((cls, i) => (
            <span key={i} className={cn("h-3 w-3 rounded-sm", cls)} />
          ))}
          <span>more</span>
        </div>
      </Card>
    </section>
  );
}
