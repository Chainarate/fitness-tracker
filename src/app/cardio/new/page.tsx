"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { logCardioSession } from "@/db/queries";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { todayLocal } from "@/lib/date";
import type { CardioType } from "@/db/schema";

const PRESETS: { type: CardioType; label: string }[] = [
  { type: "zone2", label: "Z2" },
  { type: "easy_run", label: "Easy Run" },
  { type: "long_run", label: "Long Run" },
  { type: "tempo", label: "Tempo" },
  { type: "intervals", label: "Intervals" },
  { type: "bike", label: "Bike" },
  { type: "row", label: "Row" },
  { type: "other", label: "Other" },
];

// Next.js 15 prerenders pages at build time. `useSearchParams()` can only
// resolve on the client, so the consumer must live inside a <Suspense> boundary.
export default function NewCardioPage() {
  return (
    <Suspense fallback={<div className="text-subtle">Loading…</div>}>
      <NewCardioForm />
    </Suspense>
  );
}

function NewCardioForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialDate = sp.get("date") ?? todayLocal();

  const [date, setDate] = useState(initialDate);
  const [type, setType] = useState<CardioType>("zone2");
  const [durationMin, setDurationMin] = useState<number>(45);
  const [distanceKm, setDistanceKm] = useState<number | "">("");
  const [avgHr, setAvgHr] = useState<number | "">("");
  const [hrZone, setHrZone] = useState<1 | 2 | 3 | 4 | 5 | "">("");
  const [perceivedEffort, setPerceivedEffort] = useState<number | "">("");
  const [calories, setCalories] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [customName, setCustomName] = useState("");

  const onSave = async () => {
    const durationSec = Math.max(0, Math.round(durationMin * 60));
    const dist = distanceKm === "" ? undefined : +distanceKm;
    const avgPaceSecPerKm =
      dist && dist > 0 ? Math.round(durationSec / dist) : undefined;

    const presetLabel = PRESETS.find((p) => p.type === type)?.label ?? "Cardio";
    const name = customName.trim() || presetLabel;

    await logCardioSession(date, name, {
      type,
      durationSec,
      distanceKm: dist,
      avgPaceSecPerKm,
      avgHr: avgHr === "" ? undefined : +avgHr,
      hrZone: hrZone === "" ? undefined : (hrZone as 1 | 2 | 3 | 4 | 5),
      calories: calories === "" ? undefined : +calories,
      perceivedEffort: perceivedEffort === "" ? undefined : +perceivedEffort,
    });
    router.push("/");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Log cardio</h1>
      <Card className="space-y-3">
        <Field label="Type">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.type}
                type="button"
                onClick={() => setType(p.type)}
                className={
                  "rounded-full px-3 py-1 text-sm border " +
                  (type === p.type
                    ? "bg-primary text-primary-fg border-primary"
                    : "border-border text-fg hover:bg-muted")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Session name (optional)">
          <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Park loop" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Duration (min)">
            <Input type="number" inputMode="decimal" value={durationMin} onChange={(e) => setDurationMin(+e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Distance (km)">
            <Input type="number" inputMode="decimal" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value === "" ? "" : +e.target.value)} />
          </Field>
          <Field label="Avg HR">
            <Input type="number" inputMode="numeric" value={avgHr} onChange={(e) => setAvgHr(e.target.value === "" ? "" : +e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="HR Zone">
            <Select value={hrZone} onChange={(e) => setHrZone(e.target.value === "" ? "" : (+e.target.value as 1 | 2 | 3 | 4 | 5))}>
              <option value="">—</option>
              <option value={1}>Z1</option>
              <option value={2}>Z2</option>
              <option value={3}>Z3</option>
              <option value={4}>Z4</option>
              <option value={5}>Z5</option>
            </Select>
          </Field>
          <Field label="RPE (1-10)">
            <Input type="number" inputMode="numeric" min={1} max={10} value={perceivedEffort} onChange={(e) => setPerceivedEffort(e.target.value === "" ? "" : +e.target.value)} />
          </Field>
          <Field label="Calories">
            <Input type="number" inputMode="numeric" value={calories} onChange={(e) => setCalories(e.target.value === "" ? "" : +e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel?" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button onClick={onSave}>Save session</Button>
        </div>
      </Card>
    </div>
  );
}
