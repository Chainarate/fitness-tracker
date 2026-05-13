"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { db } from "@/db";
import { scheduleStrengthSession } from "@/db/queries";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Input";

/**
 * Modal for adding a session to a specific date.
 * - Strength: pick a template → schedules a planned session.
 * - Cardio: routes to /cardio/new with the date pre-filled.
 */
export function ScheduleDialog({
  open,
  onClose,
  date,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
}) {
  const router = useRouter();
  const templates = useLiveQuery(() => db.templates.orderBy("name").toArray(), []);
  const [kind, setKind] = useState<"strength" | "cardio">("strength");
  const [templateId, setTemplateId] = useState<string>("");

  if (!open) return null;

  const onSchedule = async () => {
    if (kind === "cardio") {
      router.push(`/cardio/new?date=${encodeURIComponent(date)}`);
      onClose();
      return;
    }
    const template = templates?.find((t) => t.id === templateId);
    if (!template) return;
    const id = await scheduleStrengthSession(template, date);
    onClose();
    router.push(`/workout/${id}`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Schedule for {date}</h2>
        <div className="space-y-3">
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as "strength" | "cardio")}>
              <option value="strength">Strength template</option>
              <option value="cardio">Cardio session</option>
            </Select>
          </Field>
          {kind === "strength" && (
            <Field label="Template">
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Select template…</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              {templates && templates.length === 0 && (
                <p className="mt-2 text-xs text-subtle">
                  No templates yet — create one under Exercises → Templates first.
                </p>
              )}
            </Field>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSchedule} disabled={kind === "strength" && !templateId}>
            {kind === "cardio" ? "Continue" : "Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
