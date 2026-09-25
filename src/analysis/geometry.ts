import type { Landmark } from './types';
export function angle(a: Landmark, b: Landmark, c: Landmark) {
  const u = { x: a.x - b.x, y: a.y - b.y },
    v = { x: c.x - b.x, y: c.y - b.y };
  const denominator = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
  return denominator < 1e-8
    ? 0
    : (Math.acos(
        Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / denominator)),
      ) *
        180) /
        Math.PI;
}
