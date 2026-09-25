import { analyzePose } from './registry';
import type { Landmark } from './types';

// Acquire standing-arm tracking at 0.6 confidence; keep already tracked joints
// through the 0.5–0.6 band. Cropping, missing or degenerate joints still fail.
export class MovementTracking {
  private tracked = false;
  private lastTime: number | null = null;
  private configuration = '';
  reset() {
    this.tracked = false;
    this.lastTime = null;
    this.configuration = '';
  }
  update(
    points: Landmark[],
    exercise: string,
    aspect: number,
    tolerance: number,
    time: number,
  ) {
    const configuration = `${exercise}:${aspect}:${tolerance}`;
    if (
      configuration !== this.configuration ||
      !Number.isFinite(time) ||
      (this.lastTime !== null &&
        (time < this.lastTime || time - this.lastTime > 0.75))
    )
      this.reset();
    this.configuration = configuration;
    this.lastTime = Number.isFinite(time) ? time : null;
    const result = analyzePose(
      points,
      exercise,
      aspect,
      tolerance,
      this.tracked ? 0.5 : 0.6,
    );
    this.tracked = result.visible;
    return result;
  }
}
