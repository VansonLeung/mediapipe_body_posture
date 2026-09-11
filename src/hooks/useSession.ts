import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzePose, blankAnalysis, RepCounter } from '../lib/analysis';
import type {
  Analysis,
  Landmark,
  ReviewPoint,
  SessionRecord,
} from '../lib/analysis';
import type { Exercise } from '../lib/exercises';
export type Phase = 'idle' | 'setup' | 'practice' | 'rest' | 'complete';
const emptyStats = () => ({
  duration: 0,
  hold: 0,
  reps: 0,
  totalScore: 0,
  samples: 0,
});
export function useSession(
  exercise: Exercise,
  mode: 'guided' | 'free',
  tolerance: number,
  source: 'camera' | 'video',
  onSave: (record: SessionRecord) => void,
) {
  const [analysis, setAnalysis] = useState<Analysis>(blankAnalysis);
  const [phase, setPhase] = useState<Phase>('idle');
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState(emptyStats);
  const [setupTime, setSetupTime] = useState(0),
    [restTime, setRestTime] = useState(8);
  const [timeline, setTimeline] = useState<ReviewPoint[]>([]);
  const [recap, setRecap] = useState<SessionRecord | null>(null);
  const phaseRef = useRef<Phase>('idle'),
    statsRef = useRef(emptyStats()),
    lastTime = useRef<number | null>(null),
    setup = useRef(0);
  const counter = useRef(new RepCounter()),
    cues = useRef(new Map<string, number>()),
    points = useRef(new Map<number, ReviewPoint>());
  const credited = useRef(new Set<number>());
  const options = useRef({ exercise, mode, tolerance, source, onSave, paused });
  options.current = { exercise, mode, tolerance, source, onSave, paused };
  const transition = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const finish = useCallback(() => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'complete') return;
    const s = statsRef.current;
    const record: SessionRecord = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      exercise: options.current.exercise.id,
      source: options.current.source,
      duration: s.duration,
      hold: s.hold,
      reps: s.reps,
      score: s.samples ? Math.round(s.totalScore / s.samples) : null,
      cues: [...cues.current]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cue]) => cue),
    };
    transition('complete');
    setPaused(false);
    setRecap(record);
    if (s.duration > 0) options.current.onSave(record);
  }, []);
  useEffect(() => {
    if (phase !== 'rest' || paused) return;
    const timer = window.setInterval(
      () => setRestTime((t) => Math.max(0, t - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [phase, paused]);
  useEffect(() => {
    if (phase === 'rest' && restTime === 0) finish();
  }, [phase, restTime, finish]);
  const reset = useCallback(() => {
    transition('idle');
    setPaused(false);
    setAnalysis(blankAnalysis);
    statsRef.current = emptyStats();
    setStats(emptyStats());
    lastTime.current = null;
    setup.current = 0;
    setSetupTime(0);
    counter.current = new RepCounter();
    cues.current.clear();
    points.current.clear();
    credited.current.clear();
    setTimeline([]);
    setRestTime(8);
    setRecap(null);
  }, []);
  const begin = () => {
    reset();
    transition(mode === 'guided' ? 'setup' : 'practice');
  };
  const onSeek = useCallback(() => {
    lastTime.current = null;
    counter.current.resetStage();
    setAnalysis(blankAnalysis);
  }, []);
  const onFrame = useCallback(
    (landmarks: Landmark[], time: number, aspect: number) => {
      const o = options.current;
      const next = analyzePose(landmarks, o.exercise.id, aspect, o.tolerance);
      setAnalysis(next);
      const rawDelta = lastTime.current === null ? 0 : time - lastTime.current;
      const dt = rawDelta > 0 && rawDelta < 0.5 ? rawDelta : 0;
      if (rawDelta < 0 || rawDelta >= 0.5) counter.current.resetStage();
      lastTime.current = time;
      if (o.paused) return;
      if (phaseRef.current === 'setup') {
        setup.current = next.visible ? setup.current + dt : 0;
        setSetupTime(setup.current);
        if (setup.current >= 3) transition('practice');
        return;
      }
      if (phaseRef.current !== 'practice') return;
      const bucket = Math.floor(time * 10);
      // Seeking/replaying a file updates its review points without inflating the session totals.
      const alreadyCounted =
        o.source === 'video' && credited.current.has(bucket);
      if (!alreadyCounted) {
        credited.current.add(bucket);
        const s = statsRef.current;
        s.duration += dt;
        if (next.visible) {
          s.totalScore += next.score;
          s.samples++;
          if (next.score === 100) s.hold += dt;
        }
        if (o.exercise.unit === 'reps') s.reps = counter.current.update(next);
        if (next.visible && next.score < 100)
          cues.current.set(next.cue, (cues.current.get(next.cue) ?? 0) + 1);
        setStats({ ...s });
      }
      const second = Math.floor(time);
      const point = {
        time: second,
        score: next.score,
        cue: next.cue,
        visible: next.visible,
      };
      if (
        o.source === 'video' &&
        (!points.current.has(second) ||
          points.current.get(second)?.score !== next.score)
      ) {
        points.current.set(second, point);
        setTimeline(
          [...points.current.values()].sort((a, b) => a.time - b.time),
        );
      }
      const s = statsRef.current;
      if (
        o.mode === 'guided' &&
        (o.exercise.unit === 'reps'
          ? s.reps >= o.exercise.target
          : s.hold >= o.exercise.target)
      ) {
        transition('rest');
        setRestTime(8);
      }
    },
    [],
  );
  return {
    analysis,
    phase,
    paused,
    setPaused,
    stats,
    setupTime,
    restTime,
    timeline,
    recap,
    setRecap,
    finish,
    reset,
    begin,
    onFrame,
    onSeek,
  };
}
