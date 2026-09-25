import { feedback } from '../../catalog/feedback';
import { angle } from '../geometry';
import { blankAnalysis } from '../types';
import type { Analysis, Check, Landmark } from '../types';

// Frontal, projected geometry only. These checks do not establish floor contact
// or suitability for an age group. Counting still requires a complete cycle.
export function analyzeStandingMovement(
  points: Landmark[],
  exercise: 'overhead-reach' | 'elbow-bends',
  aspect = 1,
  tolerance = 0,
  minimumVisibility = 0.6,
): Analysis {
  const unavailable = {
    ...blankAnalysis,
    cue: feedback('show-standing-body-and-arms'),
  };
  const required = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  if (
    !Number.isFinite(aspect) ||
    aspect <= 0 ||
    required.some((i) => {
      const v = points[i];
      return (
        !v ||
        !Number.isFinite(v.x) ||
        !Number.isFinite(v.y) ||
        !Number.isFinite(v.visibility) ||
        (v.visibility ?? 0) < minimumVisibility ||
        v.x <= 0.015 ||
        v.x >= 0.985 ||
        v.y <= 0.015 ||
        v.y >= 0.985
      );
    })
  )
    return unavailable;
  const p = points.map((v) => ({ ...v, x: v.x * aspect }));
  const length = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);
  const shoulder = { x: (p[11].x + p[12].x) / 2, y: (p[11].y + p[12].y) / 2 };
  const hip = { x: (p[23].x + p[24].x) / 2, y: (p[23].y + p[24].y) / 2 };
  const torso = length(shoulder, hip);
  if (
    torso < 0.05 ||
    [
      [11, 13],
      [13, 15],
      [12, 14],
      [14, 16],
      [23, 25],
      [25, 27],
      [24, 26],
      [26, 28],
    ].some(([a, b]) => length(p[a], p[b]) < 0.025)
  )
    return unavailable;
  const leftArm = angle(p[23], p[11], p[13]),
    rightArm = angle(p[24], p[12], p[14]);
  const leftElbow = angle(p[11], p[13], p[15]),
    rightElbow = angle(p[12], p[14], p[16]);
  const leftKnee = angle(p[23], p[25], p[27]),
    rightKnee = angle(p[24], p[26], p[28]);
  const lean =
    (Math.atan2(Math.abs(shoulder.x - hip.x), hip.y - shoulder.y) * 180) /
    Math.PI;
  const frontal = length(p[11], p[12]) > torso * 0.35;
  const standing =
    hip.y > shoulder.y &&
    Math.min(p[27].y, p[28].y) > hip.y + torso * 0.7 &&
    Math.min(leftKnee, rightKnee) > 135;
  const armsDown =
    Math.max(leftArm, rightArm) < 30 && p[15].y > p[13].y && p[16].y > p[14].y;
  const checks: Check[] = [];
  const add = (
    label: Check['label'],
    good: boolean,
    cue: Check['cue'],
    value = good ? feedback('in-position') : feedback('adjust'),
  ) => checks.push({ label, good, cue, value });
  add(
    feedback('front-camera-view'),
    frontal,
    feedback('face-the-camera-for-this-check'),
  );
  add(
    feedback('standing-shape'),
    standing && Math.min(leftKnee, rightKnee) > 150 - tolerance,
    feedback('stand-for-this-movement'),
  );
  add(
    feedback('upright-torso'),
    lean < 15 + tolerance,
    feedback('bring-your-shoulders-above-your-hips'),
    `${Math.round(lean)}°`,
  );
  let phase: Analysis['phase'] = 'neutral';
  if (exercise === 'overhead-reach') {
    const overhead =
      Math.min(leftArm, rightArm) > 145 &&
      p[15].y < shoulder.y - torso * 0.35 &&
      p[16].y < shoulder.y - torso * 0.35;
    if (frontal && standing) {
      if (armsDown) phase = 'lowered';
      else if (overhead) phase = 'raised';
    }
    add(
      feedback('arm-movement'),
      Math.abs(leftArm - rightArm) < 25 + tolerance,
      feedback('move-both-arms-together-at-the-same-pace'),
      `${Math.round(leftArm)}° / ${Math.round(rightArm)}°`,
    );
    add(
      feedback('elbows-extended'),
      Math.min(leftElbow, rightElbow) > 145 - tolerance,
      feedback('keep-a-soft-nearly-straight-line-through-your-elbows'),
    );
  } else {
    const upperArmsLow = Math.max(leftArm, rightArm) < 35;
    if (frontal && standing && upperArmsLow) {
      if (Math.min(leftElbow, rightElbow) > 150 && armsDown) phase = 'lowered';
      else if (
        Math.max(leftElbow, rightElbow) < 70 &&
        p[15].y < p[13].y &&
        p[16].y < p[14].y
      )
        phase = 'raised';
    }
    add(
      feedback('upper-arms-at-sides'),
      upperArmsLow,
      feedback('keep-elbows-low'),
    );
    add(
      feedback('elbow-movement'),
      Math.abs(leftElbow - rightElbow) < 25 + tolerance,
      feedback('match-elbow-movement'),
      `${Math.round(leftElbow)}° / ${Math.round(rightElbow)}°`,
    );
  }
  return {
    visible: true,
    score: Math.round(
      (checks.filter((c) => c.good).length / checks.length) * 100,
    ),
    checks,
    phase,
    angles: { leftKnee, rightKnee, leftArm, rightArm },
    cue:
      checks.find((c) => !c.good)?.cue ??
      (exercise === 'overhead-reach'
        ? phase === 'raised'
          ? feedback('bring-hands-down')
          : feedback('reach-both-hands-overhead')
        : phase === 'raised'
          ? feedback('straighten-both-elbows')
          : feedback('bend-both-elbows')),
  };
}
