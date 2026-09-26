import type { Landmark } from '../analysis/types';

export interface Pointer {
  x: number;
  y: number;
}
export const DWELL_MS = 1400;
export const PAUSE_MS = 1800;
const valid = (p: Landmark | undefined): p is Landmark =>
  !!p &&
  Number.isFinite(p.x) &&
  Number.isFinite(p.y) &&
  p.x >= 0 &&
  p.x <= 1 &&
  p.y >= 0 &&
  p.y <= 1 &&
  (p.visibility ?? 0) >= 0.65;

// Upper-body presence and navigation do not require hips or legs.
export function upperBodyVisible(points: Landmark[]) {
  return (
    [11, 12].every((i) => valid(points[i])) &&
    Math.abs(points[11].x - points[12].x) >= 0.06
  );
}

export function bodyVisible(points: Landmark[]) {
  return [11, 12, 23, 24, 27, 28].every((i) => valid(points[i]));
}

export function crossedArms(points: Landmark[]) {
  if (![11, 12, 13, 14, 15, 16, 23, 24].every((i) => valid(points[i])))
    return false;
  const [left, right, lw, rw] = [
    points[11],
    points[12],
    points[15],
    points[16],
  ];
  const span = Math.abs(left.x - right.x);
  const shoulderY = (left.y + right.y) / 2;
  const torso = (points[23].y + points[24].y) / 2 - shoulderY;
  if (span < 0.06 || torso < 0.08) return false;
  return (
    Math.abs(lw.x - right.x) < span * 0.4 &&
    Math.abs(rw.x - left.x) < span * 0.4 &&
    [lw, rw].every(
      (p) => p.y > shoulderY - torso * 0.15 && p.y < shoulderY + torso * 0.65,
    )
  );
}

// A selection fires once. Leave all targets (or lower the hand) before rearming.
export class DwellSelection {
  private target: string | null = null;
  private since = 0;
  private last = 0;
  private latched = false;
  private releasedAt: number | null = null;
  reset() {
    this.target = null;
    this.last = 0;
    this.latched = false;
    this.releasedAt = null;
  }
  update(target: string | null, now: number) {
    if (!Number.isFinite(now)) {
      this.reset();
      return { progress: 0, action: null };
    }
    if (now < this.last || now - this.last > 300) this.target = null;
    this.last = now;
    if (!target) {
      this.target = null;
      this.releasedAt ??= now;
      if (now - this.releasedAt >= 300) this.latched = false;
      return { progress: 0, action: null };
    }
    this.releasedAt = null;
    if (this.latched) return { progress: 0, action: null };
    if (target !== this.target) {
      this.target = target;
      this.since = now;
    }
    const progress = Math.min(1, (now - this.since) / DWELL_MS);
    if (progress < 1) return { progress, action: null };
    this.latched = true;
    return { progress: 1, action: target };
  }
}

export class KioskInput {
  private hand: 15 | 16 | null = null;
  private pointer: Pointer | null = null;
  private last = 0;
  private pauseSince: number | null = null;
  private pauseFired = false;
  reset() {
    this.hand = null;
    this.pointer = null;
    this.last = 0;
    this.pauseSince = null;
    this.pauseFired = false;
  }
  update(
    points: Landmark[],
    now: number,
    navigation: boolean,
    canPause: boolean,
  ) {
    if (!Number.isFinite(now) || now < this.last || now - this.last > 300)
      this.reset();
    const delta = this.last ? now - this.last : 100;
    this.last = now;
    const crossed = crossedArms(points);
    let pauseProgress = 0,
      pause = false;
    if (crossed && canPause) {
      this.pauseSince ??= now;
      pauseProgress = Math.min(1, (now - this.pauseSince) / PAUSE_MS);
      if (pauseProgress === 1 && !this.pauseFired) {
        pause = true;
        this.pauseFired = true;
      }
    } else if (!crossed) {
      this.pauseSince = null;
      this.pauseFired = false;
    }
    if (!navigation || crossed || !upperBodyVisible(points)) {
      this.hand = null;
      this.pointer = null;
      return { pointer: null, pause, pauseProgress };
    }
    const shoulderY = (points[11].y + points[12].y) / 2;
    const span = Math.abs(points[11].x - points[12].x);
    // A shoulder-based reach area stays stable when hips leave the frame,
    // including seated navigation. Never use inferred off-screen hips.
    const torso = span * 1.5;
    const hipY = shoulderY + torso;
    const raised = (i: 15 | 16) =>
      valid(points[i]) && points[i].y < hipY - torso * 0.15;
    if (span < 0.06 || torso < 0.08) {
      this.pointer = null;
      this.hand = null;
      return { pointer: null, pause, pauseProgress };
    }
    if (this.hand !== null && !raised(this.hand)) {
      this.hand = null;
      this.pointer = null;
    }
    // Keep the chosen hand until lowered so two raised hands cannot jitter the cursor.
    this.hand ??= raised(16) ? 16 : raised(15) ? 15 : null;
    if (this.hand === null) return { pointer: null, pause, pauseProgress };
    const wrist = points[this.hand];
    const centerX = (points[11].x + points[12].x) / 2;
    const clamp = (n: number) => Math.max(0.02, Math.min(0.98, n));
    // Mirrored cursor; body-relative reach maps to the entire viewport, independent
    // of camera letterboxing or display orientation. No pixel crop is assumed.
    // Keep the entire control area reachable inside a close-up camera image.
    const left = Math.max(0.02, centerX - span * 1.5);
    const right = Math.min(0.98, centerX + span * 1.5);
    const top = Math.max(0.02, shoulderY - torso * 0.7);
    const bottom = Math.min(0.98, shoulderY + torso * 0.85);
    // Use a moderate gain to shorten reach without making small movements
    // too sensitive. Apply after clipping for close-up framing too.
    const gain = 1.6;
    const target = {
      x: clamp(0.5 + gain * ((right - wrist.x) / (right - left) - 0.5)),
      y: clamp(0.5 + gain * ((wrist.y - top) / (bottom - top) - 0.5)),
    };
    const alpha = 1 - Math.exp(-delta / 90);
    this.pointer = this.pointer
      ? {
          x: this.pointer.x + (target.x - this.pointer.x) * alpha,
          y: this.pointer.y + (target.y - this.pointer.y) * alpha,
        }
      : target;
    return { pointer: this.pointer, pause, pauseProgress };
  }
}
