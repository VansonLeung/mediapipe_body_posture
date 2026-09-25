import { feedback } from '../../catalog/feedback';
import { angle } from '../geometry';
import { blankAnalysis } from '../types';
import type { Analysis, Check, Landmark } from '../types';
import type { ExerciseId } from '../../catalog';

const visible = (p: Landmark | undefined) =>
  !!p &&
  Number.isFinite(p.x) &&
  Number.isFinite(p.y) &&
  (p.visibility ?? 0) >= 0.6 &&
  p.x > 0.015 &&
  p.x < 0.985 &&
  p.y > 0.015 &&
  p.y < 0.985;
const distance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

// These are view-dependent shape heuristics, not validated gymnastics scores.
// Side views require one complete visible chain, never invented hidden joints.
export function analyzeGymnastics(
  points: Landmark[],
  id: ExerciseId,
  aspect: number,
  tolerance: number,
): Analysis {
  const unavailable = {
    ...blankAnalysis,
    cue: feedback('show-the-required-joints-from-the-suggested-camera-view'),
  };
  if (!Number.isFinite(aspect) || aspect <= 0) return unavailable;
  const p = points.map((v) => ({ ...v, x: v.x * aspect }));
  const front = ['standing-balance', 'one-leg-balance', 'straddle'].includes(
    id,
  );
  const left = id === 'plank' ? [11, 13, 15, 23, 25, 27] : [11, 23, 25, 27];
  const right = left.map((i) => i + 1);
  let side = left;
  if (front) {
    if (![11, 12, 23, 24, 25, 26, 27, 28].every((i) => visible(points[i])))
      return unavailable;
  } else {
    const candidates = [left, right].filter((chain) =>
      chain.every((i) => visible(points[i])),
    );
    if (!candidates.length) return unavailable;
    side = candidates.sort(
      (a, b) =>
        Math.min(...b.map((i) => points[i].visibility!)) -
        Math.min(...a.map((i) => points[i].visibility!)),
    )[0];
  }
  const checks: Check[] = [];
  const add = (
    label: string,
    good: boolean,
    cue: string,
    value = good ? feedback('in-position') : feedback('adjust'),
  ) => checks.push({ label, good, cue, value });
  const degrees = (v: number) => `${Math.round(v)}°`;
  let leftKnee = 0,
    rightKnee = 0;
  if (front) {
    leftKnee = angle(p[23], p[25], p[27]);
    rightKnee = angle(p[24], p[26], p[28]);
    const shoulder = { x: (p[11].x + p[12].x) / 2, y: (p[11].y + p[12].y) / 2 };
    const hip = { x: (p[23].x + p[24].x) / 2, y: (p[23].y + p[24].y) / 2 };
    const torso = distance(shoulder, hip);
    if (torso < 0.04) return unavailable;
    const upright =
      (Math.atan2(Math.abs(shoulder.x - hip.x), hip.y - shoulder.y) * 180) /
      Math.PI;
    add(
      feedback('upright-torso'),
      upright < 15 + tolerance,
      feedback('bring-your-shoulders-above-your-hips'),
      degrees(upright),
    );
    // Require frontal separation to avoid scoring a collapsed side projection.
    add(
      feedback('front-camera-view'),
      distance(p[11], p[12]) > torso * 0.35,
      feedback('face-the-camera-for-this-check'),
    );
    if (id === 'straddle') {
      const leg = Math.max(
        distance(p[23], p[25]) + distance(p[25], p[27]),
        distance(p[24], p[26]) + distance(p[26], p[28]),
      );
      add(
        feedback('legs-extended'),
        Math.min(leftKnee, rightKnee) > 150 - tolerance,
        feedback('lengthen-both-legs-within-a-comfortable-range'),
        degrees(Math.min(leftKnee, rightKnee)),
      );
      add(
        feedback('legs-apart'),
        (p[27].x < hip.x && p[28].x > hip.x) ||
          (p[28].x < hip.x && p[27].x > hip.x),
        feedback('extend-your-legs-to-opposite-sides'),
      );
      add(
        feedback('seated-shape'),
        Math.max(Math.abs(p[27].y - hip.y), Math.abs(p[28].y - hip.y)) <
          leg * 0.45 && Math.abs(p[27].x - p[28].x) > leg,
        feedback('show-the-seated-straddle-from-the-front'),
      );
    } else {
      const standingLeft = p[27].y >= p[28].y;
      const ankle = p[standingLeft ? 27 : 28],
        knee = p[standingLeft ? 25 : 26];
      const leg =
        distance(p[standingLeft ? 23 : 24], knee) + distance(knee, ankle);
      add(
        feedback('standing-shape'),
        ankle.y > hip.y + torso * 0.6,
        feedback('keep-your-standing-foot-below-your-hips'),
      );
      if (id === 'standing-balance') {
        add(
          feedback('legs-extended'),
          Math.min(leftKnee, rightKnee) > 155 - tolerance,
          feedback('lengthen-both-legs-without-locking-your-knees'),
        );
        add(
          feedback('feet-level'),
          Math.abs(p[27].y - p[28].y) < leg * 0.12,
          feedback('place-both-feet-at-the-same-level'),
        );
      } else {
        add(
          feedback('standing-leg'),
          (standingLeft ? leftKnee : rightKnee) > 155 - tolerance,
          feedback('lengthen-your-standing-leg-without-locking-the-knee'),
        );
        add(
          feedback('raised-foot'),
          Math.abs(p[27].y - p[28].y) > leg * 0.18,
          feedback('lift-one-foot-clear-of-the-standing-ankle'),
        );
      }
    }
  } else {
    const [shoulderId, hipId, kneeId, ankleId] =
      id === 'plank' ? [side[0], side[3], side[4], side[5]] : side;
    const shoulder = p[shoulderId],
      hip = p[hipId],
      knee = p[kneeId],
      ankle = p[ankleId];
    const torso = distance(shoulder, hip),
      thigh = distance(hip, knee),
      shin = distance(knee, ankle);
    if (Math.min(torso, thigh, shin) < 0.025) return unavailable;
    const hipAngle = angle(shoulder, hip, knee),
      kneeAngle = angle(hip, knee, ankle);
    if (shoulderId === 11) leftKnee = kneeAngle;
    else rightKnee = kneeAngle;
    if (id === 'tuck') {
      add(
        feedback('knees-folded'),
        kneeAngle < 85 + tolerance,
        feedback('bring-your-lower-legs-closer-to-your-thighs'),
        degrees(kneeAngle),
      );
      add(
        feedback('compact-shape'),
        hipAngle < 85 + tolerance && distance(shoulder, knee) < torso * 1.15,
        feedback(
          'bring-your-knees-towards-your-chest-within-a-comfortable-range',
        ),
        degrees(hipAngle),
      );
    } else if (id === 'pike') {
      add(
        feedback('leg-extended'),
        kneeAngle > 155 - tolerance,
        feedback('lengthen-your-visible-leg'),
        degrees(kneeAngle),
      );
      add(
        feedback('pike-angle'),
        hipAngle > 25 - tolerance && hipAngle < 110 + tolerance,
        feedback('show-a-comfortable-pike-shape'),
        degrees(hipAngle),
      );
      add(
        feedback('seated-shape'),
        Math.abs(ankle.y - hip.y) < (thigh + shin) * 0.3 &&
          shoulder.y < hip.y - torso * 0.25,
        feedback('sit-with-your-legs-extended-horizontally-in-the-side-view'),
      );
    } else if (id === 'plank') {
      const elbow = angle(shoulder, p[side[1]], p[side[2]]);
      add(
        feedback('body-line'),
        hipAngle > 160 - tolerance && kneeAngle > 155 - tolerance,
        feedback('bring-your-shoulders-hips-and-ankles-into-a-long-line'),
      );
      add(
        feedback('horizontal-body'),
        Math.abs(shoulder.y - hip.y) < torso * 0.5,
        feedback('show-the-plank-from-the-side'),
      );
      add(
        feedback('arm-support-shape'),
        elbow > 150 - tolerance &&
          p[side[2]].y > shoulder.y + torso * 0.35 &&
          Math.abs(p[side[2]].x - shoulder.x) < torso * 0.45,
        feedback('show-a-straight-arm-with-your-hand-beneath-your-shoulder'),
        degrees(elbow),
      );
    }
  }
  if (!checks.length) return unavailable;
  return {
    visible: true,
    score: Math.round(
      (checks.filter((c) => c.good).length / checks.length) * 100,
    ),
    checks,
    cue:
      checks.find((c) => !c.good)?.cue ??
      feedback('visible-shape-checks-met-hold-steadily'),
    phase: 'neutral',
    angles: { leftKnee, rightKnee, leftArm: 0, rightArm: 0 },
  };
}
