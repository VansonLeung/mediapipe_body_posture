import { feedback } from '../catalog/feedback';
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
  cue: feedback('step-back-until-your-full-body-is-in-the-frame'),
  phase: 'neutral',
  angles: { leftKnee: 0, rightKnee: 0, leftArm: 0, rightArm: 0 },
};
