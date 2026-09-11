import { useCallback, useEffect, useRef, useState } from 'react';
import { usePoseTracker } from './usePoseTracker';
import type { Landmark } from '../lib/analysis';
import {
  PostureMonitorEngine,
  measurePosture,
  metricKeys,
} from '../lib/posture';
import type {
  MonitorOptions,
  MonitorRecord,
  PostureMeasurement,
  ReminderEvent,
} from '../lib/posture';

function readRecords(): MonitorRecord[] {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem('forma-posture-sessions') ?? '[]',
    );
    return Array.isArray(data)
      ? data
          .filter(
            (r): r is MonitorRecord =>
              r &&
              typeof r.id === 'string' &&
              typeof r.date === 'string' &&
              Number.isFinite(Date.parse(r.date)) &&
              ['front', 'side', 'diagonal'].includes(r.profile) &&
              ['left', 'right'].includes(r.side) &&
              ['duration', 'tracked', 'near', 'gaps', 'reminders'].every(
                (k) => Number.isFinite(r[k]) && r[k] >= 0,
              ) &&
              Array.isArray(r.events) &&
              r.events.every(
                (e: ReminderEvent) =>
                  e && metricKeys.includes(e.key) && Number.isFinite(e.at),
              ),
          )
          .slice(0, 100)
      : [];
  } catch {
    return [];
  }
}

export function usePostureMonitor(
  options: MonitorOptions,
  overlay: boolean,
  tweening: boolean,
  onReminder: (event: ReminderEvent) => void,
) {
  const engine = useRef(new PostureMonitorEngine(options));
  const latest = useRef<{
    measurement: PostureMeasurement;
    time: number;
  } | null>(null);
  const reminderCallback = useRef(onReminder);
  reminderCallback.current = onReminder;
  const [revision, refresh] = useState(0);
  const [records, setRecords] = useState(readRecords);
  const recordsRef = useRef(records);
  const [recap, setRecap] = useState<MonitorRecord | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [alert, setAlert] = useState<ReminderEvent | null>(null);
  const alertUntil = useRef(0);
  const onFrame = useCallback(
    (points: Landmark[], _time: number, aspect: number) => {
      latest.current = {
        measurement: measurePosture(
          points,
          aspect,
          options.profile,
          options.side,
        ),
        time: performance.now(),
      };
    },
    [options.profile, options.side],
  );
  const tracker = usePoseTracker({
    overlay,
    tweening,
    onFrame,
    onSeek: () => {
      latest.current = null;
    },
  });
  const persist = useCallback((record: MonitorRecord, notify = true) => {
    recordsRef.current = [record, ...recordsRef.current].slice(0, 100);
    try {
      localStorage.setItem(
        'forma-posture-sessions',
        JSON.stringify(recordsRef.current),
      );
    } catch {
      if (notify) setStorageError(true);
    }
    if (notify) setRecords([...recordsRef.current]);
  }, []);
  useEffect(() => {
    engine.current.updateOptions(options);
  }, [options]);
  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      const sample =
        latest.current && now - latest.current.time < 450
          ? latest.current.measurement
          : null;
      const event = engine.current.step(sample, now);
      if (event) {
        setAlert(event);
        alertUntil.current = now + 10000;
        reminderCallback.current(event);
      }
      if (now >= alertUntil.current) setAlert(null);
      refresh((v) => v + 1);
    };
    const interval = window.setInterval(tick, 100);
    const visibility = () => {
      if (document.hidden) {
        engine.current.pause();
        latest.current = null;
        setAlert(null);
        refresh((v) => v + 1);
        window.speechSynthesis?.cancel();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', visibility);
      const record = engine.current.finish();
      if (record) persist(record, false);
      window.speechSynthesis?.cancel();
    };
  }, [persist]);
  const finish = useCallback(
    (showRecap = true, stopCamera = true) => {
      const record = engine.current.finish();
      if (record) {
        persist(record);
        if (showRecap) setRecap(record);
      }
      setAlert(null);
      window.speechSynthesis?.cancel();
      if (stopCamera) {
        tracker.stop();
        latest.current = null;
      }
      refresh((v) => v + 1);
    },
    [persist, tracker.stop],
  );
  useEffect(() => {
    if (tracker.status === 'error') {
      setCameraError(tracker.error);
      finish(false);
    }
  }, [tracker.status, tracker.error, finish]);
  const clearReference = () => {
    finish(false, false);
    engine.current = new PostureMonitorEngine(options);
    latest.current = null;
    refresh((v) => v + 1);
  };
  const calibrate = () => {
    finish(false, false);
    engine.current.calibrate();
    setAlert(null);
    refresh((v) => v + 1);
  };
  const startCamera = async (deviceId?: string) => {
    clearReference();
    tracker.stop();
    setCameraError('');
    await tracker.startCamera(deviceId);
  };
  const pause = () => {
    engine.current.pause();
    setAlert(null);
    window.speechSynthesis?.cancel();
    refresh((v) => v + 1);
  };
  const resume = () => {
    engine.current.resume();
    refresh((v) => v + 1);
  };
  const snooze = () => {
    engine.current.snooze(performance.now());
    setAlert(null);
    window.speechSynthesis?.cancel();
    refresh((v) => v + 1);
  };
  const wake = () => {
    engine.current.snoozeUntil = 0;
    refresh((v) => v + 1);
  };
  // revision intentionally drives a snapshot of the mutable, clock-based engine.
  void revision;
  return {
    engine: engine.current,
    tracker,
    records,
    recap,
    setRecap,
    storageError,
    cameraError,
    alert,
    clearReference,
    calibrate,
    startCamera,
    pause,
    resume,
    finish,
    snooze,
    wake,
  };
}
