import type { Landmark } from './analysis';

export const SKELETON_TWEEN_DURATION_MS = 120;

export interface NeckLandmarks {
  top: Landmark;
  base: Landmark;
}

const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3;

export function tweenLandmarks(
  from: Landmark[],
  to: Landmark[],
  progress: number,
): Landmark[] {
  if (from.length !== to.length) return to.map((point) => ({ ...point }));

  const amount = easeOutCubic(Math.max(0, Math.min(1, progress)));
  return to.map((target, index) => {
    const start = from[index];
    const interpolate = (a: number | undefined, b: number | undefined) => {
      if (a === undefined || b === undefined) return b;
      return a + (b - a) * amount;
    };

    return {
      x: interpolate(start.x, target.x) ?? target.x,
      y: interpolate(start.y, target.y) ?? target.y,
      z: interpolate(start.z, target.z),
      visibility: interpolate(start.visibility, target.visibility),
    };
  });
}

export function deriveNeckLandmarks(points: Landmark[]): NeckLandmarks | null {
  const leftShoulder = points[11];
  const rightShoulder = points[12];
  if (!leftShoulder || !rightShoulder) return null;

  const mouthPoints = [points[9], points[10]].filter(
    (point): point is Landmark => !!point && (point.visibility ?? 0) > 0.5,
  );
  const anchor =
    mouthPoints.length === 2
      ? {
          x: (mouthPoints[0].x + mouthPoints[1].x) / 2,
          y: (mouthPoints[0].y + mouthPoints[1].y) / 2,
          z: ((mouthPoints[0].z ?? 0) + (mouthPoints[1].z ?? 0)) / 2,
          visibility: Math.min(
            mouthPoints[0].visibility ?? 0,
            mouthPoints[1].visibility ?? 0,
          ),
        }
      : points[0];
  if (!anchor) return null;

  const visibility = Math.min(
    anchor.visibility ?? 0,
    leftShoulder.visibility ?? 0,
    rightShoulder.visibility ?? 0,
  );
  const base = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
    z: ((leftShoulder.z ?? 0) + (rightShoulder.z ?? 0)) / 2,
    visibility,
  };

  return {
    top: {
      x: anchor.x + (base.x - anchor.x) * 0.35,
      y: anchor.y + (base.y - anchor.y) * 0.35,
      z: (anchor.z ?? 0) + ((base.z ?? 0) - (anchor.z ?? 0)) * 0.35,
      visibility,
    },
    base,
  };
}
