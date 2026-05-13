"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { logBodyMetric } from "@/db/queries";
import { todayLocal } from "@/lib/date";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Plus, Check } from "lucide-react";

/**
 * Compact body-metric widget for the Today screen.
 * Shows the latest weight + a "Log today" inline form.
 */
export function HomeBodyMetric() {
  const latest = useLiveQuery(
    () => db.bodyMetrics.orderBy("date").reverse().first(),
    [],
  );
  const [open, setOpen] = useState(false);

  // Did we already log a weight today? Hide the form if so.
  const today = todayLocal();
  const alreadyLoggedToday = latest?.date === today && latest?.weightKg != null;

  return (
    <section>
      <CardHeader
        title="Body"
        action={
          <Link href="/metrics" className="text-xs text-subtle hover:text-fg">
            See all →
          </Link>
        }
      />
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-subtle">Latest weight</div>
            <div className="text-2xl font-semibold">
              {latest?.weightKg != null ? `${latest.weightKg} kg` : "—"}
            </div>
            {latest?.date && (
              <div className="text-xs text-subtle">
                {alreadyLoggedToday ? "Logged today" : `Last logged ${latest.date}`}
              </div>
            )}
          </div>
          {!alreadyLoggedToday && (
            <Button size="sm" onClick={() => setOpen((v) => !v)}>
              <Plus size={14} /> Log
            </Button>
          )}
        </div>
        {open && !alreadyLoggedToday && (
          <QuickForm onDone={() => setOpen(false)} />
        )}
      </Card>
    </section>
  );
}

function QuickForm({ onDone }: { onDone: () => void }) {
  const [weightKg, setWeightKg] = useState<number | "">("");
  const [bodyFatPct, setBodyFatPct] = useState<number | "">("");
  const [sleepHours, setSleepHours] = useState<number | "">("");

  const onSave = async () => {
    if (weightKg === "" && bodyFatPct === "" && sleepHours === "") {
      onDone();
      return;
    }
    await logBodyMetric({
      date: todayLocal(),
      weightKg: weightKg === "" ? undefined : +weightKg,
      bodyFatPct: bodyFatPct === "" ? undefined : +bodyFatPct,
      sleepHours: sleepHours === "" ? undefined : +sleepHours,
      source: "manual",
    });
    onDone();
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Weight (kg)">
          <Input
            type="number"
            inputMode="decimal"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value === "" ? "" : +e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="BF %">
          <Input
            type="number"
            inputMode="decimal"
            value={bodyFatPct}
            onChange={(e) => setBodyFatPct(e.target.value === "" ? "" : +e.target.value)}
          />
        </Field>
        <Field label="Sleep (h)">
          <Input
            type="number"
            inputMode="decimal"
            value={sleepHours}
            onChange={(e) => setSleepHours(e.target.value === "" ? "" : +e.target.value)}
          />
        </Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button size="sm" onClick={onSave}>
          <Check size={14} /> Save
        </Button>
      </div>
    </div>
  );
}
