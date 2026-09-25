import { blankAnalysis } from './types';
import type { Analysis } from './types';

export type Coaching = Pick<Analysis, 'visible' | 'cue'> & {
  needsAdjustment: boolean;
};
const initial = (): Coaching => ({
  visible: false,
  needsAdjustment: false,
  cue: blankAnalysis.cue,
});

// Presentation only: raw measurements and score/hold credit never use this buffer.
export class CoachingFeedback {
  private current = initial();
  private pendingKey = '';
  private pendingSince = 0;
  private pendingCue = '';
  private cueSince = 0;
  private lastTime: number | null = null;
  private endpointCue: string | null = null;

  reset() {
    this.current = initial();
    this.pendingKey = '';
    this.pendingCue = '';
    this.lastTime = null;
    this.endpointCue = null;
  }

  update(result: Analysis, time: number): Coaching {
    if (!Number.isFinite(time)) {
      this.reset();
      return this.current;
    }
    if (
      this.lastTime !== null &&
      (time < this.lastTime || time - this.lastTime > 0.75)
    )
      this.reset();
    this.lastTime = time;
    if (result.visible && result.score === 100 && result.phase !== 'neutral')
      this.endpointCue = result.cue;
    const next: Coaching = {
      visible: result.visible,
      needsAdjustment: result.visible && result.score < 100,
      cue:
        result.visible && result.score === 100 && result.phase === 'neutral'
          ? (this.endpointCue ?? result.cue)
          : result.cue,
    };
    const key = `${next.visible}:${next.needsAdjustment}`;
    if (key !== this.pendingKey) {
      this.pendingKey = key;
      this.pendingSince = time;
    }
    if (next.cue !== this.pendingCue) {
      this.pendingCue = next.cue;
      this.cueSince = time;
    }
    // A persistent cue wins after 350 ms; isolated inference blips stay quiet.
    if (time - this.pendingSince >= 0.35) {
      if (
        this.current.visible !== next.visible ||
        this.current.needsAdjustment !== next.needsAdjustment ||
        time - this.cueSince >= 0.35
      )
        this.current = next;
      if (!next.visible) this.endpointCue = null;
    }
    return this.current;
  }
}
