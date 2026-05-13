"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { db } from "@/db";
import { newId } from "@/lib/id";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import type { Equipment, MovementPattern, MuscleGroup } from "@/db/schema";

const MUSCLE_GROUPS: MuscleGroup[] = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms",
  "quads", "hamstrings", "glutes", "calves", "core", "full_body", "cardio",
];
const EQUIPMENT: Equipment[] = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band", "other"];
const PATTERNS: MovementPattern[] = ["push", "pull", "squat", "hinge", "carry", "core", "isolation", "cardio"];

export default function NewExercisePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("chest");
  const [equipment, setEquipment] = useState<Equipment>("barbell");
  const [movementPattern, setMovementPattern] = useState<MovementPattern>("push");
  const [defaultSets, setDefaultSets] = useState(3);
  const [defaultReps, setDefaultReps] = useState(8);
  const [defaultRestSec, setDefaultRestSec] = useState(120);
  const [notes, setNotes] = useState("");

  const onSave = async () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    await db.exercises.add({
      id: newId(),
      name: name.trim(),
      muscleGroup,
      equipment,
      movementPattern,
      defaultSets,
      defaultReps,
      defaultRestSec,
      notes: notes.trim() || undefined,
      isCustom: true,
      createdAt: now,
      updatedAt: now,
    });
    router.push("/exercises");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New exercise</h1>
      <Card className="space-y-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cable Fly" />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Muscle group">
            <Select value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}>
              {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
            </Select>
          </Field>
          <Field label="Equipment">
            <Select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
              {EQUIPMENT.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Pattern">
            <Select value={movementPattern} onChange={(e) => setMovementPattern(e.target.value as MovementPattern)}>
              {PATTERNS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Default sets">
            <Input type="number" inputMode="numeric" value={defaultSets} onChange={(e) => setDefaultSets(+e.target.value)} />
          </Field>
          <Field label="Default reps">
            <Input type="number" inputMode="numeric" value={defaultReps} onChange={(e) => setDefaultReps(+e.target.value)} />
          </Field>
          <Field label="Rest (sec)">
            <Input type="number" inputMode="numeric" value={defaultRestSec} onChange={(e) => setDefaultRestSec(+e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Form cues, setup, etc." />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button onClick={onSave} disabled={!name.trim()}>Save</Button>
        </div>
      </Card>
    </div>
  );
}
