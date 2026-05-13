import type { Exercise } from "./schema";
import { newId } from "@/lib/id";

/**
 * Default exercise library — covers the main lifts plus common accessories.
 * The user can edit/extend these freely; nothing is "system protected".
 */
export function seedExercises(): Exercise[] {
  const now = new Date().toISOString();
  const e = (
    name: string,
    muscleGroup: Exercise["muscleGroup"],
    equipment: Exercise["equipment"],
    movementPattern: Exercise["movementPattern"],
    defaults?: Partial<Pick<Exercise, "defaultSets" | "defaultReps" | "defaultRestSec">>,
  ): Exercise => ({
    id: newId(),
    name,
    muscleGroup,
    equipment,
    movementPattern,
    defaultSets: defaults?.defaultSets ?? 3,
    defaultReps: defaults?.defaultReps ?? 8,
    defaultRestSec: defaults?.defaultRestSec ?? 120,
    isCustom: false,
    createdAt: now,
    updatedAt: now,
  });

  return [
    // Push
    e("Barbell Bench Press", "chest", "barbell", "push", { defaultSets: 4, defaultReps: 5, defaultRestSec: 180 }),
    e("Incline Dumbbell Press", "chest", "dumbbell", "push", { defaultSets: 3, defaultReps: 10 }),
    e("Overhead Press", "shoulders", "barbell", "push", { defaultSets: 4, defaultReps: 5, defaultRestSec: 180 }),
    e("Dumbbell Shoulder Press", "shoulders", "dumbbell", "push"),
    e("Lateral Raise", "shoulders", "dumbbell", "isolation", { defaultSets: 3, defaultReps: 15, defaultRestSec: 60 }),
    e("Triceps Pushdown", "triceps", "cable", "isolation", { defaultSets: 3, defaultReps: 12, defaultRestSec: 60 }),
    e("Dips", "triceps", "bodyweight", "push"),

    // Pull
    e("Pull-Up", "back", "bodyweight", "pull", { defaultSets: 4, defaultReps: 6, defaultRestSec: 180 }),
    e("Lat Pulldown", "back", "cable", "pull", { defaultSets: 3, defaultReps: 10 }),
    e("Barbell Row", "back", "barbell", "pull", { defaultSets: 4, defaultReps: 6, defaultRestSec: 180 }),
    e("Seated Cable Row", "back", "cable", "pull"),
    e("Face Pull", "back", "cable", "pull", { defaultSets: 3, defaultReps: 15, defaultRestSec: 60 }),
    e("Barbell Curl", "biceps", "barbell", "isolation", { defaultSets: 3, defaultReps: 10, defaultRestSec: 60 }),
    e("Hammer Curl", "biceps", "dumbbell", "isolation", { defaultSets: 3, defaultReps: 12, defaultRestSec: 60 }),

    // Legs
    e("Back Squat", "quads", "barbell", "squat", { defaultSets: 4, defaultReps: 5, defaultRestSec: 210 }),
    e("Front Squat", "quads", "barbell", "squat", { defaultSets: 3, defaultReps: 5, defaultRestSec: 180 }),
    e("Romanian Deadlift", "hamstrings", "barbell", "hinge", { defaultSets: 4, defaultReps: 8, defaultRestSec: 180 }),
    e("Conventional Deadlift", "hamstrings", "barbell", "hinge", { defaultSets: 3, defaultReps: 5, defaultRestSec: 240 }),
    e("Bulgarian Split Squat", "quads", "dumbbell", "squat", { defaultSets: 3, defaultReps: 10 }),
    e("Leg Press", "quads", "machine", "squat", { defaultSets: 3, defaultReps: 10 }),
    e("Leg Curl", "hamstrings", "machine", "isolation", { defaultSets: 3, defaultReps: 12, defaultRestSec: 60 }),
    e("Standing Calf Raise", "calves", "machine", "isolation", { defaultSets: 4, defaultReps: 12, defaultRestSec: 60 }),
    e("Hip Thrust", "glutes", "barbell", "hinge", { defaultSets: 3, defaultReps: 10 }),

    // Core
    e("Plank", "core", "bodyweight", "core", { defaultSets: 3, defaultReps: 60, defaultRestSec: 60 }),
    e("Hanging Leg Raise", "core", "bodyweight", "core", { defaultSets: 3, defaultReps: 10 }),
    e("Cable Crunch", "core", "cable", "core", { defaultSets: 3, defaultReps: 15, defaultRestSec: 60 }),

    // Cardio (kept in the library for templates that mix modalities; cardio
    // sessions themselves are logged separately and don't require these)
    e("Treadmill Run", "cardio", "machine", "cardio"),
    e("Stationary Bike", "cardio", "machine", "cardio"),
    e("Rowing Machine", "cardio", "machine", "cardio"),
  ];
}
