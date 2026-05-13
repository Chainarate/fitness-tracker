/**
 * Sync engine: Dexie (local cache) ↔ Supabase (source of truth).
 *
 * Model:
 * - Every entity has `updatedAt`. The newer one wins on conflict.
 * - Deletes are tombstoned via `deletedAt` so they propagate to other devices.
 * - The local DB tracks the last successful sync time in `settings.lastSyncAt`
 *   (in memory only here — we don't persist sync state to settings to avoid
 *   noisy churn; instead we re-sync the full per-table updated_at window on
 *   each invocation, which is cheap because rows are small).
 *
 * Flow:
 *   syncAll():
 *     1. pull():  for each table, fetch rows where updated_at > localMaxUpdatedAt,
 *                 upsert into Dexie (last-write-wins).
 *     2. push():  for each table, find Dexie rows newer than cloud, upsert.
 *     3. settings is treated specially (one row per user).
 *
 * This isn't bulletproof at scale but is plenty for a personal app.
 * Realtime subscriptions can be added later without changing the contract.
 */

import { db } from "@/db";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Settings } from "@/db/schema";

// ─── Timestamp helpers ──────────────────────────────────────────────────────
// Don't compare ISO strings directly — Postgres serialises with `+00:00`
// while Date.toISOString() uses `Z`. Same instant, different bytes, so a
// naive string compare reports them as different and triggers infinite
// no-op re-pushes. Parse to epoch ms instead.

const tsMs = (s: string | undefined | null): number => (s ? Date.parse(s) || 0 : 0);
const isStrictlyNewer = (a: string | undefined, b: string | undefined): boolean =>
  tsMs(a) > tsMs(b);

// ─── Camel/Snake mapping ────────────────────────────────────────────────────
// Postgres convention is snake_case; our TS types are camelCase. Convert at
// the boundary so the rest of the app never sees snake_case.

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
function mapKeys<T extends object>(obj: T, fn: (k: string) => string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[fn(k)] = v;
  return out;
}
const fromRow = <T>(row: Record<string, unknown>): T => mapKeys(row, snakeToCamel) as T;
const toRow = (entity: object): Record<string, unknown> => mapKeys(entity, camelToSnake);

// ─── Table registry ─────────────────────────────────────────────────────────

interface TableSpec<T extends { id: string; updatedAt?: string }> {
  remote: string;
  table: import("dexie").Table<T, string>;
}

const TABLES: TableSpec<{ id: string; updatedAt?: string }>[] = [
  { remote: "exercises", table: db.exercises as unknown as TableSpec<{ id: string; updatedAt?: string }>["table"] },
  { remote: "templates", table: db.templates as unknown as TableSpec<{ id: string; updatedAt?: string }>["table"] },
  { remote: "workout_sessions", table: db.workoutSessions as unknown as TableSpec<{ id: string; updatedAt?: string }>["table"] },
  { remote: "body_metrics", table: db.bodyMetrics as unknown as TableSpec<{ id: string; updatedAt?: string }>["table"] },
  { remote: "body_measurements", table: db.bodyMeasurements as unknown as TableSpec<{ id: string; updatedAt?: string }>["table"] },
  { remote: "daily_notes", table: db.dailyNotes as unknown as TableSpec<{ id: string; updatedAt?: string }>["table"] },
];

// ─── Sync status (subscribed by UI for the indicator) ───────────────────────

export type SyncStatus =
  | { state: "idle" }
  | { state: "syncing" }
  | { state: "error"; message: string }
  | { state: "done"; at: number };

type Listener = (s: SyncStatus) => void;
const listeners = new Set<Listener>();
let current: SyncStatus = { state: "idle" };

export function onSyncStatus(fn: Listener): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}
function setStatus(s: SyncStatus) {
  current = s;
  listeners.forEach((fn) => fn(s));
}

// ─── Push / pull primitives ────────────────────────────────────────────────

async function localMaxUpdatedAt(table: TableSpec<{ id: string; updatedAt?: string }>["table"]): Promise<string> {
  const rows = await table.toArray();
  let maxMs = 0;
  let maxStr = "1970-01-01T00:00:00.000Z";
  for (const r of rows) {
    const u = (r as { updatedAt?: string }).updatedAt;
    const t = tsMs(u);
    if (t > maxMs) {
      maxMs = t;
      maxStr = u!;
    }
  }
  return maxStr;
}

async function pullTable(
  userId: string,
  remote: string,
  table: TableSpec<{ id: string; updatedAt?: string }>["table"],
): Promise<number> {
  const supabase = getSupabase();
  const since = await localMaxUpdatedAt(table);
  // PostgREST: filter rows updated since our local high-water mark.
  const { data, error } = await supabase
    .from(remote)
    .select("*")
    .eq("user_id", userId)
    .gt("updated_at", since);
  if (error) throw error;
  if (!data || data.length === 0) return 0;

  await db.transaction("rw", table, async () => {
    for (const row of data as Record<string, unknown>[]) {
      const local = fromRow<{ id: string; updatedAt?: string }>(row);
      // Drop the user_id field — the UI doesn't care about it.
      delete (local as { userId?: string }).userId;
      const existing = await table.get(local.id);
      // Use epoch-ms compare so timezone-suffix differences ("Z" vs "+00:00")
      // don't trigger spurious overwrites.
      if (!existing || isStrictlyNewer(local.updatedAt, existing.updatedAt)) {
        await table.put(local);
      }
    }
  });
  return data.length;
}

async function pushTable(
  userId: string,
  remote: string,
  table: TableSpec<{ id: string; updatedAt?: string }>["table"],
): Promise<number> {
  const supabase = getSupabase();
  // Fetch the cloud's high-water mark per row so we know which local rows are newer.
  const { data: cloudRows, error: fetchErr } = await supabase
    .from(remote)
    .select("id, updated_at")
    .eq("user_id", userId);
  if (fetchErr) throw fetchErr;
  const cloudMap = new Map<string, string>();
  (cloudRows ?? []).forEach((r) => {
    cloudMap.set((r as { id: string }).id, (r as { updated_at: string }).updated_at);
  });

  const localRows = await table.toArray();
  const toUpsert: Record<string, unknown>[] = [];
  for (const row of localRows) {
    const cloudUpdated = cloudMap.get(row.id);
    const localUpdated = (row as { updatedAt?: string }).updatedAt;
    // Strictly newer — equal timestamps (same instant in different string
    // formats) should NOT be re-pushed.
    if (!cloudUpdated || isStrictlyNewer(localUpdated, cloudUpdated)) {
      toUpsert.push({ ...toRow(row), user_id: userId });
    }
  }
  if (toUpsert.length === 0) return 0;

  // Chunk to keep request size sane.
  for (let i = 0; i < toUpsert.length; i += 200) {
    const chunk = toUpsert.slice(i, i + 200);
    const { error } = await supabase.from(remote).upsert(chunk, { onConflict: "id" });
    if (error) throw error;
  }
  return toUpsert.length;
}

// ─── Settings sync (special: one row per user, keyed by user_id not id) ─────

async function pullSettings(userId: string): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return;

  const cloud = fromRow<Settings & { updatedAt?: string }>(data as Record<string, unknown>);
  delete (cloud as { userId?: string }).userId;
  cloud.id = "singleton";

  const local = await db.settings.get("singleton");
  if (!local) {
    await db.settings.put(cloud);
    return;
  }
  // Last-write-wins. Settings doesn't have updatedAt in the local type, so
  // we treat any present cloud row as authoritative on first pull and merge
  // afterwards. Good enough for personal use.
  await db.settings.put({ ...local, ...cloud, id: "singleton" });
}

async function pushSettings(userId: string): Promise<void> {
  const supabase = getSupabase();
  const local = await db.settings.get("singleton");
  if (!local) return;

  // Compare local settings to cloud first — only upsert if anything changed.
  // (Settings doesn't carry its own updatedAt in the local schema, so we
  // diff the actual payload instead of timestamps.)
  const { data: cloudRow } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const desired = {
    user_id: userId,
    units: local.units,
    default_rest_sec: local.defaultRestSec,
    week_starts_on: local.weekStartsOn,
    theme: local.theme,
    weekly_session_target: local.weeklySessionTarget ?? 3,
    last_backup_at: local.lastBackupAt ?? null,
  };

  if (cloudRow) {
    const same =
      cloudRow.units === desired.units &&
      cloudRow.default_rest_sec === desired.default_rest_sec &&
      cloudRow.week_starts_on === desired.week_starts_on &&
      cloudRow.theme === desired.theme &&
      cloudRow.weekly_session_target === desired.weekly_session_target &&
      (cloudRow.last_backup_at ?? null) === desired.last_backup_at;
    if (same) return;
  }

  const { error } = await supabase
    .from("settings")
    .upsert({ ...desired, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Pull, then push, all tables. Returns counts for the UI. */
export async function syncAll(): Promise<{ pulled: number; pushed: number }> {
  if (!isSupabaseConfigured()) return { pulled: 0, pushed: 0 };
  const supabase = getSupabase();
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.id;
  if (!userId) return { pulled: 0, pushed: 0 };

  setStatus({ state: "syncing" });
  try {
    let pulled = 0;
    let pushed = 0;

    // Pull first so we never overwrite newer cloud rows.
    for (const t of TABLES) pulled += await pullTable(userId, t.remote, t.table);
    await pullSettings(userId);

    // Then push our newer ones up.
    for (const t of TABLES) pushed += await pushTable(userId, t.remote, t.table);
    await pushSettings(userId);

    setStatus({ state: "done", at: Date.now() });
    return { pulled, pushed };
  } catch (err) {
    setStatus({ state: "error", message: (err as Error).message });
    throw err;
  }
}

/**
 * Debounced version for use after every write. Multiple rapid writes coalesce
 * into a single round-trip ~1.5s later.
 */
let pending: ReturnType<typeof setTimeout> | null = null;
export function scheduleSync(): void {
  if (!isSupabaseConfigured()) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    void syncAll().catch(() => {
      /* errors surface via SyncStatus */
    });
  }, 1500);
}

/**
 * Attach Dexie hooks so every local write triggers a debounced sync.
 * Safe to call multiple times — Dexie hooks ignore duplicate registrations
 * with the same function reference, but to be safe we use a guard.
 */
let hooksInstalled = false;
export function installSyncHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;
  const fire = () => scheduleSync();
  const tables = [
    db.exercises, db.templates, db.workoutSessions,
    db.bodyMetrics, db.bodyMeasurements, db.dailyNotes, db.settings,
  ];
  for (const t of tables) {
    t.hook("creating", () => { fire(); });
    t.hook("updating", () => { fire(); });
    t.hook("deleting", () => { fire(); });
  }
}
