import type { Landmark } from './analysis';

export type CameraProfile = 'front' | 'side' | 'diagonal';
export type CameraSide = 'left' | 'right';
export type PostureMetric = 'head' | 'torso' | 'shoulders' | 'proximity';
export const metricKeys: PostureMetric[] = [
  'head',
  'torso',
  'shoulders',
  'proximity',
];
export type Readings = Record<PostureMetric, number | null>;
export interface PostureMeasurement {
  ready: boolean;
  values: Readings;
  rotation: number | null;
  aspect: number;
}
export const emptyReadings = (): Readings => ({
  head: null,
  torso: null,
  shoulders: null,
  proximity: null,
});
const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI;
const angularDelta = (a: number, b: number) => ((a - b + 540) % 360) - 180;
const distance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Landmark, b: Landmark): Landmark => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

// These are changes in image geometry, not anatomical or clinical angles.
export function measurePosture(
  points: Landmark[],
  aspect: number,
  profile: CameraProfile,
  side: CameraSide,
): PostureMeasurement {
  const visible = (i: number) => {
    const p = points[i];
    return (
      !!p &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      (p.visibility ?? 0) >= 0.6 &&
      p.x > 0.015 &&
      p.x < 0.985 &&
      p.y > 0.015 &&
      p.y < 0.985
    );
  };
  const has = (...indices: number[]) => indices.every(visible);
  const p = points.map((point) => ({ ...point, x: point.x * aspect }));
  const values = emptyReadings();
  const ear = side === 'left' ? 7 : 8,
    shoulder = side === 'left' ? 11 : 12,
    hip = side === 'left' ? 23 : 24;
  const ready =
    Number.isFinite(aspect) &&
    aspect > 0 &&
    (profile === 'front' ? has(0, 7, 8, 11, 12) : has(0, ear, shoulder));
  if (!ready) return { ready: false, values, rotation: null, aspect };
  const verticalAngle = (top: Landmark, bottom: Landmark) =>
    radiansToDegrees(Math.atan2(top.x - bottom.x, bottom.y - top.y));
  let rotation: number | null = null;
  if (profile === 'front') {
    const faceWidth = distance(p[7], p[8]);
    if (faceWidth < 0.025)
      return { ready: false, values, rotation: null, aspect };
    values.head = radiansToDegrees(
      Math.atan2(p[8].y - p[7].y, p[8].x - p[7].x),
    );
    values.shoulders = radiansToDegrees(
      Math.atan2(p[12].y - p[11].y, p[12].x - p[11].x),
    );
    if (has(23, 24))
      values.torso = verticalAngle(
        midpoint(p[11], p[12]),
        midpoint(p[23], p[24]),
      );
    values.proximity = faceWidth;
    // Nose offset relative to the ears changes when the face turns.
    rotation = (p[0].x - midpoint(p[7], p[8]).x) / faceWidth;
  } else {
    const headSpan = distance(p[0], p[ear]);
    if (headSpan < 0.02 || distance(p[ear], p[shoulder]) < 0.025)
      return { ready: false, values, rotation: null, aspect };
    values.head = verticalAngle(p[ear], p[shoulder]);
    if (has(hip)) values.torso = verticalAngle(p[shoulder], p[hip]);
    values.proximity = headSpan;
    // Proximity is suspended if we cannot cross-check changing perspective.
    if (has(11, 12)) rotation = distance(p[11], p[12]) / headSpan;
  }
  return { ready, values, rotation, aspect };
}

export interface PostureReference {
  values: Readings;
  rotation: number | null;
  aspect: number;
}
export interface PostureCheck {
  key: PostureMetric;
  status: 'near' | 'changed' | 'unavailable';
  delta: number | null;
  threshold: number;
}
const thresholds: Record<CameraProfile, Readings> = {
  front: { head: 10, torso: 8, shoulders: 8, proximity: 20 },
  side: { head: 12, torso: 10, shoulders: null, proximity: 25 },
  diagonal: { head: 15, torso: 13, shoulders: null, proximity: 35 },
};
export function comparePosture(
  measurement: PostureMeasurement | null,
  reference: PostureReference,
  profile: CameraProfile,
  flexibility = 1,
): PostureCheck[] {
  return metricKeys.map((key) => {
    const threshold = (thresholds[profile][key] ?? 0) * flexibility;
    const target = reference.values[key],
      current = measurement?.values[key];
    const unavailable: PostureCheck = {
      key,
      status: 'unavailable',
      delta: null,
      threshold,
    };
    if (!measurement?.ready || target == null || current == null || !threshold)
      return unavailable;
    if (Math.abs(measurement.aspect / reference.aspect - 1) > 0.05)
      return unavailable;
    if (key === 'proximity') {
      if (
        reference.rotation === null ||
        measurement.rotation === null ||
        target <= 0
      )
        return unavailable;
      const rotationLimit =
        profile === 'front'
          ? 0.13
          : Math.max(0.2, Math.abs(reference.rotation) * 0.22);
      if (Math.abs(measurement.rotation - reference.rotation) > rotationLimit)
        return unavailable;
    }
    const delta =
      key === 'proximity'
        ? (current / target - 1) * 100
        : angularDelta(current, target);
    return {
      key,
      delta,
      threshold,
      status:
        (key === 'proximity' ? delta : Math.abs(delta)) > threshold
          ? 'changed'
          : 'near',
    };
  });
}

export interface MonitorOptions {
  profile: CameraProfile;
  side: CameraSide;
  reminders: boolean;
  enabled: Record<PostureMetric, boolean>;
  sustain: number;
  cooldown: number;
  flexibility: number;
}
export const defaultMonitorOptions: MonitorOptions = {
  profile: 'front',
  side: 'left',
  reminders: true,
  enabled: { head: true, torso: true, shoulders: true, proximity: true },
  sustain: 5,
  cooldown: 30,
  flexibility: 1,
};
export interface ReminderEvent {
  key: PostureMetric;
  at: number;
}
export interface MonitorStats {
  duration: number;
  tracked: number;
  near: number;
  gaps: number;
  reminders: number;
  events: ReminderEvent[];
}
export interface MonitorRecord extends MonitorStats {
  id: string;
  date: string;
  profile: CameraProfile;
  side: CameraSide;
}
export type MonitorPhase =
  'idle' | 'calibrating' | 'monitoring' | 'paused' | 'finished';
const newStats = (): MonitorStats => ({
  duration: 0,
  tracked: 0,
  near: 0,
  gaps: 0,
  reminders: 0,
  events: [],
});
const median = (items: number[]) => {
  const sorted = [...items].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

export class PostureMonitorEngine {
  phase: MonitorPhase = 'idle';
  reference: PostureReference | null = null;
  checks: PostureCheck[] = [];
  stats = newStats();
  progress = 0;
  ready = false;
  calibrationUnstable = false;
  needsRecalibration = false;
  snoozeUntil = 0;
  lastReminder: ReminderEvent | null = null;
  private samples: PostureMeasurement[] = [];
  private lastTime: number | null = null;
  private calibratedFor = 0;
  private pending = new Map<PostureMetric, number>();
  private lastAlert = -Infinity;
  constructor(public options: MonitorOptions = { ...defaultMonitorOptions }) {}

  calibrate() {
    this.phase = 'calibrating';
    this.reference = null;
    this.samples = [];
    this.calibratedFor = 0;
    this.progress = 0;
    this.checks = [];
    this.stats = newStats();
    this.lastTime = null;
    this.pending.clear();
    this.lastAlert = -Infinity;
    this.lastReminder = null;
    this.needsRecalibration = false;
    this.snoozeUntil = 0;
  }
  pause() {
    if (this.phase === 'monitoring') {
      this.phase = 'paused';
      this.pending.clear();
      this.lastTime = null;
    }
  }
  resume() {
    if (this.phase === 'paused') {
      this.phase = 'monitoring';
      this.lastTime = null;
    }
  }
  snooze(now: number, seconds = 300) {
    this.snoozeUntil = now + seconds * 1000;
    this.pending.clear();
  }
  updateOptions(options: MonitorOptions) {
    this.options = options;
    this.pending.clear();
  }
  step(
    measurement: PostureMeasurement | null,
    now: number,
  ): ReminderEvent | null {
    const rawDelta =
      this.lastTime === null ? 0 : Math.max(0, (now - this.lastTime) / 1000);
    const dt = rawDelta <= 0.6 ? rawDelta : 0;
    this.lastTime = now;
    this.ready = !!measurement?.ready;
    if (rawDelta > 0.6) {
      this.pending.clear();
      this.samples = [];
      this.calibratedFor = 0;
    }
    if (this.phase === 'calibrating') {
      if (!measurement?.ready) {
        this.samples = [];
        this.calibratedFor = 0;
        this.progress = 0;
        this.calibrationUnstable = false;
        return null;
      }
      const first = this.samples[0];
      const stable =
        !first ||
        metricKeys.every((key) => {
          const a = first.values[key],
            b = measurement.values[key];
          return (
            a === null ||
            b === null ||
            (key === 'proximity'
              ? Math.abs(b / a - 1) < 0.08
              : Math.abs(angularDelta(b, a)) < 4)
          );
        });
      if (!stable) {
        this.samples = [];
        this.calibratedFor = 0;
      }
      this.calibrationUnstable = !stable;
      this.samples.push(measurement);
      this.calibratedFor += dt;
      this.progress = Math.min(100, (this.calibratedFor / 3) * 100);
      if (this.calibratedFor >= 3 && this.samples.length >= 15) {
        const values = emptyReadings();
        for (const key of metricKeys) {
          const available = this.samples
            .map((s) => s.values[key])
            .filter((v): v is number => v !== null);
          if (available.length >= this.samples.length * 0.8) {
            const origin = available[0];
            values[key] =
              key === 'proximity'
                ? median(available)
                : origin +
                  median(available.map((value) => angularDelta(value, origin)));
          }
        }
        const rotations = this.samples
          .map((s) => s.rotation)
          .filter((v): v is number => v !== null);
        this.reference = {
          values,
          rotation:
            rotations.length >= this.samples.length * 0.8
              ? median(rotations)
              : null,
          aspect: measurement.aspect,
        };
        this.phase = 'monitoring';
        this.samples = [];
        this.pending.clear();
      }
      return null;
    }
    if (!this.reference) return null;
    this.checks = comparePosture(
      measurement,
      this.reference,
      this.options.profile,
      this.options.flexibility,
    );
    if (
      measurement?.ready &&
      Math.abs(measurement.aspect / this.reference.aspect - 1) > 0.05
    )
      this.needsRecalibration = true;
    if (this.phase !== 'monitoring') return null;
    const available = this.checks.filter((c) => c.status !== 'unavailable');
    const complete =
      available.length > 0 &&
      this.checks.every(
        (c) =>
          this.reference!.values[c.key] === null ||
          (c.key === 'proximity' && this.reference!.rotation === null) ||
          c.status !== 'unavailable',
      );
    this.stats.duration += dt;
    if (complete && !this.needsRecalibration) {
      this.stats.tracked += dt;
      if (available.every((c) => c.status === 'near')) this.stats.near += dt;
    } else this.stats.gaps += dt;
    const canAlert =
      this.options.reminders &&
      now >= this.snoozeUntil &&
      !this.needsRecalibration;
    for (const check of this.checks) {
      if (
        canAlert &&
        this.options.enabled[check.key] &&
        check.status === 'changed'
      )
        this.pending.set(check.key, (this.pending.get(check.key) ?? 0) + dt);
      else this.pending.delete(check.key);
    }
    const sustain =
      this.options.profile === 'diagonal'
        ? Math.max(8, this.options.sustain)
        : this.options.sustain;
    const candidate = this.checks.find(
      (c) => (this.pending.get(c.key) ?? 0) >= sustain,
    );
    if (candidate && now - this.lastAlert >= this.options.cooldown * 1000) {
      const event = { key: candidate.key, at: this.stats.duration };
      this.lastAlert = now;
      this.lastReminder = event;
      this.stats.reminders++;
      this.stats.events = [...this.stats.events, event].slice(-100);
      this.pending.clear();
      return event;
    }
    return null;
  }
  finish(): MonitorRecord | null {
    const wasActive = this.phase === 'monitoring' || this.phase === 'paused';
    this.phase = 'finished';
    this.pending.clear();
    return wasActive && this.stats.duration > 0
      ? {
          ...this.stats,
          events: [...this.stats.events],
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          profile: this.options.profile,
          side: this.options.side,
        }
      : null;
  }
}
