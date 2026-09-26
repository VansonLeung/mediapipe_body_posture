import { useEffect, useState } from 'react';
import { Button } from 'antd';
import { PoseArt } from './PoseArt';
import { getIllustration } from '../catalog/assets';
import type { Exercise, StudioLanguage } from '../catalog';
export function MovementDemo({
  exercise,
  language,
  autoPlay = false,
  gestureControls = false,
  showControls = true,
}: {
  exercise: Exercise;
  language: StudioLanguage;
  autoPlay?: boolean;
  gestureControls?: boolean;
  showControls?: boolean;
}) {
  const [{ frame, elapsed }, setPosition] = useState({ frame: 0, elapsed: 0 }),
    [playing, setPlaying] = useState(autoPlay);
  const frames =
    getIllustration(exercise.data.presentation.illustration)?.frames?.length ??
    1;
  const t = (en: string, zh: string) => (language === 'en' ? en : zh);
  useEffect(() => {
    if (!playing || frames < 2) return;
    let request = 0;
    let previous: number | null = null;
    const resetClock = () => {
      previous = null;
    };
    const tick = (now: number) => {
      if (!document.hidden && previous !== null) {
        const delta = Math.min(100, now - previous);
        setPosition((position) => {
          const total = position.elapsed + delta;
          return {
            frame: (position.frame + Math.floor(total / 1800)) % frames,
            elapsed: total % 1800,
          };
        });
      }
      previous = document.hidden ? null : now;
      request = window.requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', resetClock);
    request = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(request);
      document.removeEventListener('visibilitychange', resetClock);
    };
  }, [playing, frames]);
  // Pause briefly at each stage, then ease into the next pose. Pausing playback
  // retains its exact intermediate position; stepping lands on a catalogue pose.
  const progress = Math.max(0, (elapsed - 500) / 1300);
  const instruction = progress > 0 ? (frame + 1) % frames : frame;
  return (
    <div className="movement-demo">
      <PoseArt pose={exercise.id} demoFrame={frame} demoProgress={progress} />
      <div>
        <strong>{t('Follow the movement', '跟著做')}</strong>
        <p>
          {exercise.steps[Math.min(instruction, exercise.steps.length - 1)]}
        </p>
        {frames > 1 && showControls && (
          <div className="demo-controls">
            <Button
              data-kiosk-action={gestureControls ? 'demo-play' : undefined}
              size="small"
              onClick={() => setPlaying((p) => !p)}
            >
              {playing
                ? t('Pause demonstration', '暫停示範')
                : t('Play demonstration', '播放示範')}
            </Button>
            <Button
              data-kiosk-action={gestureControls ? 'demo-next' : undefined}
              size="small"
              onClick={() => {
                setPlaying(false);
                setPosition((p) => ({
                  frame: (p.frame + 1) % frames,
                  elapsed: 0,
                }));
              }}
            >
              {t('Next picture', '下一張')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
