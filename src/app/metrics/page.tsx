"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { logBodyMetric, logBodyMeasurement } from "@/db/queries";
import { todayLocal } from "@/lib/date";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Plus } from "lucide-react";

export default function MetricsPage() {
  const metrics = useLiveQuery(() => db.bodyMetrics.orderBy("date").toArray(), []);
  const [showForm, setShowForm] = useState(false);

  const chart = useMemo(() => {
    return (metrics ?? []).map((m) => ({
      date: m.date,
      weight: m.weightKg ?? null,
      bf: m.bodyFatPct ?? null,
    }));
  }, [metrics]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Body metrics</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} /> Log
        </Button>
      </header>

      {showForm && <MetricForm onSaved={() => setShowForm(false)} />}

      <section>
        <CardHeader title="Weight trend" />
        <Card>
          {chart.length === 0 ? (
            <EmptyState title="No metrics yet" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} width={40} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="weight" stroke="rgb(14 165 233)" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </section>

      <section>
        <CardHeader title="Recent entries" />
        <ul className="space-y-1">
          {(metrics ?? []).slice().reverse().slice(0, 10).map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-2 text-sm">
              <span className="text-subtle text-xs">{m.date}</span>
              <span>
                {m.weightKg != null ? `${m.weightKg} kg` : ""}
                {m.bodyFatPct != null ? ` · ${m.bodyFatPct}%` : ""}
                {m.sleepHours != null ? ` · ${m.sleepHours}h sleep` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <MeasurementsSection />

      <div>
        <Link href="/progress"><Button variant="ghost">See full progress →</Button></Link>
      </div>
    </div>
  );
}

function MeasurementsSection() {
  const measurements = useLiveQuery(() => db.bodyMeasurements.orderBy("date").toArray(), []);
  const [showForm, setShowForm] = useState(false);

  const chart = useMemo(
    () =>
      (measurements ?? []).map((m) => ({
        date: m.date,
        waist: m.waistCm ?? null,
        chest: m.chestCm ?? null,
        hip: m.hipCm ?? null,
      })),
    [measurements],
  );

  return (
    <section>
      <CardHeader
        title="Measurements (cm)"
        action={
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus size={14} /> Log
          </Button>
        }
      />
      {showForm && <MeasurementForm onSaved={() => setShowForm(false)} />}
      <Card>
        {chart.length === 0 ? (
          <EmptyState
            title="No measurements yet"
            description="Track circumference — chest, waist, hip, arms, thighs."
          />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} width={40} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="waist" stroke="rgb(14 165 233)" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="chest" stroke="rgb(34 197 94)" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="hip" stroke="rgb(234 179 8)" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </section>
  );
}

function MeasurementForm({ onSaved }: { onSaved: () => void }) {
  const [date, setDate] = useState(todayLocal());
  const [neckCm, setNeck] = useState<number | "">("");
  const [chestCm, setChest] = useState<number | "">("");
  const [waistCm, setWaist] = useState<number | "">("");
  const [hipCm, setHip] = useState<number | "">("");
  const [leftArmCm, setLArm] = useState<number | "">("");
  const [rightArmCm, setRArm] = useState<number | "">("");
  const [leftThighCm, setLThigh] = useState<number | "">("");
  const [rightThighCm, setRThigh] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const num = (v: number | "") => (v === "" ? undefined : +v);

  const onSave = async () => {
    await logBodyMeasurement({
      date,
      neckCm: num(neckCm),
      chestCm: num(chestCm),
      waistCm: num(waistCm),
      hipCm: num(hipCm),
      leftArmCm: num(leftArmCm),
      rightArmCm: num(rightArmCm),
      leftThighCm: num(leftThighCm),
      rightThighCm: num(rightThighCm),
      notes: notes.trim() || undefined,
      source: "manual",
    });
    onSaved();
  };

  return (
    <Card className="space-y-3 mb-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Neck"><Input type="number" inputMode="decimal" value={neckCm} onChange={(e) => setNeck(e.target.value === "" ? "" : +e.target.value)} /></Field>
        <Field label="Chest"><Input type="number" inputMode="decimal" value={chestCm} onChange={(e) => setChest(e.target.value === "" ? "" : +e.target.value)} /></Field>
        <Field label="Waist"><Input type="number" inputMode="decimal" value={waistCm} onChange={(e) => setWaist(e.target.value === "" ? "" : +e.target.value)} /></Field>
        <Field label="Hip"><Input type="number" inputMode="decimal" value={hipCm} onChange={(e) => setHip(e.target.value === "" ? "" : +e.target.value)} /></Field>
        <Field label="L. Arm"><Input type="number" inputMode="decimal" value={leftArmCm} onChange={(e) => setLArm(e.target.value === "" ? "" : +e.target.value)} /></Field>
        <Field label="R. Arm"><Input type="number" inputMode="decimal" value={rightArmCm} onChange={(e) => setRArm(e.target.value === "" ? "" : +e.target.value)} /></Field>
        <Field label="L. Thigh"><Input type="number" inputMode="decimal" value={leftThighCm} onChange={(e) => setLThigh(e.target.value === "" ? "" : +e.target.value)} /></Field>
        <Field label="R. Thigh"><Input type="number" inputMode="decimal" value={rightThighCm} onChange={(e) => setRThigh(e.target.value === "" ? "" : +e.target.value)} /></Field>
      </div>
      <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onSaved}>Cancel</Button>
        <Button onClick={onSave}>Save</Button>
      </div>
    </Card>
  );
}

function MetricForm({ onSaved }: { onSaved: () => void }) {
  const [date, setDate] = useState(todayLocal());
  const [weightKg, setWeightKg] = useState<number | "">("");
  const [bodyFatPct, setBodyFatPct] = useState<number | "">("");
  const [muscleMassKg, setMuscleMassKg] = useState<number | "">("");
  const [sleepHours, setSleepHours] = useState<number | "">("");
  const [steps, setSteps] = useState<number | "">("");
  const [restingHr, setRestingHr] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const onSave = async () => {
    await logBodyMetric({
      date,
      weightKg: weightKg === "" ? undefined : +weightKg,
      bodyFatPct: bodyFatPct === "" ? undefined : +bodyFatPct,
      muscleMassKg: muscleMassKg === "" ? undefined : +muscleMassKg,
      sleepHours: sleepHours === "" ? undefined : +sleepHours,
      steps: steps === "" ? undefined : +steps,
      restingHr: restingHr === "" ? undefined : +restingHr,
      notes: notes.trim() || undefined,
      source: "manual",
    });
    onSaved();
  };

  return (
    <Card className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Weight (kg)"><Input type="number" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value === "" ? "" : +e.target.value)} /></Field>
        <Field label="Body fat %"><Input type="number" inputMode="decimal" value={bodyFatPct} onChange={(e) => setBodyFatPct(e.target.value === "" ? "" : +e.target.value)} /></Field>
        <Field label="Muscle mass (kg)"><Input type="number" inputMode="decimal" value={muscleMassKg} onChange={(e) => setMuscleMassKg(e.target.value === "" ? "" : +e.target.value)} /></Field>
        <Field label="Sleep (h)"><Input type="number" inputMode="decimal" value={sleepHours} onChange={(e) => setSleepHours(e.target.value === "" ? "" : +e.target.value)} /></Field>
        <Field label="Steps"><Input type="number" inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value === "" ? "" : +e.target.value)} /></Field>
        <Field label="Resting HR"><Input type="number" inputMode="numeric" value={restingHr} onChange={(e) => setRestingHr(e.target.value === "" ? "" : +e.target.value)} /></Field>
      </div>
      <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onSaved}>Cancel</Button>
        <Button onClick={onSave}>Save</Button>
      </div>
    </Card>
  );
}
