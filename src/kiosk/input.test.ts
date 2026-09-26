import { describe, it, expect } from 'vitest';
import {
  bodyVisible,
  upperBodyVisible,
  crossedArms,
  DwellSelection,
  KioskInput,
} from './input';
import type { Landmark } from '../analysis/types';
function pose(): Landmark[] {
  const p = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 1,
  }));
  for (const [i, x, y] of [
    [11, 0.4, 0.3],
    [12, 0.6, 0.3],
    [13, 0.4, 0.45],
    [14, 0.6, 0.45],
    [15, 0.4, 0.65],
    [16, 0.6, 0.65],
    [23, 0.43, 0.6],
    [24, 0.57, 0.6],
    [27, 0.43, 0.9],
    [28, 0.57, 0.9],
  ])
    p[i] = { x, y, visibility: 1 };
  return p;
}
describe('kiosk camera commands', () => {
  it('maps either raised hand to a mirrored, bounded pointer and retains the active hand', () => {
    const input = new KioskInput(),
      p = pose();
    expect(input.update(p, 100, true, false).pointer).toBeNull();
    p[15] = { x: 0.3, y: 0.3, visibility: 1 };
    const first = input.update(p, 200, true, false).pointer!;
    expect(first.x).toBeGreaterThan(0.5);
    p[16] = { x: 0.8, y: 0.25, visibility: 1 };
    expect(input.update(p, 300, true, false).pointer).toEqual(first);
    p[15].y = 0.7;
    expect(input.update(p, 400, true, false).pointer!.x).toBeLessThan(0.5);
    p[16].visibility = 0.1;
    expect(input.update(p, 500, true, false).pointer).toBeNull();
  });
  it('never produces a menu cursor while exercising, and rejects missing or degenerate bodies', () => {
    const input = new KioskInput(),
      p = pose();
    p[16].y = 0.2;
    expect(input.update(p, 100, false, true).pointer).toBeNull();
    expect(input.update([], 200, true, false).pointer).toBeNull();
    p[12].x = p[11].x;
    expect(input.update(p, 300, true, false).pointer).toBeNull();
    expect(bodyVisible([])).toBe(false);
  });
  it('supports chest-up and seated navigation without relying on inferred lower-body points', () => {
    const p = pose();
    p[16] = { x: 0.35, y: 0.28, visibility: 1 };
    const full = new KioskInput().update(p, 100, true, false).pointer;
    for (let i = 23; i < 33; i++) p[i] = { x: NaN, y: 1.5, visibility: 0 };
    expect(upperBodyVisible(p)).toBe(true);
    expect(bodyVisible(p)).toBe(false);
    const input = new KioskInput();
    expect(input.update(p, 100, true, false).pointer).toEqual(full);
    expect(input.update(p, 200, false, true).pointer).toBeNull();
    p[16].visibility = 0;
    expect(input.update(p, 300, true, false).pointer).toBeNull();
    p[11].visibility = 0;
    expect(upperBodyVisible(p)).toBe(false);
    expect(input.update(p, 400, true, false).pointer).toBeNull();
  });
  it('reaches all screen edges within the central portion of the close-up hand area', () => {
    const p = pose();
    p[11] = { x: 0.25, y: 0.4, visibility: 1 };
    p[12] = { x: 0.75, y: 0.4, visibility: 1 };
    p[15].visibility = 0;
    for (let i = 23; i < 33; i++) p[i].visibility = 0;
    for (const [x, y, expectedX, expectedY] of [
      [0.2, 0.2, 0.98, 0.02],
      [0.8, 0.2, 0.02, 0.02],
      [0.2, 0.8, 0.98, 0.98],
      [0.8, 0.8, 0.02, 0.98],
    ]) {
      p[16] = { x, y, visibility: 1 };
      expect(new KioskInput().update(p, 100, true, false).pointer).toEqual({
        x: expectedX,
        y: expectedY,
      });
    }
  });
  it('requires sustained crossed arms to pause, fires once, and hides the menu cursor until released', () => {
    const input = new KioskInput(),
      p = pose();
    p[15] = { x: 0.6, y: 0.37, visibility: 1 };
    p[16] = { x: 0.4, y: 0.37, visibility: 1 };
    expect(crossedArms(p)).toBe(true);
    for (let time = 100; time < 1900; time += 100)
      expect(input.update(p, time, false, true).pause).toBe(false);
    expect(input.update(p, 1900, false, true).pause).toBe(true);
    expect(input.update(p, 2000, false, true).pause).toBe(false);
    expect(input.update(p, 2100, true, false).pointer).toBeNull();
    input.update(pose(), 2200, true, false);
    expect(input.update(p, 2300, false, true).pauseProgress).toBe(0);
  });
  it('does not interpret overhead reaches or elbow bends as crossed arms and resets on tracking gaps', () => {
    const input = new KioskInput(),
      p = pose();
    p[15].y = 0.1;
    p[16].y = 0.1;
    expect(crossedArms(p)).toBe(false);
    p[15].y = 0.3;
    p[16].y = 0.3;
    expect(crossedArms(p)).toBe(false);
    p[15].x = 0.6;
    p[16].x = 0.4;
    input.update(p, 100, false, true);
    input.update(p, 200, false, true);
    expect(input.update(p, 1000, false, true).pauseProgress).toBe(0);
  });
});
describe('hold-to-select', () => {
  it('fires once per dwell and requires a release even if a new button appears underneath', () => {
    const dwell = new DwellSelection();
    for (let time = 100; time < 1500; time += 100)
      expect(dwell.update('start', time).action).toBeNull();
    expect(dwell.update('start', 1500).action).toBe('start');
    for (let time = 1600; time < 4000; time += 100)
      expect(dwell.update('next', time).action).toBeNull();
    for (let time = 4000; time <= 4400; time += 100) dwell.update(null, time);
    for (let time = 4500; time < 5900; time += 100)
      expect(dwell.update('next', time).action).toBeNull();
    expect(dwell.update('next', 5900).action).toBe('next');
  });
  it('discards partial progress after target changes or a stalled camera', () => {
    const dwell = new DwellSelection();
    for (let time = 100; time <= 1000; time += 100) dwell.update('a', time);
    expect(dwell.update('b', 1100).progress).toBe(0);
    expect(dwell.update('b', 2000).progress).toBe(0);
    expect(dwell.update(null, 2100).progress).toBe(0);
    expect(dwell.update('b', 2200).progress).toBe(0);
  });
});
