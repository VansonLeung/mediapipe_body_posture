import { feedback } from '../../catalog/feedback';
import type { LegacyExerciseId } from '../../catalog';
import { angle } from '../geometry';
import { blankAnalysis } from '../types';
import type { Analysis, Landmark, Check } from '../types';
export function analyzeLegacyPose(
  points: Landmark[],
  exercise: LegacyExerciseId,
  aspect = 1,
  tolerance = 0,
): Analysis {
  const required = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  if (
    required.some(
      (i) =>
        !points[i] ||
        (points[i].visibility ?? 0) < 0.6 ||
        points[i].x < 0.015 ||
        points[i].x > 0.985 ||
        points[i].y < 0.015 ||
        points[i].y > 0.985,
    )
  )
    return { ...blankAnalysis };
  // Scale x by the video aspect ratio before measuring 2D angles.
  const p = points.map((v) => ({ ...v, x: v.x * aspect }));
  const leftKnee = angle(p[23], p[25], p[27]),
    rightKnee = angle(p[24], p[26], p[28]);
  const leftArm = angle(p[23], p[11], p[13]),
    rightArm = angle(p[24], p[12], p[14]);
  const leftElbow = angle(p[11], p[13], p[15]),
    rightElbow = angle(p[12], p[14], p[16]);
  const shoulder = { x: (p[11].x + p[12].x) / 2, y: (p[11].y + p[12].y) / 2 };
  const hip = { x: (p[23].x + p[24].x) / 2, y: (p[23].y + p[24].y) / 2 };
  const lean =
    (Math.atan2(
      Math.abs(shoulder.x - hip.x),
      Math.max(0.001, hip.y - shoulder.y),
    ) *
      180) /
    Math.PI;
  const deg = (v: number) => `${Math.round(v)}°`;
  const within = (v: number, min: number, max: number) =>
    v >= min - tolerance && v <= max + tolerance;
  let checks: Check[] = [],
    phase: Analysis['phase'] = 'neutral';
  if (exercise === 'warrior') {
    const bent = Math.min(leftKnee, rightKnee),
      straight = Math.max(leftKnee, rightKnee);
    checks = [
      {
        label: feedback('bent-knee'),
        value: deg(bent),
        good: within(bent, 80, 125),
        cue:
          bent < 80 - tolerance
            ? feedback(
                'ease-out-of-the-deep-bend-and-lengthen-your-front-leg-a-little',
              )
            : feedback(
                'gently-bend-your-front-knee-a-little-more-within-a-comfortable-range',
              ),
      },
      {
        label: feedback('back-leg'),
        value: deg(straight),
        good: straight >= 155 - tolerance,
        cue: feedback('lengthen-your-back-leg'),
      },
      {
        label: feedback('arms-at-shoulder-height'),
        value: `${deg(leftArm)} / ${deg(rightArm)}`,
        good:
          within(leftArm, 75, 105) &&
          within(rightArm, 75, 105) &&
          Math.min(leftElbow, rightElbow) > 150 - tolerance,
        cue: feedback('reach-both-arms-straight-out-at-shoulder-height'),
      },
      {
        label: feedback('upright-torso'),
        value: deg(lean),
        good: lean < 15 + tolerance,
        cue: feedback('bring-your-shoulders-above-your-hips'),
      },
    ];
  } else if (exercise === 'tree') {
    const standingLeft = leftKnee >= rightKnee;
    const foot = p[standingLeft ? 28 : 27],
      ankle = p[standingLeft ? 27 : 28],
      knee = p[standingLeft ? 25 : 26];
    const legLength = Math.hypot(knee.x - ankle.x, knee.y - ankle.y);
    const nearLeg =
      Math.abs(foot.x - ankle.x) < Math.max(0.04, legLength * 0.65) &&
      foot.y < ankle.y - legLength * 0.1;
    checks = [
      {
        label: feedback('standing-leg'),
        value: deg(Math.max(leftKnee, rightKnee)),
        good: Math.max(leftKnee, rightKnee) > 155 - tolerance,
        cue: feedback('lengthen-your-standing-leg-without-locking-the-knee'),
      },
      {
        label: feedback('bent-knee'),
        value: deg(Math.min(leftKnee, rightKnee)),
        good: within(Math.min(leftKnee, rightKnee), 35, 125),
        cue: feedback('open-your-bent-knee-gently-to-the-side'),
      },
      {
        label: feedback('raised-foot'),
        value: nearLeg ? feedback('in-position') : feedback('adjust'),
        good: nearLeg,
        cue: feedback(
          'rest-your-raised-foot-against-your-standing-ankle-or-calf-away-from-the-knee',
        ),
      },
      {
        label: feedback('upright-torso'),
        value: deg(lean),
        good: lean < 12 + tolerance,
        cue: feedback('stack-your-shoulders-above-your-hips'),
      },
    ];
  } else if (exercise === 'arms') {
    if (leftArm > 75 && rightArm > 75) phase = 'raised';
    if (leftArm < 25 && rightArm < 25) phase = 'lowered';
    checks = [
      {
        label: feedback('arm-movement'),
        value: `${deg(leftArm)} / ${deg(rightArm)}`,
        good: Math.abs(leftArm - rightArm) < 20 + tolerance,
        cue: feedback('move-both-arms-together-at-the-same-pace'),
      },
      {
        label: feedback('elbows-extended'),
        value: deg(Math.min(leftElbow, rightElbow)),
        good: Math.min(leftElbow, rightElbow) > 145 - tolerance,
        cue: feedback('keep-a-soft-nearly-straight-line-through-your-elbows'),
      },
      {
        label: feedback('upright-torso'),
        value: deg(lean),
        good: lean < 12 + tolerance,
        cue: feedback('keep-your-torso-steady-as-your-arms-move'),
      },
    ];
  } else {
    if (lean > 15 && lean < 40) phase = 'raised';
    if (lean < 6) phase = 'lowered';
    checks = [
      {
        label: feedback('side-bend'),
        value: deg(lean),
        good: lean < 40 + tolerance,
        cue: feedback('make-your-side-bend-smaller-and-more-controlled'),
      },
      {
        label: feedback('legs-extended'),
        value: deg(Math.min(leftKnee, rightKnee)),
        good: Math.min(leftKnee, rightKnee) > 150 - tolerance,
        cue: feedback('keep-both-legs-long-as-you-bend-to-the-side'),
      },
      {
        label: feedback('stable-stance'),
        value: feedback('feet-apart'),
        good: Math.abs(p[27].x - p[28].x) > Math.abs(p[11].x - p[12].x) * 0.65,
        cue: feedback('set-your-feet-comfortably-apart-for-a-stable-base'),
      },
    ];
  }
  const score = Math.round(
    (checks.filter((c) => c.good).length / checks.length) * 100,
  );
  return {
    visible: true,
    score,
    checks,
    phase,
    angles: { leftKnee, rightKnee, leftArm, rightArm },
    cue:
      checks.find((c) => !c.good)?.cue ??
      (exercise === 'arms'
        ? phase === 'raised'
          ? feedback('nicely-done-slowly-lower-your-arms')
          : feedback('lift-both-arms-slowly-to-shoulder-height')
        : exercise === 'bend'
          ? phase === 'raised'
            ? feedback('return-slowly-to-the-center')
            : feedback('gently-lengthen-into-a-side-bend')
          : feedback('looking-aligned-breathe-steadily-and-hold')),
  };
}
