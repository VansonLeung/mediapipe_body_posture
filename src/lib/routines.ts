import { findExercise, isAvailableExercise } from '../catalog';
import type { ExerciseId } from '../catalog';
export interface RoutineStep {
  exercise: ExerciseId;
  target: number;
}
export interface Routine {
  id: string;
  name: string;
  steps: RoutineStep[];
}
export const routineStorageKey = 'forma-routines-v1';
export function parseRoutines(raw: string): Routine[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (r): r is Routine =>
          r &&
          typeof r.id === 'string' &&
          typeof r.name === 'string' &&
          r.name.trim().length > 0 &&
          Array.isArray(r.steps) &&
          r.steps.length > 0 &&
          r.steps.length <= 30 &&
          r.steps.every(
            (s: RoutineStep) =>
              s &&
              typeof s.exercise === 'string' &&
              s.exercise.trim().length > 0 &&
              Number.isInteger(s.target) &&
              s.target >= 0 &&
              s.target <= 300 &&
              (!findExercise(s.exercise) ||
                (findExercise(s.exercise)?.support === 'review'
                  ? s.target === 0
                  : s.target >= 1)),
          ),
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}
export function unavailableSteps(routine: Routine) {
  return routine.steps.flatMap((step, index) =>
    isAvailableExercise(step.exercise)
      ? []
      : [{ index, exercise: step.exercise }],
  );
}
export const canStartRoutine = (routine: Routine) =>
  parseRoutines(JSON.stringify([routine])).length === 1 &&
  unavailableSteps(routine).length === 0;
