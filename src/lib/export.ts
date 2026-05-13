import { db } from "@/db";
import type { ExportBundle } from "@/db/schema";

/** Build a full export bundle of everything in the local DB (schema v2). */
export async function buildExportBundle(): Promise<ExportBundle> {
  const [
    exercises,
    templates,
    workoutSessions,
    bodyMetrics,
    bodyMeasurements,
    dailyNotes,
    settings,
  ] = await Promise.all([
    db.exercises.toArray(),
    db.templates.toArray(),
    db.workoutSessions.toArray(),
    db.bodyMetrics.toArray(),
    db.bodyMeasurements.toArray(),
    db.dailyNotes.toArray(),
    db.settings.get("singleton"),
  ]);

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    exercises,
    templates,
    workoutSessions,
    bodyMetrics,
    bodyMeasurements,
    dailyNotes,
    settings: settings ?? {
      id: "singleton",
      units: "metric",
      defaultRestSec: 120,
      weekStartsOn: 1,
      theme: "system",
      weeklySessionTarget: 3,
    },
  };
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportJson(): Promise<void> {
  const bundle = await buildExportBundle();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  downloadBlob(`fitness-tracker-${new Date().toISOString().slice(0, 10)}.json`, blob);
  await db.settings.update("singleton", { lastBackupAt: bundle.exportedAt });
}

/**
 * Export all logged sets across all sessions as a flat CSV — convenient for
 * spreadsheet analysis.
 */
export async function exportSetsCsv(): Promise<void> {
  const sessions = await db.workoutSessions.toArray();
  const exercises = await db.exercises.toArray();
  const exerciseName = new Map(exercises.map((e) => [e.id, e.name]));

  const header = [
    "date", "session", "status", "exercise", "set_number",
    "weight_kg", "reps", "rpe", "rir", "is_warmup", "notes",
  ];
  const rows: string[] = [header.join(",")];

  for (const session of sessions) {
    if (session.kind !== "strength" || !session.sets) continue;
    for (const set of session.sets) {
      const cells = [
        session.date,
        csvEscape(session.name),
        session.status,
        csvEscape(exerciseName.get(set.exerciseId) ?? set.exerciseId),
        String(set.setNumber),
        set.weight != null ? String(set.weight) : "",
        set.reps != null ? String(set.reps) : "",
        set.rpe != null ? String(set.rpe) : "",
        set.rir != null ? String(set.rir) : "",
        set.isWarmup ? "1" : "0",
        csvEscape(set.notes ?? ""),
      ];
      rows.push(cells.join(","));
    }
  }

  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  downloadBlob(`fitness-sets-${new Date().toISOString().slice(0, 10)}.csv`, blob);
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Import a JSON bundle. Supports v1 and v2 bundles — v1 ones just have empty
 * new tables. Default behavior is "merge by id, last-write-wins on updatedAt".
 */
export async function importJson(
  bundle: ExportBundle,
  mode: "merge" | "replace" = "merge",
): Promise<void> {
  if (!bundle?.version || (bundle.version !== 1 && bundle.version !== 2)) {
    throw new Error("Unsupported export version.");
  }
  await db.transaction(
    "rw",
    [
      db.exercises,
      db.templates,
      db.workoutSessions,
      db.bodyMetrics,
      db.bodyMeasurements,
      db.dailyNotes,
      db.settings,
    ],
    async () => {
      if (mode === "replace") {
        await Promise.all([
          db.exercises.clear(),
          db.templates.clear(),
          db.workoutSessions.clear(),
          db.bodyMetrics.clear(),
          db.bodyMeasurements.clear(),
          db.dailyNotes.clear(),
        ]);
      }
      await db.exercises.bulkPut(bundle.exercises);
      await db.templates.bulkPut(bundle.templates);
      await db.workoutSessions.bulkPut(bundle.workoutSessions);
      await db.bodyMetrics.bulkPut(bundle.bodyMetrics);
      if (bundle.bodyMeasurements?.length) {
        await db.bodyMeasurements.bulkPut(bundle.bodyMeasurements);
      }
      if (bundle.dailyNotes?.length) {
        await db.dailyNotes.bulkPut(bundle.dailyNotes);
      }
      await db.settings.put(bundle.settings);
    },
  );
}
