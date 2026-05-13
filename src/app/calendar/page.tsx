"use client";

import { useMemo, useState, type DragEvent } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  addDays,
  addMonths,
  format,
  isSameMonth,
  isSameDay,
  startOfMonth,
} from "date-fns";
import { db } from "@/db";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { monthGrid, weekRange, prettyMonth, toDateString } from "@/lib/date";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, Move, Check, X } from "lucide-react";
import { ScheduleDialog } from "@/components/ScheduleDialog";
import { MoveSessionDialog } from "@/components/MoveSessionDialog";
import { moveSession, finishSession, skipSession } from "@/db/queries";
import type { WorkoutSession } from "@/db/schema";

type View = "month" | "week";

const DRAG_MIME = "application/x-fitness-session-id";

export default function CalendarPage() {
  const settings = useLiveQuery(() => db.settings.get("singleton"), []);
  const weekStartsOn = settings?.weekStartsOn ?? 1;

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<View>("month");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Drag-and-drop state (desktop only — touch falls through to the Move dialog).
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Mobile fallback: move dialog.
  const [moveTarget, setMoveTarget] = useState<WorkoutSession | null>(null);

  const days = useMemo(() => {
    if (view === "month") return monthGrid(cursor, weekStartsOn);
    return weekRange(cursor, weekStartsOn).days;
  }, [cursor, view, weekStartsOn]);

  const rangeStart = toDateString(days[0]);
  const rangeEnd = toDateString(days[days.length - 1]);

  const sessions = useLiveQuery(
    () =>
      db.workoutSessions
        .where("date")
        .between(rangeStart, rangeEnd, true, true)
        .filter((s) => !s.deletedAt)
        .toArray(),
    [rangeStart, rangeEnd],
  );

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    (sessions ?? []).forEach((s) => {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    });
    return map;
  }, [sessions]);

  const weekdayLabels = useMemo(() => {
    return weekStartsOn === 1
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  }, [weekStartsOn]);

  const onPrev = () =>
    setCursor((c) => (view === "month" ? addMonths(c, -1) : addDays(c, -7)));
  const onNext = () =>
    setCursor((c) => (view === "month" ? addMonths(c, 1) : addDays(c, 7)));

  // Drag handlers — used by the day cells (drop targets).
  const onDragOverDay = (e: DragEvent<HTMLButtonElement>, ds: string) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDate !== ds) setDragOverDate(ds);
  };
  const onDragLeaveDay = (ds: string) => {
    if (dragOverDate === ds) setDragOverDate(null);
  };
  const onDropDay = async (e: DragEvent<HTMLButtonElement>, ds: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_MIME) || draggingId;
    setDraggingId(null);
    setDragOverDate(null);
    if (!id) return;
    try {
      await moveSession(id, ds);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{prettyMonth(cursor)}</h1>
        <div className="flex items-center gap-2">
          <Select value={view} onChange={(e) => setView(e.target.value as View)} className="w-28">
            <option value="month">Month</option>
            <option value="week">Week</option>
          </Select>
          <Button variant="secondary" size="sm" onClick={onPrev} aria-label="Previous">
            <ChevronLeft size={16} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
          <Button variant="secondary" size="sm" onClick={onNext} aria-label="Next">
            <ChevronRight size={16} />
          </Button>
        </div>
      </header>

      <Card className="p-2 md:p-4">
        <div className="grid grid-cols-7 gap-1 mb-1 text-xs text-subtle">
          {weekdayLabels.map((d) => (
            <div key={d} className="px-2 py-1 font-medium">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const ds = toDateString(d);
            const dayItems = sessionsByDate.get(ds) ?? [];
            const inMonth = view === "week" || isSameMonth(d, cursor);
            const isSelected = selectedDate === ds;
            const isToday = isSameDay(d, new Date());
            const isDropTarget = dragOverDate === ds;
            return (
              <button
                key={ds}
                type="button"
                onClick={() => setSelectedDate(ds)}
                onDragOver={(e) => onDragOverDay(e, ds)}
                onDragLeave={() => onDragLeaveDay(ds)}
                onDrop={(e) => onDropDay(e, ds)}
                className={cn(
                  "min-h-[68px] rounded-lg border p-1 text-left transition-colors",
                  inMonth ? "bg-surface" : "bg-muted/30",
                  isSelected ? "border-primary" : "border-border",
                  isDropTarget && "ring-2 ring-primary border-primary bg-primary/5",
                )}
              >
                <div className={cn("text-xs font-medium", inMonth ? "text-fg" : "text-subtle", isToday && "text-primary")}>
                  {format(d, "d")}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {dayItems.slice(0, 3).map((s) => (
                    <span
                      key={s.id}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        s.status === "done" || s.status === "modified" ? "bg-success" :
                        s.status === "planned" ? "bg-primary" :
                        s.status === "skipped" ? "bg-danger" : "bg-warning",
                      )}
                    />
                  ))}
                  {dayItems.length > 3 && <span className="text-[10px] text-subtle">+{dayItems.length - 3}</span>}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-2 hidden md:block text-[11px] text-subtle">
          Tip: drag a session pill onto another day to reschedule it.
        </p>
      </Card>

      {selectedDate && (
        <DayDetail
          date={selectedDate}
          sessions={sessionsByDate.get(selectedDate) ?? []}
          onAdd={() => setScheduleOpen(true)}
          onMove={(s) => setMoveTarget(s)}
          onDragStart={(id, e) => {
            setDraggingId(id);
            e.dataTransfer.setData(DRAG_MIME, id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            setDraggingId(null);
            setDragOverDate(null);
          }}
        />
      )}

      <ScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        date={selectedDate ?? toDateString(new Date())}
      />

      <MoveSessionDialog
        open={moveTarget != null}
        onClose={() => setMoveTarget(null)}
        sessionId={moveTarget?.id ?? null}
        currentDate={moveTarget?.date ?? ""}
        sessionName={moveTarget?.name ?? ""}
      />
    </div>
  );
}

function DayDetail({
  date,
  sessions,
  onAdd,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  date: string;
  sessions: WorkoutSession[];
  onAdd: () => void;
  onMove: (s: WorkoutSession) => void;
  onDragStart: (id: string, e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium">{format(new Date(date), "EEEE, MMM d")}</div>
        <Button size="sm" onClick={onAdd}><Plus size={14} /> Add</Button>
      </div>
      {sessions.length === 0 ? (
        <div className="text-sm text-subtle">No sessions yet.</div>
      ) : (
        <ul className="space-y-1">
          {sessions.map((s) => {
            const movable = s.status !== "done" && s.status !== "modified";
            const isPlanned = s.status === "planned";
            const onMarkDone = async () => {
              if (!confirm("Mark as done?")) return;
              await finishSession(s.id, false);
            };
            const onMarkSkip = async () => {
              if (!confirm("Mark as skipped?")) return;
              await skipSession(s.id);
            };
            return (
              <li key={s.id}>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border border-border bg-surface p-2",
                    movable && "hover:bg-muted cursor-grab active:cursor-grabbing",
                  )}
                  draggable={movable}
                  onDragStart={(e) => movable && onDragStart(s.id, e)}
                  onDragEnd={onDragEnd}
                >
                  <Link href={`/workout/${s.id}`} className="flex-1 min-w-0">
                    <div className="text-xs uppercase text-subtle">{s.kind}</div>
                    <div className="text-sm font-medium truncate">{s.name}</div>
                  </Link>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full capitalize",
                    s.status === "done" || s.status === "modified" ? "bg-success/15 text-success" :
                    s.status === "planned" ? "bg-primary/15 text-primary" :
                    s.status === "skipped" ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning",
                  )}>
                    {s.status.replace("_", " ")}
                  </span>
                  {isPlanned && (
                    <>
                      <Button size="sm" variant="ghost" onClick={onMarkDone} aria-label="Mark done" title="Mark done">
                        <Check size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={onMarkSkip} aria-label="Skip" title="Skip">
                        <X size={14} />
                      </Button>
                    </>
                  )}
                  {movable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onMove(s)}
                      aria-label="Move to another date"
                      title="Move to another date"
                    >
                      <Move size={14} />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
