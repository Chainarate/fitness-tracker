"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { newId } from "@/lib/id";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";
import type { Template, TemplateExercise } from "@/db/schema";

interface Props {
  initial?: Template;
  onSaved: (id: string) => void;
  onDeleted?: () => void;
}

/**
 * Shared editor for new + existing templates.
 * Keeps exercises in local state until "Save" — no partial writes.
 */
export default function TemplateEditor({ initial, onSaved, onDeleted }: Props) {
  const exercises = useLiveQuery(
    () => db.exercises.filter((e) => !e.deletedAt).sortBy("name"),
    [],
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [items, setItems] = useState<TemplateExercise[]>(initial?.exercises ?? []);

  const addExercise = (exerciseId: string) => {
    const ex = exercises?.find((e) => e.id === exerciseId);
    if (!ex) return;
    setItems((prev) => [
      ...prev,
      {
        exerciseId,
        order: prev.length,
        targetSets: ex.defaultSets ?? 3,
        targetReps: String(ex.defaultReps ?? 8),
        restSec: ex.defaultRestSec ?? 120,
      },
    ]);
  };

  const updateItem = (idx: number, patch: Partial<TemplateExercise>) => {
    setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, order: i })));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy.map((p, i) => ({ ...p, order: i }));
    });
  };

  const onSave = async () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    if (initial) {
      const updated: Template = {
        ...initial,
        name: name.trim(),
        description: description.trim() || undefined,
        exercises: items,
        updatedAt: now,
      };
      await db.templates.put(updated);
      onSaved(initial.id);
    } else {
      const id = newId();
      await db.templates.add({
        id,
        type: "strength",
        name: name.trim(),
        description: description.trim() || undefined,
        exercises: items,
        createdAt: now,
        updatedAt: now,
      });
      onSaved(id);
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    if (!confirm("Delete this template?")) return;
    const now = new Date().toISOString();
    // Soft delete — see schema.ts comment on `deletedAt`.
    await db.templates.update(initial.id, { deletedAt: now, updatedAt: now });
    onDeleted?.();
  };

  const exerciseName = (id: string) => exercises?.find((e) => e.id === id)?.name ?? "Unknown";

  return (
    <Card className="space-y-4">
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Push Day A" />
      </Field>
      <Field label="Description (optional)">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div>
        <div className="mb-2 text-sm font-medium">Exercises</div>
        {items.length === 0 && (
          <p className="text-sm text-subtle mb-2">Add exercises below.</p>
        )}
        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li key={`${it.exerciseId}-${idx}`} className="rounded-lg border border-border bg-bg p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm">{exerciseName(it.exerciseId)}</div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => move(idx, -1)} aria-label="Move up"><ArrowUp size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => move(idx, 1)} aria-label="Move down"><ArrowDown size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => removeItem(idx)} aria-label="Remove"><Trash2 size={14} /></Button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                <Field label="Sets">
                  <Input type="number" inputMode="numeric" value={it.targetSets} onChange={(e) => updateItem(idx, { targetSets: +e.target.value })} />
                </Field>
                <Field label="Reps">
                  <Input value={it.targetReps} onChange={(e) => updateItem(idx, { targetReps: e.target.value })} />
                </Field>
                <Field label="RPE">
                  <Input type="number" inputMode="decimal" step="0.5" value={it.targetRPE ?? ""} onChange={(e) => updateItem(idx, { targetRPE: e.target.value ? +e.target.value : undefined })} />
                </Field>
                <Field label="Rest (s)">
                  <Input type="number" inputMode="numeric" value={it.restSec ?? ""} onChange={(e) => updateItem(idx, { restSec: e.target.value ? +e.target.value : undefined })} />
                </Field>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex gap-2">
          <Select
            onChange={(e) => {
              if (e.target.value) {
                addExercise(e.target.value);
                e.currentTarget.value = "";
              }
            }}
            defaultValue=""
          >
            <option value="">Add exercise…</option>
            {exercises?.map((ex) => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <div>
          {initial && (
            <Button variant="danger" onClick={onDelete}>
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={onSave} disabled={!name.trim()}>
            <Plus size={14} /> {initial ? "Save changes" : "Create template"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
