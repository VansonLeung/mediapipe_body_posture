import { describe, expect, it } from 'vitest';
import { availableExercises } from '../catalog';
import { getIllustration } from '../catalog/assets';
import type { Illustration } from '../catalog/assets';
import { tweenIllustration } from './illustrationTween';

describe('illustration animation', () => {
  it('rotates limbs without collapsing their length between poses', () => {
    const from: Illustration = {
      kind: 'lines',
      head: [0, 0],
      lines: ['0,0 0,10', '0,0 0,10 0,20'],
    };
    const to: Illustration = {
      kind: 'lines',
      head: [10, 10],
      lines: ['0,0 0,10', '0,0 10,0 20,0'],
    };
    const middle = tweenIllustration(from, to, 0.5);
    expect(middle.head).toEqual([5, 5]);
    if (middle.kind !== 'lines') throw new Error('Expected line geometry');
    const p = middle.lines[1]
      .split(' ')
      .map((pair) => pair.split(',').map(Number));
    expect(Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1])).toBeCloseTo(10, 2);
    expect(Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1])).toBeCloseTo(10, 2);
    expect(tweenIllustration(from, to, 0)).toBe(from);
    expect(tweenIllustration(from, to, 1)).toBe(to);
  });
  it('handles every published frame transition, including loop closure and different torso shapes', () => {
    for (const exercise of availableExercises) {
      const frames =
        getIllustration(exercise.data.presentation.illustration)?.frames ?? [];
      const original = JSON.stringify(frames);
      frames.forEach((from, i) => {
        const to = frames[(i + 1) % frames.length];
        for (const progress of [0.1, 0.5, 0.9]) {
          const result = tweenIllustration(from, to, progress);
          expect(result.head.every(Number.isFinite)).toBe(true);
          expect(JSON.stringify(result)).not.toMatch(
            /NaN|Infinity|undefined|null/,
          );
          expect(result.kind).toBe(from.kind);
        }
      });
      expect(JSON.stringify(frames)).toBe(original);
    }
  });
  it('fades optional diagram annotations in and out instead of moving a limb into an arrow', () => {
    const from: Illustration = {
      kind: 'lines',
      head: [0, 0],
      lines: ['0,0 0,10'],
    };
    const to: Illustration = { ...from, lines: [...from.lines, '10,10 20,20'] };
    expect(tweenIllustration(from, to, 0.5).lineOpacities).toEqual([1, 0.5]);
    expect(tweenIllustration(to, from, 0.5).lineOpacities).toEqual([1, 0.5]);
  });
});
