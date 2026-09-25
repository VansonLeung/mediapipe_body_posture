import { describe, expect, it } from 'vitest';
import { analyzePose, RepCounter } from '../lib/analysis';
import type { Landmark } from './types';
import { MovementTracking } from './tracking';

function down(): Landmark[] {
  const p = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  const positions: Record<number, [number, number]> = {
    11: [0.4, 0.35],
    12: [0.6, 0.35],
    13: [0.4, 0.49],
    14: [0.6, 0.49],
    15: [0.4, 0.63],
    16: [0.6, 0.63],
    23: [0.43, 0.58],
    24: [0.57, 0.58],
    25: [0.43, 0.74],
    26: [0.57, 0.74],
    27: [0.43, 0.91],
    28: [0.57, 0.91],
  };
  for (const [i, [x, y]] of Object.entries(positions))
    p[Number(i)] = { x, y, visibility: 1 };
  return p;
}
function overhead() {
  const p = down();
  p[13] = { x: 0.34, y: 0.22, visibility: 1 };
  p[14] = { x: 0.66, y: 0.22, visibility: 1 };
  p[15] = { x: 0.3, y: 0.09, visibility: 1 };
  p[16] = { x: 0.7, y: 0.09, visibility: 1 };
  return p;
}
function bent() {
  const p = down();
  p[15] = { x: 0.43, y: 0.38, visibility: 1 };
  p[16] = { x: 0.57, y: 0.38, visibility: 1 };
  return p;
}
describe('standing movement additions', () => {
  it.each(['overhead-reach', 'elbow-bends'] as const)(
    'keeps %s through borderline confidence, but reacquires after actual loss',
    (id) => {
      const tracker = new MovementTracking();
      const borderline = down();
      borderline[15].visibility = 0.55;
      expect(tracker.update(borderline, id, 1, 0, 0).visible).toBe(false);
      expect(tracker.update(down(), id, 1, 0, 0.1).visible).toBe(true);
      expect(tracker.update(borderline, id, 1, 0, 0.2).visible).toBe(true);
      const lost = down();
      lost[15].visibility = 0.2;
      expect(tracker.update(lost, id, 1, 0, 0.3).visible).toBe(false);
      expect(tracker.update(borderline, id, 1, 0, 0.4).visible).toBe(false);
      expect(tracker.update(down(), id, 1, 0, 0.5).visible).toBe(true);
      const cropped = down();
      cropped[15].x = 1.1;
      expect(tracker.update(cropped, id, 1, 0, 0.6).visible).toBe(false);
      tracker.update(down(), id, 1, 0, 0.7);
      tracker.reset();
      expect(tracker.update(borderline, id, 1, 0, 0.8).visible).toBe(false);
    },
  );
  it.each([
    ['overhead-reach', overhead],
    ['elbow-bends', bent],
  ] as const)(
    'counts five slow %s cycles through projected intermediate arm positions',
    (id, raised) => {
      const tracker = new MovementTracking(),
        counter = new RepCounter();
      const lower = down(),
        upper = raised();
      for (let cycle = 0; cycle < 5; cycle++) {
        for (let frame = 0; frame < 60; frame++) {
          const fraction =
            frame < 5
              ? 0
              : frame < 25
                ? (frame - 5) / 20
                : frame < 35
                  ? 1
                  : frame < 55
                    ? (55 - frame) / 20
                    : 0;
          const points = lower.map((p, i) => ({
            ...p,
            x: p.x + (upper[i].x - p.x) * fraction,
            y: p.y + (upper[i].y - p.y) * fraction,
          }));
          if (frame > 8 && frame < 14) points[15].visibility = 0.55;
          const time = cycle * 6 + frame / 10;
          counter.update(tracker.update(points, id, 1, 5, time), time);
        }
        expect(counter.movements).toBe(cycle + 1);
      }
    },
  );
  it.each([
    ['overhead-reach', overhead],
    ['elbow-bends', bent],
  ] as const)(
    'counts %s only after a full down → movement → return cycle',
    (id, raised) => {
      const counter = new RepCounter();
      const a = analyzePose(down(), id),
        b = analyzePose(raised(), id);
      expect(a.phase).toBe('lowered');
      expect(b.phase).toBe('raised');
      expect(b.score).toBe(100);
      counter.update(b);
      counter.update(a);
      expect(counter.movements).toBe(0);
      counter.update(b);
      counter.update(b);
      expect(counter.movements).toBe(0);
      counter.update(a);
      expect(counter.movements).toBe(1);
      expect(counter.count).toBe(1);
    },
  );
  it('does not mistake shoulder-height arm raises or one raised arm for an overhead reach', () => {
    const p = down();
    p[13] = { x: 0.27, y: 0.35, visibility: 1 };
    p[15] = { x: 0.14, y: 0.35, visibility: 1 };
    p[14] = { x: 0.73, y: 0.35, visibility: 1 };
    p[16] = { x: 0.86, y: 0.35, visibility: 1 };
    expect(analyzePose(p, 'overhead-reach').phase).toBe('neutral');
    const one = overhead();
    one[14] = down()[14];
    one[16] = down()[16];
    expect(analyzePose(one, 'overhead-reach').phase).toBe('neutral');
  });
  it('does not count overhead bent arms as elbows bent at the sides', () => {
    const p = overhead();
    p[15] = { x: 0.4, y: 0.3, visibility: 1 };
    p[16] = { x: 0.6, y: 0.3, visibility: 1 };
    expect(analyzePose(p, 'elbow-bends').phase).toBe('neutral');
    const one = bent();
    one[16] = down()[16];
    expect(analyzePose(one, 'elbow-bends').phase).toBe('neutral');
  });
  it('keeps squat-like geometry out of standing movement phases', () => {
    const p = overhead();
    p[25] = { x: 0.25, y: 0.58, visibility: 1 };
    p[26] = { x: 0.75, y: 0.58, visibility: 1 };
    expect(analyzePose(p, 'overhead-reach').phase).toBe('neutral');
    expect(analyzePose(p, 'overhead-reach').score).toBeLessThan(100);
  });
  it.each(['overhead-reach', 'elbow-bends'] as const)(
    'rejects cropped, missing, degenerate and non-finite joints for %s',
    (id) => {
      expect(analyzePose([], id).visible).toBe(false);
      for (const change of [
        (p: Landmark[]) => {
          p[15].y = 0;
        },
        (p: Landmark[]) => {
          p[14].visibility = 0.1;
        },
        (p: Landmark[]) => {
          p[14].visibility = NaN;
        },
        (p: Landmark[]) => {
          p[13].x = NaN;
        },
        (p: Landmark[]) => {
          p[15] = p[13];
        },
      ]) {
        const p = down();
        change(p);
        expect(analyzePose(p, id).visible).toBe(false);
      }
      expect(analyzePose(down(), id, 0).visible).toBe(false);
      // The face is deliberately optional for these arm movement checks.
      expect(analyzePose(down(), id).visible).toBe(true);
    },
  );
  it.each([
    ['overhead-reach', overhead],
    ['elbow-bends', bent],
  ] as const)(
    'handles aspect ratio and mirrored views for %s',
    (id, raised) => {
      const p = raised();
      expect(
        analyzePose(
          p.map((v) => ({ ...v, x: 1 - v.x })),
          id,
        ).phase,
      ).toBe('raised');
      expect(
        analyzePose(
          p.map((v) => ({ ...v, x: v.x / 1.7 })),
          id,
          1.7,
        ).score,
      ).toBe(100);
    },
  );
  it('does not invent automated scores or counts for knee lifts and side steps', () => {
    for (const id of ['knee-lifts', 'side-step']) {
      const result = analyzePose(overhead(), id);
      expect(result.checks).toEqual([]);
      expect(result.phase).toBe('neutral');
    }
  });
});
