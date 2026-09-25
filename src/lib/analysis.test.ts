import { describe, expect, it } from 'vitest';
import {
  analyzePose,
  angle,
  blankAnalysis,
  formatTime,
  RepCounter,
} from './analysis';
import type { Landmark } from './analysis';
import { deriveNeckLandmarks, tweenLandmarks } from './poseTween';
function warrior(): Landmark[] {
  const p = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 1,
  }));
  const coords: Record<number, [number, number]> = {
    0: [0.5, 0.1],
    11: [0.4, 0.3],
    12: [0.6, 0.3],
    13: [0.25, 0.3],
    14: [0.75, 0.3],
    15: [0.08, 0.3],
    16: [0.92, 0.3],
    23: [0.43, 0.55],
    24: [0.57, 0.55],
    25: [0.27, 0.55],
    26: [0.7, 0.71],
    27: [0.27, 0.88],
    28: [0.83, 0.88],
  };
  for (const [i, [x, y]] of Object.entries(coords))
    p[Number(i)] = { x, y, visibility: 1 };
  return p;
}
describe('visible alignment', () => {
  it('recognizes an aligned Warrior II and gives an actionable cue for a lowered arm', () => {
    expect(analyzePose(warrior(), 'warrior').score).toBe(100);
    const p = warrior();
    p[13] = { x: 0.4, y: 0.45, visibility: 1 };
    p[15] = { x: 0.4, y: 0.6, visibility: 1 };
    const result = analyzePose(p, 'warrior');
    expect(result.score).toBe(75);
    expect(result.cue).toContain('shoulder height');
  });
  it('handles missing, cropped, and low confidence bodies without assigning a score', () => {
    expect(analyzePose([], 'warrior').visible).toBe(false);
    const p = warrior();
    p[27].visibility = 0.2;
    expect(analyzePose(p, 'warrior').visible).toBe(false);
    p[27].visibility = 1;
    p[15].x = 1.1;
    expect(analyzePose(p, 'warrior').visible).toBe(false);
  });
  it('corrects the video aspect ratio before computing angles', () => {
    const original = analyzePose(warrior(), 'warrior');
    const stretched = analyzePose(
      warrior().map((p) => ({ ...p, x: p.x / 1.77 })),
      'warrior',
      1.77,
    );
    expect(stretched.score).toBe(original.score);
    expect(stretched.angles.leftKnee).toBeCloseTo(original.angles.leftKnee);
  });
  it('treats mirrored left/right positions symmetrically', () => {
    expect(
      analyzePose(
        warrior().map((p) => ({ ...p, x: 1 - p.x })),
        'warrior',
      ).score,
    ).toBe(100);
  });
  it('requires a lifted foot near the standing leg for Tree pose', () => {
    const p = warrior();
    for (const [i, x, y] of [
      [23, 0.46, 0.55],
      [25, 0.46, 0.7],
      [27, 0.46, 0.9],
      [24, 0.56, 0.55],
      [26, 0.72, 0.67],
      [28, 0.48, 0.77],
    ])
      p[i] = { x, y, visibility: 1 };
    expect(analyzePose(p, 'tree').score).toBe(100);
    p[28] = { x: 0.8, y: 0.9, visibility: 1 };
    expect(
      analyzePose(p, 'tree').checks.find((c) => c.label === 'Raised foot')
        ?.good,
    ).toBe(false);
  });
  it('reports movement endpoints for arm raises', () => {
    const p = warrior();
    expect(analyzePose(p, 'arms').phase).toBe('raised');
    for (const [i, x, y] of [
      [11, 0.4, 0.3],
      [12, 0.6, 0.3],
      [23, 0.4, 0.55],
      [24, 0.6, 0.55],
      [13, 0.4, 0.43],
      [14, 0.6, 0.43],
      [15, 0.4, 0.57],
      [16, 0.6, 0.57],
    ])
      p[i] = { x, y, visibility: 1 };
    expect(analyzePose(p, 'arms').phase).toBe('lowered');
  });
  it('handles degenerate points without NaN and formats elapsed time', () => {
    expect(angle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(0);
    expect(formatTime(125.9)).toBe('02:05');
  });
});
describe('controlled repetition counting', () => {
  const ready = {
    ...blankAnalysis,
    visible: true,
    score: 100,
    phase: 'lowered' as const,
  };
  const raised = { ...ready, phase: 'raised' as const };
  it('counts only after a full lower → raise → lower cycle', () => {
    const counter = new RepCounter();
    expect(counter.update(raised)).toBe(0);
    expect(counter.update(ready)).toBe(0);
    counter.update(raised);
    counter.update(raised);
    expect(counter.update(ready)).toBe(1);
    expect(counter.update(ready)).toBe(1);
  });
  it('does not count movements interrupted by poor tracking or alignment', () => {
    const counter = new RepCounter();
    counter.update(ready);
    counter.update(raised);
    counter.update(blankAnalysis);
    expect(counter.update(ready)).toBe(0);
    counter.update(raised);
    counter.update({ ...raised, score: 67 });
    expect(counter.update(ready)).toBe(0);
  });
  it('invalidates an incomplete rep after seeking', () => {
    const counter = new RepCounter();
    counter.update(ready);
    counter.update(raised);
    counter.resetStage();
    expect(counter.update(ready)).toBe(0);
  });
  it('records a complete visible movement separately from alignment quality', () => {
    const counter = new RepCounter();
    counter.update(ready);
    counter.update({ ...raised, score: 67 });
    counter.update(ready);
    expect(counter.movements).toBe(1);
    expect(counter.count).toBe(0);
    counter.update(raised);
    counter.update(ready);
    expect(counter.movements).toBe(2);
    expect(counter.count).toBe(1);
  });
  it('does not invent a completed movement across tracking loss or a seek', () => {
    const counter = new RepCounter();
    counter.update(ready);
    counter.update(raised);
    counter.update(blankAnalysis);
    counter.update(ready);
    expect(counter.movements).toBe(0);
    counter.update(raised);
    counter.resetStage();
    counter.update(ready);
    expect(counter.movements).toBe(0);
  });
});

describe('skeleton keypoint tweening', () => {
  const from: Landmark[] = [{ x: 0, y: 0.25, z: -0.2, visibility: 0.6 }];
  const to: Landmark[] = [{ x: 1, y: 0.75, z: 0.2, visibility: 1 }];

  it('keeps the endpoints exact and eases intermediate movement', () => {
    expect(tweenLandmarks(from, to, 0)).toEqual(from);
    expect(tweenLandmarks(from, to, 1)).toEqual(to);
    const halfway = tweenLandmarks(from, to, 0.5)[0];
    expect(halfway.x).toBeGreaterThan(0.5);
    expect(halfway.x).toBeLessThan(1);
    expect(halfway.y).toBeGreaterThan(0.5);
  });

  it('clamps progress and safely adopts a changed landmark set', () => {
    expect(tweenLandmarks(from, to, -1)).toEqual(from);
    expect(tweenLandmarks(from, to, 2)).toEqual(to);
    expect(tweenLandmarks([], to, 0.5)).toEqual(to);
    expect(tweenLandmarks([], to, 0.5)).not.toBe(to);
  });

  it('derives a visible neck between the face and shoulders', () => {
    const points = warrior();
    points[9] = { x: 0.48, y: 0.2, z: -0.1, visibility: 0.9 };
    points[10] = { x: 0.52, y: 0.2, z: -0.1, visibility: 0.8 };
    const neck = deriveNeckLandmarks(points);

    expect(neck?.base.x).toBeCloseTo(0.5);
    expect(neck?.base.y).toBeCloseTo(0.3);
    expect(neck?.top.y).toBeGreaterThan(0.2);
    expect(neck?.top.y).toBeLessThan(neck?.base.y ?? 0);
    expect(neck?.base.visibility).toBe(0.8);
  });
});
