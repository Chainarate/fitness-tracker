"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { exportJson, exportSetsCsv, importJson } from "@/lib/export";
import type { ExportBundle, Settings } from "@/db/schema";
import {
  isSupabaseConfigured,
  signInWithMagicLink,
  signOut,
  currentSession,
  getSupabase,
  type Session,
} from "@/lib/supabase";
import { syncAll, onSyncStatus, type SyncStatus } from "@/lib/sync";

export default function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.get("singleton"), []);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = async (patch: Partial<Settings>) => {
    if (!settings) return;
    await db.settings.put({ ...settings, ...patch });
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as ExportBundle;
      const mode = confirm("Replace all local data with imported file?\n(Cancel = merge)")
        ? "replace"
        : "merge";
      await importJson(bundle, mode);
      alert("Import complete.");
    } catch (err) {
      alert(`Import failed: ${(err as Error).message}`);
    }
  };

  const onWipe = async () => {
    if (!confirm("This will delete ALL local data. Continue?")) return;
    if (!confirm("Are you absolutely sure? Export first if you haven't.")) return;
    await Promise.all([
      db.exercises.clear(),
      db.templates.clear(),
      db.workoutSessions.clear(),
      db.bodyMetrics.clear(),
    ]);
    location.reload();
  };

  if (!settings) return <div className="text-subtle">Loading…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader title="Preferences" />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Units">
            <Select value={settings.units} onChange={(e) => update({ units: e.target.value as "metric" | "imperial" })}>
              <option value="metric">Metric (kg, km)</option>
              <option value="imperial">Imperial (lb, mi)</option>
            </Select>
          </Field>
          <Field label="Theme">
            <Select value={settings.theme} onChange={(e) => update({ theme: e.target.value as Settings["theme"] })}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </Field>
          <Field label="Week starts on">
            <Select value={settings.weekStartsOn} onChange={(e) => update({ weekStartsOn: +e.target.value as 0 | 1 })}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </Select>
          </Field>
          <Field label="Default rest (sec)">
            <Select value={settings.defaultRestSec} onChange={(e) => update({ defaultRestSec: +e.target.value })}>
              {[60, 90, 120, 150, 180, 210, 240].map((n) => (
                <option key={n} value={n}>{n}s</option>
              ))}
            </Select>
          </Field>
          <Field label="Weekly target (sessions)">
            <Select
              value={settings.weeklySessionTarget ?? 3}
              onChange={(e) => update({ weeklySessionTarget: +e.target.value })}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n} per week</option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <PlateInventoryCard />

      <CloudSyncCard />

      <Card>
        <CardHeader title="Data" />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportJson}>Export JSON</Button>
          <Button variant="secondary" onClick={exportSetsCsv}>Export sets CSV</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>Import JSON…</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = "";
            }}
          />
        </div>
        {settings.lastBackupAt && (
          <p className="mt-2 text-xs text-subtle">
            Last export: {new Date(settings.lastBackupAt).toLocaleString()}
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="Danger zone" />
        <Button variant="danger" onClick={onWipe}>Wipe all local data</Button>
      </Card>
    </div>
  );
}

/**
 * Plate inventory editor — list of {weight, count-per-side} rows that the
 * plate calculator will respect. If nothing is set, the calculator falls
 * back to its built-in defaults.
 */
function PlateInventoryCard() {
  const settings = useLiveQuery(() => db.settings.get("singleton"), []);
  if (!settings) return null;

  const inventory = settings.plateInventory ?? [
    { weightKg: 25, countPerSide: 2 },
    { weightKg: 20, countPerSide: 2 },
    { weightKg: 15, countPerSide: 2 },
    { weightKg: 10, countPerSide: 2 },
    { weightKg: 5,  countPerSide: 2 },
    { weightKg: 2.5, countPerSide: 2 },
    { weightKg: 1.25, countPerSide: 2 },
  ];

  const save = (next: typeof inventory) =>
    db.settings.put({ ...settings, plateInventory: next });

  const updateRow = (idx: number, patch: Partial<{ weightKg: number; countPerSide: number }>) => {
    void save(inventory.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };
  const removeRow = (idx: number) =>
    void save(inventory.filter((_, i) => i !== idx));
  const addRow = () =>
    void save([...inventory, { weightKg: 0, countPerSide: 0 }]);

  return (
    <Card>
      <CardHeader title="Plate inventory" />
      <p className="mb-3 text-xs text-subtle">
        Used by the plate calculator. Count is how many of each plate are
        available per side of the bar. Local to this device.
      </p>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_1fr_36px] gap-2 text-xs text-subtle">
          <span>Weight (kg)</span>
          <span>Per side</span>
          <span />
        </div>
        {inventory.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_36px] gap-2">
            <Input
              type="number"
              inputMode="decimal"
              step="0.25"
              value={p.weightKg || ""}
              onChange={(e) => updateRow(i, { weightKg: +e.target.value })}
            />
            <Input
              type="number"
              inputMode="numeric"
              value={p.countPerSide || ""}
              onChange={(e) => updateRow(i, { countPerSide: +e.target.value })}
            />
            <Button size="sm" variant="ghost" onClick={() => removeRow(i)} aria-label="Remove">
              ×
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={addRow}>+ Add plate</Button>
        <Field label="Default bar (kg)">
          <Input
            type="number"
            inputMode="decimal"
            value={settings.barWeightKg ?? 20}
            onChange={(e) => db.settings.put({ ...settings, barWeightKg: +e.target.value })}
            className="w-24"
          />
        </Field>
      </div>
    </Card>
  );
}

function CloudSyncCard() {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>({ state: "idle" });

  useEffect(() => {
    if (!configured) return;
    void currentSession().then(setSession);
    const supabase = getSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  useEffect(() => {
    return onSyncStatus(setStatus);
  }, []);

  if (!configured) {
    return (
      <Card>
        <CardHeader title="Cloud sync" />
        <p className="text-sm text-subtle">
          Cloud sync is not configured. To enable cross-device sync, follow the
          instructions in <code className="rounded bg-muted px-1">supabase/SETUP.md</code>{" "}
          inside the project repo — create a Supabase project, run the SQL,
          and add the URL + anon key to <code className="rounded bg-muted px-1">.env.local</code>{" "}
          (and to Vercel env vars for production).
        </p>
      </Card>
    );
  }

  const onSend = async () => {
    setError(null);
    try {
      await signInWithMagicLink(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onSyncNow = async () => {
    try {
      const { pulled, pushed } = await syncAll();
      alert(`Sync complete. Pulled ${pulled}, pushed ${pushed}.`);
    } catch (err) {
      alert(`Sync failed: ${(err as Error).message}`);
    }
  };

  return (
    <Card>
      <CardHeader title="Cloud sync" />
      {session ? (
        <div className="space-y-3">
          <div className="text-sm">
            Signed in as <span className="font-medium">{session.user.email}</span>
          </div>
          <div className="text-xs text-subtle">
            Status:{" "}
            {status.state === "syncing"
              ? "Syncing…"
              : status.state === "error"
              ? <span className="text-danger">Error — {status.message}</span>
              : status.state === "done"
              ? `Synced at ${new Date(status.at).toLocaleTimeString()}`
              : "Idle"}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onSyncNow}>Sync now</Button>
            <Button variant="ghost" onClick={() => void signOut()}>Sign out</Button>
          </div>
        </div>
      ) : sentTo ? (
        <div className="space-y-2">
          <p className="text-sm">Check <span className="font-medium">{sentTo}</span> for the magic link.</p>
          <Button size="sm" variant="ghost" onClick={() => setSentTo(null)}>Use another email</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-subtle">
            Sign in once and your workouts sync across all your devices automatically.
          </p>
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button onClick={onSend} disabled={!email.includes("@")}>Send magic link</Button>
        </div>
      )}
    </Card>
  );
}
