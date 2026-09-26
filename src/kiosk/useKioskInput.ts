import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Landmark } from '../analysis/types';
import { DwellSelection, KioskInput } from './input';
import type { Pointer } from './input';

export function useKioskInput(
  root: RefObject<HTMLElement | null>,
  navigation: boolean,
  canPause: boolean,
  onPause: () => void,
) {
  const model = useRef(new KioskInput());
  const dwell = useRef(new DwellSelection());
  const lastFrame = useRef(0);
  const config = useRef({ navigation, canPause, onPause });
  config.current = { navigation, canPause, onPause };
  const [cursor, setCursor] = useState<
    (Pointer & { progress: number; target: string | null }) | null
  >(null);
  const [pauseProgress, setPauseProgress] = useState(0);
  const clear = useCallback(() => {
    model.current.reset();
    dwell.current.reset();
    setCursor(null);
    setPauseProgress(0);
  }, []);
  useEffect(() => {
    const visibility = () => {
      clear();
      if (document.hidden && config.current.canPause) config.current.onPause();
    };
    const timer = window.setInterval(() => {
      if (performance.now() - lastFrame.current > 350) clear();
    }, 250);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [clear]);
  const onFrame = useCallback(
    (points: Landmark[]) => {
      const now = performance.now();
      lastFrame.current = now;
      if (document.hidden) {
        clear();
        return;
      }
      const result = model.current.update(
        points,
        now,
        config.current.navigation,
        config.current.canPause,
      );
      setPauseProgress(result.pauseProgress);
      if (result.pause) config.current.onPause();
      const p = result.pointer;
      const hit = p
        ? document
            .elementFromPoint(p.x * innerWidth, p.y * innerHeight)
            ?.closest<HTMLButtonElement>('button[data-kiosk-action]')
        : null;
      const button =
        hit && root.current?.contains(hit) && !hit.disabled ? hit : null;
      const target = button?.dataset.kioskAction ?? null;
      const selection = dwell.current.update(target, now);
      setCursor(p ? { ...p, progress: selection.progress, target } : null);
      if (selection.action) button?.click();
    },
    [root, clear],
  );
  return { onFrame, cursor, pauseProgress, clear };
}
