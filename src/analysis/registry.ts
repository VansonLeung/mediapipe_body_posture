import { findExercise } from '../catalog';
import { feedback } from '../catalog/feedback';
import { blankAnalysis } from './types';
import type { Analysis, Landmark } from './types';
import { analyzeLegacyPose } from './analyzers/legacy';
import { analyzeGymnastics } from './analyzers/shapes';
import { analyzeStandingMovement } from './analyzers/standing';
type Analyzer = (
  points: Landmark[],
  aspect: number,
  tolerance: number,
  minimumVisibility?: number,
) => Analysis;
export const analyzers: Readonly<Record<string, Analyzer>> = {
  warrior: (p, a, t) => analyzeLegacyPose(p, 'warrior', a, t),
  tree: (p, a, t) => analyzeLegacyPose(p, 'tree', a, t),
  arms: (p, a, t) => analyzeLegacyPose(p, 'arms', a, t),
  bend: (p, a, t) => analyzeLegacyPose(p, 'bend', a, t),
  'standing-balance': (p, a, t) =>
    analyzeGymnastics(p, 'standing-balance', a, t),
  'one-leg-balance': (p, a, t) => analyzeGymnastics(p, 'one-leg-balance', a, t),
  tuck: (p, a, t) => analyzeGymnastics(p, 'tuck', a, t),
  pike: (p, a, t) => analyzeGymnastics(p, 'pike', a, t),
  straddle: (p, a, t) => analyzeGymnastics(p, 'straddle', a, t),
  plank: (p, a, t) => analyzeGymnastics(p, 'plank', a, t),
  'overhead-reach': (p, a, t, v) =>
    analyzeStandingMovement(p, 'overhead-reach', a, t, v),
  'elbow-bends': (p, a, t, v) =>
    analyzeStandingMovement(p, 'elbow-bends', a, t, v),
};
// Canonical lookup keeps archived history analyzable; live sessions separately
// enforce collection availability before beginning or accepting frames.
export function analyzePose(
  points: Landmark[],
  exercise: string,
  aspect = 1,
  tolerance = 0,
  minimumVisibility = 0.6,
): Analysis {
  const id = findExercise(exercise)?.data.analysisProfileId;
  if (!id || !Object.hasOwn(analyzers, id))
    return {
      ...blankAnalysis,
      visible: points.some((p) => (p.visibility ?? 0) >= 0.6),
      cue: feedback('teacher-review-no-automatic-technique-score'),
    };
  return analyzers[id](points, aspect, tolerance, minimumVisibility);
}
