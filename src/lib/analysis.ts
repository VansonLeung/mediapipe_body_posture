import type { ExerciseId } from './exercises';
export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}
export interface Check {
  label: string;
  value: string;
  good: boolean;
  cue: string;
}
export interface Analysis {
  visible: boolean;
  score: number;
  checks: Check[];
  cue: string;
  phase: 'raised' | 'lowered' | 'neutral';
  angles: {
    leftKnee: number;
    rightKnee: number;
    leftArm: number;
    rightArm: number;
  };
}
export const blankAnalysis: Analysis = {
  visible: false,
  score: 0,
  checks: [],
  cue: 'Step back until your full body is in the frame.',
  phase: 'neutral',
  angles: { leftKnee: 0, rightKnee: 0, leftArm: 0, rightArm: 0 },
};
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
export function analyzePose(
  points: Landmark[],
  exercise: ExerciseId,
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
        label: 'Bent knee',
        value: deg(bent),
        good: within(bent, 80, 125),
        cue:
          bent < 80 - tolerance
            ? 'Ease out of the deep bend and lengthen your front leg a little.'
            : 'Gently bend your front knee a little more, within a comfortable range.',
      },
      {
        label: 'Back leg',
        value: deg(straight),
        good: straight >= 155 - tolerance,
        cue: 'Lengthen your back leg.',
      },
      {
        label: 'Arms at shoulder height',
        value: `${deg(leftArm)} / ${deg(rightArm)}`,
        good:
          within(leftArm, 75, 105) &&
          within(rightArm, 75, 105) &&
          Math.min(leftElbow, rightElbow) > 150 - tolerance,
        cue: 'Reach both arms straight out at shoulder height.',
      },
      {
        label: 'Upright torso',
        value: deg(lean),
        good: lean < 15 + tolerance,
        cue: 'Bring your shoulders above your hips.',
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
        label: 'Standing leg',
        value: deg(Math.max(leftKnee, rightKnee)),
        good: Math.max(leftKnee, rightKnee) > 155 - tolerance,
        cue: 'Lengthen your standing leg without locking the knee.',
      },
      {
        label: 'Bent knee',
        value: deg(Math.min(leftKnee, rightKnee)),
        good: within(Math.min(leftKnee, rightKnee), 35, 125),
        cue: 'Open your bent knee gently to the side.',
      },
      {
        label: 'Raised foot',
        value: nearLeg ? 'In position' : 'Adjust',
        good: nearLeg,
        cue: 'Rest your raised foot against your standing ankle or calf, away from the knee.',
      },
      {
        label: 'Upright torso',
        value: deg(lean),
        good: lean < 12 + tolerance,
        cue: 'Stack your shoulders above your hips.',
      },
    ];
  } else if (exercise === 'arms') {
    if (leftArm > 75 && rightArm > 75) phase = 'raised';
    if (leftArm < 25 && rightArm < 25) phase = 'lowered';
    checks = [
      {
        label: 'Arm movement',
        value: `${deg(leftArm)} / ${deg(rightArm)}`,
        good: Math.abs(leftArm - rightArm) < 20 + tolerance,
        cue: 'Move both arms together at the same pace.',
      },
      {
        label: 'Elbows extended',
        value: deg(Math.min(leftElbow, rightElbow)),
        good: Math.min(leftElbow, rightElbow) > 145 - tolerance,
        cue: 'Keep a soft, nearly straight line through your elbows.',
      },
      {
        label: 'Upright torso',
        value: deg(lean),
        good: lean < 12 + tolerance,
        cue: 'Keep your torso steady as your arms move.',
      },
    ];
  } else {
    if (lean > 15 && lean < 40) phase = 'raised';
    if (lean < 6) phase = 'lowered';
    checks = [
      {
        label: 'Side bend',
        value: deg(lean),
        good: lean < 40 + tolerance,
        cue: 'Make your side bend smaller and more controlled.',
      },
      {
        label: 'Legs extended',
        value: deg(Math.min(leftKnee, rightKnee)),
        good: Math.min(leftKnee, rightKnee) > 150 - tolerance,
        cue: 'Keep both legs long as you bend to the side.',
      },
      {
        label: 'Stable stance',
        value: 'Feet apart',
        good: Math.abs(p[27].x - p[28].x) > Math.abs(p[11].x - p[12].x) * 0.65,
        cue: 'Set your feet comfortably apart for a stable base.',
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
          ? 'Nicely done. Slowly lower your arms.'
          : 'Lift both arms slowly to shoulder height.'
        : exercise === 'bend'
          ? phase === 'raised'
            ? 'Return slowly to the center.'
            : 'Gently lengthen into a side bend.'
          : 'Looking aligned. Breathe steadily and hold.'),
  };
}
export class RepCounter {
  private stage: 'unready' | 'ready' | 'raised' = 'unready';
  count = 0;
  update(result: Analysis) {
    if (!result.visible || result.score < 100) {
      this.stage = 'unready';
      return this.count;
    }
    if (result.phase === 'lowered') {
      if (this.stage === 'raised') this.count++;
      this.stage = 'ready';
    } else if (result.phase === 'raised' && this.stage === 'ready')
      this.stage = 'raised';
    return this.count;
  }
  resetStage() {
    this.stage = 'unready';
  }
}
export interface ReviewPoint {
  time: number;
  score: number;
  cue: string;
  visible: boolean;
}
export interface SessionRecord {
  id: string;
  date: string;
  exercise: ExerciseId;
  source: 'camera' | 'video';
  duration: number;
  hold: number;
  reps: number;
  score: number | null;
  cues: string[];
}
export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;
