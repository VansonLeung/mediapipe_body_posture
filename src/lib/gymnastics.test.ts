import { describe, expect, it } from 'vitest';
import { analyzePose } from './analysis';
import type { Landmark } from './analysis';
import { exercises, getExercise, localizeExercise } from '../catalog';
import { parseRoutines } from './routines';

function pose(coords: Record<number, [number, number]>): Landmark[] {
  const points = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    visibility: 0,
  }));
  for (const [id, [x, y]] of Object.entries(coords))
    points[Number(id)] = { x, y, visibility: 1 };
  return points;
}
const standing = () =>
  pose({
    11: [0.4, 0.2],
    12: [0.6, 0.2],
    23: [0.43, 0.45],
    24: [0.57, 0.45],
    25: [0.43, 0.65],
    26: [0.57, 0.65],
    27: [0.43, 0.87],
    28: [0.57, 0.87],
  });
const pike = () =>
  pose({ 11: [0.3, 0.25], 23: [0.3, 0.6], 25: [0.55, 0.6], 27: [0.8, 0.6] });
const plank = () =>
  pose({
    11: [0.25, 0.4],
    13: [0.25, 0.6],
    15: [0.25, 0.8],
    23: [0.5, 0.4],
    25: [0.65, 0.4],
    27: [0.8, 0.4],
  });

describe('gymnastics catalogue boundaries', () => {
  it('has 32 scoped chart entries, separate arch/bridge, and no rolls, apparatus or sequence exercise', () => {
    expect(
      exercises.filter((e) => e.data.source.kind === 'ai-generated-reference'),
    ).toHaveLength(32);
    expect(new Set(exercises.map((e) => e.id)).size).toBe(exercises.length);
    expect(exercises.filter((e) => e.support === 'automatic')).toHaveLength(12);
    expect(getExercise('arch')).not.toEqual(getExercise('bridge'));
    expect(
      exercises.some((e) => /roll|vault|apparatus|sequence/i.test(e.name)),
    ).toBe(false);
    expect(
      exercises.every(
        (e) =>
          localizeExercise(e, 'zh-Hant').steps.length > 0 &&
          e.zh.name !== e.name,
      ),
    ).toBe(true);
  });
  it('does not run a side-bend fallback on review-only exercises', () => {
    for (const e of exercises.filter((e) => e.support === 'review')) {
      const result = analyzePose(standing(), e.id);
      expect(result.checks).toEqual([]);
      expect(result.phase).toBe('neutral');
      expect(result.score).toBe(0);
    }
  });
});

describe('limited gymnastics shape checks', () => {
  it('checks standing legs without requiring face or wrists', () => {
    expect(analyzePose(standing(), 'standing-balance').score).toBe(100);
    const p = standing();
    p[28].y = 0.7;
    expect(analyzePose(p, 'standing-balance').score).toBeLessThan(100);
  });
  it('accepts a lifted foot away from the standing leg, unlike Tree pose', () => {
    const p = standing();
    p[26] = { x: 0.73, y: 0.52, visibility: 1 };
    p[28] = { x: 0.76, y: 0.68, visibility: 1 };
    expect(analyzePose(p, 'one-leg-balance').score).toBe(100);
    expect(analyzePose(standing(), 'one-leg-balance').score).toBeLessThan(100);
  });
  it('checks a compact tuck and rejects an extended seated leg', () => {
    const p = pose({
      11: [0.35, 0.3],
      23: [0.35, 0.65],
      25: [0.5, 0.35],
      27: [0.5, 0.68],
    });
    expect(analyzePose(p, 'tuck').score).toBe(100);
    expect(analyzePose(pike(), 'tuck').score).toBeLessThan(100);
  });
  it('uses a visible side chain for pike and rejects standing or bent-leg substitutes', () => {
    expect(analyzePose(pike(), 'pike').score).toBe(100);
    expect(analyzePose(standing(), 'pike').score).toBeLessThan(100);
    const p = pike();
    p[25].y = 0.42;
    expect(analyzePose(p, 'pike').score).toBeLessThan(100);
    p[25].visibility = 0.2;
    expect(analyzePose(p, 'pike').visible).toBe(false);
  });
  it('distinguishes a seated straddle from an upright standing stance', () => {
    const p = pose({
      11: [0.4, 0.25],
      12: [0.6, 0.25],
      23: [0.45, 0.55],
      24: [0.55, 0.55],
      25: [0.27, 0.6],
      26: [0.73, 0.6],
      27: [0.09, 0.65],
      28: [0.91, 0.65],
    });
    expect(analyzePose(p, 'straddle').score).toBe(100);
    expect(analyzePose(standing(), 'straddle').score).toBeLessThan(100);
  });
  it('requires plank body alignment and a visible supporting arm', () => {
    expect(analyzePose(plank(), 'plank').score).toBe(100);
    const p = plank();
    p[23].y = 0.65;
    expect(analyzePose(p, 'plank').score).toBeLessThan(100);
    p[15].visibility = 0.1;
    expect(analyzePose(p, 'plank').visible).toBe(false);
  });
  it('preserves aspect correction, mirroring and side selection', () => {
    const p = plank();
    expect(
      analyzePose(
        p.map((v) => ({ ...v, x: v.x / 1.7 })),
        'plank',
        1.7,
      ).score,
    ).toBe(100);
    expect(
      analyzePose(
        p.map((v) => ({ ...v, x: 1 - v.x })),
        'plank',
      ).score,
    ).toBe(100);
    const right = pose({});
    for (const id of [11, 13, 15, 23, 25, 27]) right[id + 1] = p[id];
    expect(analyzePose(right, 'plank').score).toBe(100);
    right[24].x = NaN;
    expect(analyzePose(right, 'plank').visible).toBe(false);
  });
});

describe('saved combinations', () => {
  it('preserves order and repeated movements with per-step targets', () => {
    const r = {
      id: 'r',
      name: 'Balance and travel',
      steps: [
        { exercise: 'standing-balance', target: 3 },
        { exercise: 'walk', target: 0 },
        { exercise: 'standing-balance', target: 8 },
      ],
    };
    expect(parseRoutines(JSON.stringify([r]))).toEqual([r]);
  });
  it('rejects invalid targets, empty sequences and corrupt storage', () => {
    for (const steps of [
      [],
      [{ exercise: 'walk', target: 5 }],
      [{ exercise: 'plank', target: -1 }],
      [{ exercise: 'plank', target: 1.5 }],
    ]) {
      expect(
        parseRoutines(JSON.stringify([{ id: 'r', name: 'Routine', steps }])),
      ).toEqual([]);
    }
    expect(parseRoutines('{')).toEqual([]);
  });
});
