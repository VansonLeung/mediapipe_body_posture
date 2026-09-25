import { describe, expect, it } from 'vitest';
import { RepCounter, blankAnalysis } from '../lib/analysis';
import { CoachingFeedback } from './coaching';
import type { Analysis } from './types';

const down: Analysis = {
  ...blankAnalysis,
  visible: true,
  phase: 'lowered',
  score: 100,
  cue: 'Raise your hands',
};
const up: Analysis = { ...down, phase: 'raised', cue: 'Lower your hands' };
const between: Analysis = { ...down, phase: 'neutral' };
const poor: Analysis = {
  ...between,
  score: 67,
  cue: 'Move both arms together',
};

describe('timestamped repetition counting', () => {
  it('counts slow cycles with intermediate poses, brief lost frames and imperfect alignment', () => {
    const counter = new RepCounter();
    for (let cycle = 0; cycle < 5; cycle++) {
      const start = cycle * 8;
      // 8 seconds per repetition at 10 Hz, including 300 ms of occlusion.
      for (let frame = 0; frame < 80; frame++) {
        const pose =
          frame < 5 || frame > 74
            ? down
            : frame > 35 && frame < 45
              ? up
              : frame > 58 && frame < 62
                ? blankAnalysis
                : frame === 25
                  ? poor
                  : between;
        counter.update(pose, start + frame / 10);
      }
      expect(counter.movements).toBe(cycle + 1);
    }
    expect(counter.count).toBe(0); // Quality remains a separate, stricter measurement.
  });
  it('never infers an unseen raised endpoint', () => {
    const counter = new RepCounter();
    counter.update(down, 0);
    counter.update(down, 0.15);
    counter.update(blankAnalysis, 0.25);
    counter.update(blankAnalysis, 0.4);
    counter.update(down, 0.5);
    counter.update(down, 0.65);
    expect(counter.movements).toBe(0);
  });
  it('requires persistent endpoints instead of single-frame spikes', () => {
    const counter = new RepCounter();
    counter.update(down, 0);
    counter.update(down, 0.15);
    counter.update(up, 0.3);
    counter.update(between, 0.35);
    counter.update(down, 0.5);
    counter.update(down, 0.65);
    expect(counter.movements).toBe(0);
  });
  it.each(['loss', 'stalled-frames', 'seek', 'explicit-reset'] as const)(
    'invalidates unfinished cycles after %s',
    (interruption) => {
      const counter = new RepCounter();
      counter.update(down, 0);
      counter.update(down, 0.15);
      counter.update(up, 0.3);
      counter.update(up, 0.45);
      if (interruption === 'loss') {
        counter.update(blankAnalysis, 0.6);
        counter.update(blankAnalysis, 1.3);
      } else if (interruption === 'explicit-reset') counter.resetStage();
      const time =
        interruption === 'seek'
          ? 0.1
          : interruption === 'explicit-reset'
            ? 0.6
            : 1.4;
      counter.update(down, time);
      counter.update(down, time + 0.15);
      expect(counter.movements).toBe(0);
    },
  );
  it('does not grant dwell time or another repetition for duplicate timestamps', () => {
    const counter = new RepCounter();
    for (let i = 0; i < 5; i++) {
      counter.update(down, 1);
      counter.update(up, 1);
      counter.update(down, 1);
    }
    expect(counter.movements).toBe(0);
  });
});

describe('steady child-facing coaching', () => {
  it('ignores isolated adjustment/tracking blips, then shows sustained loss', () => {
    const feedback = new CoachingFeedback();
    feedback.update(down, 0);
    expect(feedback.update(down, 0.4)).toMatchObject({
      visible: true,
      needsAdjustment: false,
    });
    expect(feedback.update(poor, 0.5).needsAdjustment).toBe(false);
    feedback.update(blankAnalysis, 0.6);
    expect(feedback.update(down, 0.7).visible).toBe(true);
    feedback.update(blankAnalysis, 0.8);
    expect(feedback.update(blankAnalysis, 1.2).visible).toBe(false);
  });
  it('shows persistent adjustments even if different checks alternate', () => {
    const feedback = new CoachingFeedback();
    feedback.update(down, 0);
    feedback.update(down, 0.4);
    feedback.update(poor, 0.5);
    feedback.update({ ...poor, cue: 'Stand upright' }, 0.7);
    expect(feedback.update(poor, 0.9).needsAdjustment).toBe(true);
  });
  it('keeps the return instruction during a neutral transition after reaching the top', () => {
    const feedback = new CoachingFeedback();
    feedback.update(up, 0);
    feedback.update(up, 0.4);
    expect(feedback.update(between, 0.5).cue).toBe(up.cue);
    expect(feedback.update(between, 1).cue).toBe(up.cue);
    feedback.update(down, 1.1);
    expect(feedback.update(down, 1.5).cue).toBe(down.cue);
  });
  it('clears buffered feedback on seeking or an explicit reset', () => {
    const feedback = new CoachingFeedback();
    feedback.update(up, 0);
    feedback.update(up, 0.4);
    expect(feedback.update(down, 0.1).visible).toBe(false);
    feedback.update(down, 0.5);
    feedback.reset();
    expect(feedback.update(down, 0.6).visible).toBe(false);
  });
});
