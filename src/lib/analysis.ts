import type { ExerciseId } from '../catalog';
import type { Analysis } from '../analysis/types';
export { analyzePose } from '../analysis/registry';
export { angle } from '../analysis/geometry';
export { blankAnalysis } from '../analysis/types';
export type { Landmark, Check, Analysis } from '../analysis/types';
export class RepCounter {
  private stage: 'unready' | 'ready' | 'raised' = 'unready';
  private movementStage: 'unready' | 'ready' | 'raised' = 'unready';
  private lastTime: number | null = null;
  private lastVisibleTime: number | null = null;
  private endpoint: Analysis['phase'] = 'neutral';
  private endpointSince = 0;
  count = 0;
  movements = 0;
  // Timestamped observations tolerate brief occlusion, but never infer an
  // endpoint. Untimed callers retain conservative, immediate reset behavior.
  update(result: Analysis, time?: number) {
    if (time !== undefined) {
      if (!Number.isFinite(time)) {
        this.resetStage();
        return this.count;
      }
      if (
        this.lastTime !== null &&
        (time < this.lastTime || time - this.lastTime > 0.75)
      )
        this.resetStage();
      this.lastTime = time;
      if (this.lastVisibleTime !== null && time - this.lastVisibleTime > 0.75)
        this.resetStage();
    }
    if (!result.visible) {
      if (time === undefined) this.movementStage = 'unready';
      this.stage = 'unready';
      this.endpoint = 'neutral';
      return this.count;
    }
    if (time !== undefined) this.lastVisibleTime = time;
    if (result.score < 100) this.stage = 'unready';
    if (time !== undefined) {
      if (result.phase !== this.endpoint) {
        this.endpoint = result.phase;
        this.endpointSince = time;
      }
      // Two or more observations, not a single noisy threshold crossing.
      if (result.phase === 'neutral' || time - this.endpointSince < 0.1)
        return this.count;
    }
    if (result.phase === 'lowered') {
      if (this.movementStage === 'raised') this.movements++;
      this.movementStage = 'ready';
    } else if (result.phase === 'raised' && this.movementStage === 'ready')
      this.movementStage = 'raised';
    if (result.score < 100) return this.count;
    if (result.phase === 'lowered') {
      if (this.stage === 'raised') this.count++;
      this.stage = 'ready';
    } else if (result.phase === 'raised' && this.stage === 'ready')
      this.stage = 'raised';
    return this.count;
  }
  resetStage() {
    this.stage = 'unready';
    this.movementStage = 'unready';
    this.lastTime = null;
    this.lastVisibleTime = null;
    this.endpoint = 'neutral';
    this.endpointSince = 0;
  }
}
export interface ReviewPoint {
  time: number;
  score: number;
  cue: string;
  visible: boolean;
}
export interface SessionRecord {
  id: string;
  date: string;
  exercise: ExerciseId;
  source: 'camera' | 'video';
  duration: number;
  hold: number;
  reps: number;
  alignedReps?: number;
  score: number | null;
  cues: string[];
  assessment?: 'automatic' | 'review';
  attempts?: { time: number; note: string }[];
  notes?: string;
  routine?: { id: string; name: string; step: number; total: number };
}
export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;
