import { exercises as allExercises } from '../catalog';
import type { SessionRecord } from './analysis';

export function readHistory(): SessionRecord[] {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem('forma-sessions') ?? '[]',
    );
    return Array.isArray(data)
      ? data
          .filter(
            (v): v is SessionRecord =>
              v &&
              typeof v.id === 'string' &&
              typeof v.date === 'string' &&
              allExercises.some((e) => e.id === v.exercise) &&
              Number.isFinite(v.duration) &&
              Number.isFinite(v.hold) &&
              Number.isFinite(v.reps) &&
              (v.score === null || Number.isFinite(v.score)) &&
              Array.isArray(v.cues) &&
              v.cues.every((c: unknown) => typeof c === 'string') &&
              (v.assessment === undefined ||
                ['automatic', 'review'].includes(v.assessment)) &&
              (v.notes === undefined || typeof v.notes === 'string') &&
              (v.alignedReps === undefined ||
                (Number.isInteger(v.alignedReps) && v.alignedReps >= 0)) &&
              (v.attempts === undefined ||
                (Array.isArray(v.attempts) &&
                  v.attempts.every(
                    (a: { time?: unknown; note?: unknown } | null) =>
                      a &&
                      typeof a.time === 'number' &&
                      Number.isFinite(a.time) &&
                      a.time >= 0 &&
                      typeof a.note === 'string',
                  ))) &&
              (v.routine === undefined ||
                (v.routine &&
                  typeof v.routine.id === 'string' &&
                  typeof v.routine.name === 'string' &&
                  Number.isInteger(v.routine.step) &&
                  Number.isInteger(v.routine.total) &&
                  v.routine.step >= 1 &&
                  v.routine.step <= v.routine.total)) &&
              ['camera', 'video'].includes(v.source),
          )
          .slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
