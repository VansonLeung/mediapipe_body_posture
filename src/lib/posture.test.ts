import { describe, expect, it } from 'vitest';
import type { Landmark } from './analysis';
import {
  comparePosture,
  defaultMonitorOptions,
  measurePosture,
  PostureMonitorEngine,
} from './posture';
import type { CameraProfile, PostureMeasurement } from './posture';

function upperBody(): Landmark[] {
  const points = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
  }));
  for (const [i, x, y] of [
    [0, 0.5, 0.18],
    [7, 0.43, 0.18],
    [8, 0.57, 0.18],
    [11, 0.36, 0.38],
    [12, 0.64, 0.38],
    [23, 0.38, 0.72],
    [24, 0.62, 0.72],
  ])
    points[i] = { x, y, visibility: 1 };
  return points;
}
const sample = (head = 0): PostureMeasurement => ({
  ready: true,
  values: { head, torso: 0, shoulders: 0, proximity: 0.14 },
  rotation: 0,
  aspect: 1,
});
function calibrated(profile: CameraProfile = 'front') {
  const engine = new PostureMonitorEngine({
    ...defaultMonitorOptions,
    profile,
  });
  engine.calibrate();
  for (let time = 0; time <= 3100; time += 100) engine.step(sample(), time);
  expect(engine.phase).toBe('monitoring');
  return engine;
}
function run(
  engine: PostureMonitorEngine,
  reading: PostureMeasurement | null,
  start: number,
  duration: number,
) {
  for (let time = start + 100; time <= start + duration; time += 100)
    engine.step(reading, time);
}
describe('camera profiles and seated framing', () => {
  it('accepts an upper body without hands, knees, or feet', () => {
    const measured = measurePosture(upperBody(), 1, 'front', 'left');
    expect(measured.ready).toBe(true);
    expect(measured.values.head).toBeCloseTo(0);
    expect(measured.values.torso).toBeCloseTo(0);
  });
  it('keeps head measurements available when hips are obscured', () => {
    const points = upperBody();
    points[23].visibility = 0;
    points[24].visibility = 0;
    const measured = measurePosture(points, 1, 'front', 'left');
    expect(measured.ready).toBe(true);
    expect(measured.values.torso).toBeNull();
    expect(measured.values.head).not.toBeNull();
  });
  it('uses the explicitly selected near side and suspends proximity when perspective cannot be checked', () => {
    const points = upperBody();
    points[8].visibility = 0;
    points[12].visibility = 0;
    points[24].visibility = 0;
    const left = measurePosture(points, 1, 'side', 'left');
    expect(left.ready).toBe(true);
    expect(left.rotation).toBeNull();
    expect(left.values.shoulders).toBeNull();
    expect(measurePosture(points, 1, 'side', 'right').ready).toBe(false);
  });
  it('compares diagonal geometry to its own reference without scoring projected shoulder asymmetry', () => {
    const points = upperBody();
    points[12].y += 0.1;
    const measured = measurePosture(points, 1.5, 'diagonal', 'left');
    const checks = comparePosture(measured, measured, 'diagonal');
    expect(checks.find((c) => c.key === 'shoulders')?.status).toBe(
      'unavailable',
    );
    expect(checks.find((c) => c.key === 'head')?.status).toBe('near');
  });
  it('rejects low-confidence or cropped required anchors', () => {
    const points = upperBody();
    points[7].visibility = 0.2;
    expect(measurePosture(points, 1, 'front', 'left').ready).toBe(false);
    points[7].visibility = 1;
    points[7].x = 1.1;
    expect(measurePosture(points, 1, 'side', 'left').ready).toBe(false);
  });
  it('suspends proximity during rotation rather than interpreting it as camera approach', () => {
    const base = sample();
    const approaching = { ...base, values: { ...base.values, proximity: 0.2 } };
    expect(
      comparePosture(approaching, base, 'front').find(
        (c) => c.key === 'proximity',
      )?.status,
    ).toBe('changed');
    expect(
      comparePosture({ ...approaching, rotation: 0.3 }, base, 'front').find(
        (c) => c.key === 'proximity',
      )?.status,
    ).toBe('unavailable');
  });
});
describe('calibration and sustained reminders', () => {
  it('requires stable framing and restarts calibration after movement or loss', () => {
    const engine = new PostureMonitorEngine();
    engine.calibrate();
    run(engine, sample(), 0, 2000);
    engine.step(sample(30), 2100);
    expect(engine.calibrationUnstable).toBe(true);
    expect(engine.progress).toBeLessThan(10);
    engine.step(null, 2200);
    expect(engine.progress).toBe(0);
    run(engine, sample(), 2200, 3200);
    expect(engine.phase).toBe('monitoring');
  });
  it('handles angles crossing the -180/180 boundary during calibration', () => {
    const engine = new PostureMonitorEngine();
    engine.calibrate();
    for (let time = 0; time <= 3100; time += 100)
      engine.step(sample(time % 200 ? -179 : 179), time);
    expect(engine.phase).toBe('monitoring');
    expect(
      comparePosture(sample(180), engine.reference!, 'front')[0].status,
    ).toBe('near');
  });
  it('waits for a sustained change and respects cooldown', () => {
    const engine = calibrated();
    run(engine, sample(20), 3100, 4800);
    expect(engine.stats.reminders).toBe(0);
    run(engine, sample(20), 7900, 400);
    expect(engine.stats.reminders).toBe(1);
    run(engine, sample(20), 8300, 10000);
    expect(engine.stats.reminders).toBe(1);
    run(engine, sample(20), 18300, 20500);
    expect(engine.stats.reminders).toBe(2);
  });
  it('requires at least eight seconds of diagonal deviation', () => {
    const engine = calibrated('diagonal');
    run(engine, sample(25), 3100, 7500);
    expect(engine.stats.reminders).toBe(0);
    run(engine, sample(25), 10600, 700);
    expect(engine.stats.reminders).toBe(1);
  });
  it('does not carry a pending alert across tracking gaps', () => {
    const engine = calibrated();
    run(engine, sample(20), 3100, 4000);
    engine.step(null, 7200);
    run(engine, sample(20), 7200, 3000);
    expect(engine.stats.reminders).toBe(0);
    expect(engine.stats.gaps).toBeGreaterThan(0);
  });
  it('keeps missing calibrated measurements out of reference time', () => {
    const engine = calibrated();
    const before = engine.stats.near;
    run(
      engine,
      { ...sample(), values: { ...sample().values, torso: null } },
      3100,
      2000,
    );
    expect(engine.stats.near).toBe(before);
    expect(engine.stats.gaps).toBeCloseTo(2);
  });
  it('excludes paused time and stops snoozed or disabled reminders', () => {
    const engine = calibrated();
    const before = engine.stats.duration;
    engine.pause();
    run(engine, sample(25), 3100, 2000);
    expect(engine.stats.duration).toBe(before);
    engine.resume();
    engine.snooze(5100);
    run(engine, sample(25), 5100, 10000);
    expect(engine.stats.reminders).toBe(0);
    engine.snoozeUntil = 0;
    engine.updateOptions({ ...engine.options, reminders: false });
    run(engine, sample(25), 15100, 10000);
    expect(engine.stats.reminders).toBe(0);
  });
  it('requires recalibration after aspect changes and saves each session only once', () => {
    const engine = calibrated();
    engine.step({ ...sample(25), aspect: 1.5 }, 3200);
    expect(engine.needsRecalibration).toBe(true);
    expect(engine.checks.every((c) => c.status === 'unavailable')).toBe(true);
    const record = engine.finish();
    expect(record?.profile).toBe('front');
    expect(engine.finish()).toBeNull();
  });
});
