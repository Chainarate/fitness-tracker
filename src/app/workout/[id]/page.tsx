"use client";

import { use, useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import {
  startSession,
  finishSession,
  skipSession,
  appendSet,
  updateSet,
  deleteSet,
  deleteSession,
  previousPerformance,
  addPlannedExercise,
  removePlannedExercise,
} from "@/db/queries";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Play, Check, X, Trash2, Plus, Flame, Trophy, MessageSquare, TrendingUp, Pencil } from "lucide-react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { cn, computeVolume, formatDuration } from "@/lib/utils";
import { unlockAudio } from "@/lib/audio";
import { PlateCalculator } from "@/components/PlateCalculator";
import { RestTimer } from "@/components/RestTimer";
import { loadPRBenchmarks, classifyPR, type PRBenchmarks, type PRKind } from "@/lib/pr";
import { suggestNextWeight, type Suggestion } from "@/lib/progression";
import type { LoggedSet, TemplateExercise, WorkoutSession } from "@/db/schema";

/**
 * Workout execution screen.
 * Adds (vs the earlier MVP):
 *   - Rest timer (auto-starts after a set is logged with restSec defined)
 *   - Plate calculator for barbell exercises
 *   - PR detection per set (vs all previous done sessions)
 *   - Warm-up toggle (excluded from volume)
 */
export default function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const session = useLiveQuery(() => db.workoutSessions.get(id), [id]);

  // Rest timer is owned at the page level so it survives between exercise
  // cards. `null` means inactive.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);

  // "Edit mode" — when the session is already done/modified, the user can
  // toggle this on to re-enable editing of sets, planned exercises, etc.
  // Useful for fixing up reality vs. plan after the fact.
  const [editMode, setEditMode] = useState(false);

  const startRest = useCallback((sec: number) => {
    if (!sec || sec <= 0) return;
    setRestEndsAt(Date.now() + sec * 1000);
  }, []);

  if (!session) return <div className="text-subtle">Loading…</div>;
  // Session was deleted (locally or on another device). Bounce out so the user
  // doesn't operate on a row that's about to disappear from listings anyway.
  if (session.deletedAt) {
    router.replace("/calendar");
    return <div className="text-subtle">Deleted — redirecting…</div>;
  }

  const isStrength = session.kind === "strength";
  const inProgress = session.status === "in_progress";
  const finished = session.status === "done" || session.status === "modified";

  const onStart = () => {
    unlockAudio(); // unlock Web Audio in iOS
    return startSession(id);
  };
  const onSkip = async () => {
    if (!confirm("Mark this session as skipped?")) return;
    await skipSession(id);
  };
  const onFinish = async (modified: boolean) => {
    await finishSession(id, modified);
    setRestEndsAt(null);
  };
  const onDelete = async () => {
    if (!confirm("Delete this session?")) return;
    await deleteSession(id);
    router.push("/calendar");
  };

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-subtle">{session.kind} · {session.date}</div>
          <h1 className="text-2xl font-bold">{session.name}</h1>
          <div className="text-xs text-subtle capitalize mt-1 flex items-center gap-2">
            <span>{session.status.replace("_", " ")}</span>
            {inProgress && session.startedAt && (
              <ElapsedBadge startedAt={session.startedAt} />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {session.status === "planned" && (
            <>
              <Button onClick={onStart}><Play size={14} /> Start</Button>
              <Button
                variant="secondary"
                onClick={() => onFinish(false)}
                title="Mark as done without entering execution mode"
              >
                <Check size={14} /> Mark done
              </Button>
            </>
          )}
          {inProgress && (
            <>
              <Button onClick={() => onFinish(false)}><Check size={14} /> Finish</Button>
              <Button variant="secondary" onClick={() => onFinish(true)}>Finish (modified)</Button>
            </>
          )}
          {finished && !editMode && (
            <Button variant="secondary" onClick={() => setEditMode(true)}>
              <Pencil size={14} /> Edit
            </Button>
          )}
          {finished && editMode && (
            <Button onClick={() => setEditMode(false)}>
              <Check size={14} /> Done editing
            </Button>
          )}
          {!finished && (
            <Button variant="ghost" onClick={onSkip}><X size={14} /> Skip</Button>
          )}
        </div>
      </header>

      {isStrength ? (
        <StrengthBody
          session={session}
          canEdit={inProgress || session.status === "planned" || editMode}
          onSetLogged={startRest}
        />
      ) : (
        <CardioSummary session={session} />
      )}

      {finished && <SessionSummary session={session} />}

      <div className="pt-4">
        <Button variant="ghost" onClick={onDelete}><Trash2 size={14} /> Delete session</Button>
      </div>

      <RestTimer
        endsAt={restEndsAt}
        onSkip={() => setRestEndsAt(null)}
        onAdd={(delta) =>
          setRestEndsAt((prev) => (prev ? Math.max(Date.now(), prev + delta * 1000) : prev))
        }
      />
    </div>
  );
}

function StrengthBody({
  session,
  canEdit,
  onSetLogged,
}: {
  session: WorkoutSession;
  canEdit: boolean;
  onSetLogged: (restSec: number) => void;
}) {
  const planned = session.plannedExercises ?? [];
  const [pickerOpen, setPickerOpen] = useState(false);

  const onRemove = async (idx: number) => {
    try {
      await removePlannedExercise(session.id, idx);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      {planned.length === 0 && (
        <Card>
          <div className="text-sm text-subtle">
            No exercises yet — tap &ldquo;Add exercise&rdquo; below to build this session on the fly.
          </div>
        </Card>
      )}

      {planned.map((p, idx) => (
        <ExerciseBlock
          key={`${p.exerciseId}-${idx}`}
          sessionId={session.id}
          plan={p}
          plannedIndex={idx}
          allSets={session.sets ?? []}
          canEdit={canEdit}
          onSetLogged={onSetLogged}
          onRemove={() => onRemove(idx)}
        />
      ))}

      {canEdit && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setPickerOpen(true)}
        >
          <Plus size={14} /> Add exercise
        </Button>
      )}

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(exerciseId) => addPlannedExercise(session.id, exerciseId)}
        excludeIds={planned.map((p) => p.exerciseId)}
      />
    </div>
  );
}

function ExerciseBlock({
  sessionId,
  plan,
  plannedIndex,
  allSets,
  canEdit,
  onSetLogged,
  onRemove,
}: {
  sessionId: string;
  plan: TemplateExercise;
  plannedIndex: number;
  allSets: LoggedSet[];
  canEdit: boolean;
  onSetLogged: (restSec: number) => void;
  onRemove: () => void;
}) {
  const exercise = useLiveQuery(() => db.exercises.get(plan.exerciseId), [plan.exerciseId]);
  const [prev, setPrev] = useState<{ date: string; sets: LoggedSet[] }[]>([]);
  const [pr, setPR] = useState<PRBenchmarks | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  // Load PR benchmarks (cached for this exercise, excluding current session).
  useEffect(() => {
    void loadPRBenchmarks(plan.exerciseId, sessionId).then(setPR);
  }, [plan.exerciseId, sessionId]);

  useEffect(() => {
    void (async () => {
      const items = await previousPerformance(plan.exerciseId, 1);
      setPrev(items.map((i) => ({ date: i.session.date, sets: i.sets })));
      const s = await suggestNextWeight(plan.exerciseId, sessionId);
      setSuggestion(s);
    })();
  }, [plan.exerciseId, sessionId]);

  const setsForThis = allSets.filter((s) => s.exerciseId === plan.exerciseId);
  const isBarbell = exercise?.equipment === "barbell";

  const addSet = async () => {
    const lastSet = setsForThis.at(-1) ?? prev[0]?.sets.at(-1);
    // First set in this session pre-fills from the auto-progression suggestion;
    // subsequent sets reuse what the lifter actually loaded.
    const startingWeight =
      lastSet?.weight ?? suggestion?.weight ?? plan.targetWeight;
    await appendSet(sessionId, {
      exerciseId: plan.exerciseId,
      setNumber: setsForThis.length + 1,
      weight: startingWeight,
      reps: lastSet?.reps ?? (Number.isFinite(+plan.targetReps) ? +plan.targetReps : undefined),
      completedAt: new Date().toISOString(),
    });
    if (plan.restSec) onSetLogged(plan.restSec);
  };

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium">{exercise?.name ?? "…"}</div>
          <div className="text-xs text-subtle">
            Target: {plan.targetSets} × {plan.targetReps}
            {plan.targetRPE ? ` · RPE ${plan.targetRPE}` : ""}
            {plan.restSec ? ` · rest ${plan.restSec}s` : ""}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-1">
            {setsForThis.length === 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Remove ${exercise?.name ?? "this exercise"} from session?`)) onRemove();
                }}
                aria-label="Remove exercise"
                title="Remove from session"
              >
                <X size={14} />
              </Button>
            )}
            <Button size="sm" onClick={addSet}><Plus size={14} /> Set</Button>
          </div>
        )}
      </div>

      {prev.length > 0 && (
        <div className="mt-2 text-xs text-subtle">
          Last ({prev[0].date}):{" "}
          {prev[0].sets.map((s, i) => (
            <span key={s.id}>
              {i > 0 ? ", " : ""}{s.weight ?? "–"}×{s.reps ?? "–"}
            </span>
          ))}
        </div>
      )}

      {suggestion && setsForThis.length === 0 && (
        <div
          className={cn(
            "mt-2 flex items-start gap-1.5 text-xs",
            suggestion.verdict === "deload" ? "text-warning" :
            suggestion.verdict === "hit" ? "text-success" : "text-subtle",
          )}
        >
          <TrendingUp size={12} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-medium">{suggestion.weight} kg</span> suggested — {suggestion.reason}
          </span>
        </div>
      )}

      {isBarbell && (
        <div className="mt-2">
          <PlateCalculator defaultTargetKg={setsForThis.at(-1)?.weight ?? plan.targetWeight} />
        </div>
      )}

      {setsForThis.length > 0 && (
        <ul className="mt-3 space-y-1">
          {setsForThis.map((s) => (
            <SetRow key={s.id} sessionId={sessionId} set={s} canEdit={canEdit} pr={pr} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function SetRow({
  sessionId,
  set,
  canEdit,
  pr,
}: {
  sessionId: string;
  set: LoggedSet;
  canEdit: boolean;
  pr: PRBenchmarks | null;
}) {
  const badge: PRKind = pr ? classifyPR(set, pr) : null;
  const [notesOpen, setNotesOpen] = useState(!!set.notes);

  return (
    <li
      className={cn(
        "grid grid-cols-[28px_1fr_1fr_60px_28px_28px_28px] items-center gap-2 text-sm",
        set.isWarmup && "opacity-60",
      )}
    >
      <span className="text-xs text-subtle">
        {set.isWarmup ? <span className="text-warning">W</span> : `#${set.setNumber}`}
      </span>
      <Input
        type="number"
        inputMode="decimal"
        placeholder="kg"
        value={set.weight ?? ""}
        onChange={(e) =>
          updateSet(sessionId, set.id, { weight: e.target.value ? +e.target.value : undefined })
        }
        disabled={!canEdit}
        className="h-9"
      />
      <Input
        type="number"
        inputMode="numeric"
        placeholder="reps"
        value={set.reps ?? ""}
        onChange={(e) =>
          updateSet(sessionId, set.id, { reps: e.target.value ? +e.target.value : undefined })
        }
        disabled={!canEdit}
        className="h-9"
      />
      <Input
        type="number"
        inputMode="decimal"
        step="0.5"
        placeholder="RPE"
        value={set.rpe ?? ""}
        onChange={(e) =>
          updateSet(sessionId, set.id, { rpe: e.target.value ? +e.target.value : undefined })
        }
        disabled={!canEdit}
        className="h-9"
      />
      {/* Warm-up toggle */}
      <button
        type="button"
        onClick={() => updateSet(sessionId, set.id, { isWarmup: !set.isWarmup })}
        disabled={!canEdit}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg border text-xs",
          set.isWarmup ? "border-warning text-warning bg-warning/10" : "border-border text-subtle",
        )}
        aria-label={set.isWarmup ? "Unmark warm-up" : "Mark as warm-up"}
        title={set.isWarmup ? "Warm-up — tap to unmark" : "Mark as warm-up"}
      >
        <Flame size={14} />
      </button>
      {/* Notes toggle */}
      <button
        type="button"
        onClick={() => setNotesOpen((v) => !v)}
        disabled={!canEdit && !set.notes}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg border text-xs",
          (notesOpen || set.notes) ? "border-primary text-primary bg-primary/10" : "border-border text-subtle",
        )}
        aria-label="Toggle notes"
        title={set.notes || "Add a note"}
      >
        <MessageSquare size={14} />
      </button>
      {canEdit ? (
        <Button size="sm" variant="ghost" onClick={() => deleteSet(sessionId, set.id)} aria-label="Remove set">
          <Trash2 size={14} />
        </Button>
      ) : (
        <span />
      )}

      {badge && (
        <span
          className="col-span-7 -mt-1 inline-flex items-center gap-1 text-xs font-semibold text-success"
          aria-label="Personal record"
        >
          <Trophy size={12} />
          {badge === "weight" ? "Weight PR" : "Estimated 1RM PR"}
        </span>
      )}

      {notesOpen && (
        <Input
          className="col-span-7 h-8 text-xs"
          placeholder="Form felt off, left elbow tight, …"
          value={set.notes ?? ""}
          onChange={(e) =>
            updateSet(sessionId, set.id, { notes: e.target.value || undefined })
          }
          disabled={!canEdit}
        />
      )}
    </li>
  );
}

/**
 * Live-ticking elapsed time badge shown in the header while a session is
 * in_progress. Uses a 1s setInterval since we're tracking minute-level
 * accuracy, not millisecond — keeps re-renders cheap.
 */
function ElapsedBadge({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-primary font-medium tabular-nums">
      ⏱ {formatDuration(elapsed)}
    </span>
  );
}

function CardioSummary({ session }: { session: WorkoutSession }) {
  const c = session.cardio;
  if (!c) return null;
  return (
    <Card>
      <CardHeader title="Cardio" />
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-subtle text-xs">Type</dt><dd>{c.type.replace("_", " ")}</dd></div>
        <div><dt className="text-subtle text-xs">Duration</dt><dd>{formatDuration(c.durationSec)}</dd></div>
        {c.distanceKm != null && <div><dt className="text-subtle text-xs">Distance</dt><dd>{c.distanceKm} km</dd></div>}
        {c.avgHr != null && <div><dt className="text-subtle text-xs">Avg HR</dt><dd>{c.avgHr} bpm</dd></div>}
        {c.hrZone && <div><dt className="text-subtle text-xs">Zone</dt><dd>Z{c.hrZone}</dd></div>}
        {c.calories != null && <div><dt className="text-subtle text-xs">Calories</dt><dd>{c.calories}</dd></div>}
        {c.perceivedEffort != null && <div><dt className="text-subtle text-xs">RPE</dt><dd>{c.perceivedEffort}</dd></div>}
      </dl>
    </Card>
  );
}

function SessionSummary({ session }: { session: WorkoutSession }) {
  const volume = useMemo(() => computeVolume(session.sets ?? []), [session.sets]);
  return (
    <Card>
      <CardHeader title="Summary" />
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div><div className="text-xs text-subtle">Duration</div><div className="font-medium">{formatDuration(session.durationSec ?? 0)}</div></div>
        <div><div className="text-xs text-subtle">Sets</div><div className="font-medium">{session.sets?.length ?? 0}</div></div>
        <div><div className="text-xs text-subtle">Volume</div><div className="font-medium">{Math.round(volume).toLocaleString()} kg</div></div>
      </div>
    </Card>
  );
}
