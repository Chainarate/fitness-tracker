"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { moveSession } from "@/db/queries";

/**
 * Mobile-friendly fallback for drag-and-drop: pick a date with the native
 * date input and call moveSession.
 */
export function MoveSessionDialog({
  open,
  onClose,
  sessionId,
  currentDate,
  sessionName,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  currentDate: string;
  sessionName: string;
}) {
  const [date, setDate] = useState(currentDate);

  if (!open || !sessionId) return null;

  const onSubmit = async () => {
    try {
      await moveSession(sessionId, date);
      onClose();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold">Move session</h2>
        <p className="mb-4 text-sm text-subtle">{sessionName}</p>
        <Field label="New date">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={date === currentDate}>Move</Button>
        </div>
      </div>
    </div>
  );
}
