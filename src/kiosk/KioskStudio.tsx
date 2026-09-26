import { useCallback, useEffect, useRef, useState } from 'react';
import { availableExercises, localizeExercise } from '../catalog';
import type { StudioLanguage } from '../catalog';
import type { Landmark, SessionRecord } from '../lib/analysis';
import { readHistory } from '../lib/sessionHistory';
import { translateStudio } from '../lib/studioLanguage';
import { useSession } from '../hooks/useSession';
import { usePoseTracker } from '../hooks/usePoseTracker';
import { useAppFullscreen } from '../hooks/useAppFullscreen';
import { MovementDemo } from '../components/MovementDemo';
import { PoseArt } from '../components/PoseArt';
import { bodyVisible, upperBodyVisible } from './input';
import { useKioskInput } from './useKioskInput';
import './kiosk.css';

// Only existing automatic assessments can award kiosk progress. Review-only
// exercises remain available in the teacher's original Movement Studio.
const exercises = availableExercises.filter(
  (e) => e.support === 'automatic' && e.camera === 'front',
);
export default function KioskStudio({ onExit }: { onExit: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const { fullscreen, toggleFullscreen } = useAppFullscreen(root);
  const [cameraView, setCameraView] = useState(() => {
    try {
      const saved = localStorage.getItem('forma-kiosk-layout');
      if (saved === 'camera' || saved === 'split') return saved === 'camera';
    } catch {
      /* Use the screen size when storage is unavailable. */
    }
    return window.matchMedia('(orientation: portrait) and (min-width: 600px)')
      .matches;
  });
  const [fullscreenHint, setFullscreenHint] = useState(false);
  const httpsUrl = new URL(location.href);
  httpsUrl.protocol = 'https:';
  httpsUrl.port = '5176';
  const [language, setLanguage] = useState<StudioLanguage>(() => {
    try {
      return localStorage.getItem('forma-studio-language') === 'zh-Hant'
        ? 'zh-Hant'
        : 'en';
    } catch {
      return 'en';
    }
  });
  const t = (en: string, zh: string) => (language === 'en' ? en : zh);
  const [index, setIndex] = useState(0);
  const [screen, setScreen] = useState<'choose' | 'ready' | 'exercise'>(
    'choose',
  );
  const [pauseReason, setPauseReason] = useState<'gesture' | 'tracking'>(
    'gesture',
  );
  const [saveError, setSaveError] = useState(false);
  const [sound, setSound] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const lastReward = useRef(0);
  const lastSeen = useRef(performance.now());
  const lastBodySeen = useRef(performance.now());
  const bodySince = useRef<number | null>(null);
  const [bodyReady, setBodyReady] = useState(false);
  const [personPresent, setPersonPresent] = useState(false);
  const exercise = localizeExercise(exercises[index], language);
  const save = useCallback((record: SessionRecord) => {
    try {
      localStorage.setItem(
        'forma-sessions',
        JSON.stringify([record, ...readHistory()].slice(0, 100)),
      );
    } catch {
      setSaveError(true);
    }
  }, []);
  const session = useSession(exercise, 'guided', 5, 'camera', save);
  const complete = session.phase === 'rest' || session.phase === 'complete';
  const active = screen === 'exercise' && !complete;
  const navigating = !active || session.paused;
  const input = useKioskInput(
    root,
    navigating,
    active && !session.paused,
    () => {
      setPauseReason('gesture');
      session.setPaused(true);
    },
  );
  const tracker = usePoseTracker({
    overlay: true,
    tweening: true,
    onFrame: (points: Landmark[], time: number, aspect: number) => {
      const now = performance.now();
      const present = upperBodyVisible(points);
      setPersonPresent(present);
      if (present) lastSeen.current = now;
      if (bodyVisible(points)) {
        lastBodySeen.current = now;
        bodySince.current ??= now;
        setBodyReady(now - bodySince.current >= 500);
      } else {
        bodySince.current = null;
        setBodyReady(false);
      }
      input.onFrame(points);
      if (!document.hidden) session.onFrame(points, time, aspect);
    },
    onSeek: session.onSeek,
  });
  // Camera access still needs permission at first installation. Subsequent kiosk
  // visits can start without a mouse when that permission is already granted.
  useEffect(() => {
    void tracker.startCamera();
    return tracker.stop;
  }, [tracker.startCamera, tracker.stop]);
  const browse = () => {
    session.finish();
    session.reset();
    input.clear();
    setScreen('choose');
    lastReward.current = 0;
  };
  const latest = useRef({
    active,
    paused: session.paused,
    screen,
    browse,
    pause: session.setPaused,
  });
  latest.current = {
    active,
    paused: session.paused,
    screen,
    browse,
    pause: session.setPaused,
  };
  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = latest.current;
      const missing = performance.now() - lastSeen.current;
      const bodyMissing = performance.now() - lastBodySeen.current;
      if (bodyMissing > 350) {
        bodySince.current = null;
        setBodyReady(false);
      }
      if (missing > 350) setPersonPresent(false);
      if (state.active && !state.paused && bodyMissing > 1800) {
        setPauseReason('tracking');
        state.pause(true);
      }
      if (state.screen !== 'choose' && missing > 45000) {
        state.browse();
        lastSeen.current = performance.now();
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);
  const count = Math.min(
    exercise.target,
    exercise.unit === 'reps'
      ? session.stats.reps
      : Math.floor(session.stats.hold),
  );
  useEffect(() => {
    if (
      count > lastReward.current &&
      sound &&
      audio.current?.state === 'running'
    ) {
      const context = audio.current;
      const now = context.currentTime;
      const notes =
        count >= exercise.target ? [523.25, 659.25, 783.99] : [659.25, 880];
      notes.forEach((frequency, i) => {
        const oscillator = context.createOscillator(),
          gain = context.createGain();
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.08, now + i * 0.12 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.2);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + i * 0.12);
        oscillator.stop(now + i * 0.12 + 0.22);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      });
    }
    lastReward.current = count;
  }, [count, sound, exercise.target]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  const toggleSound = async () => {
    if (sound) {
      setSound(false);
      return;
    }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      const ready = audio.current.state === 'running';
      setSound(ready);
      setAudioError(!ready);
    } catch {
      setAudioError(true);
    }
  };
  const start = () => {
    if (!bodyReady) return;
    lastBodySeen.current = performance.now();
    lastSeen.current = performance.now();
    lastReward.current = 0;
    session.finish();
    session.begin();
    setScreen('exercise');
    input.clear();
  };
  const change = (direction: number) => {
    setIndex((i) => (i + direction + exercises.length) % exercises.length);
  };
  const view =
    screen === 'choose'
      ? 'choose'
      : screen === 'ready'
        ? 'ready'
        : complete
          ? 'complete'
          : session.paused
            ? 'paused'
            : 'practice';
  const button = (
    id: string,
    label: string,
    action: () => void,
    disabled = false,
    primary = false,
  ) => (
    <button
      data-kiosk-action={id}
      disabled={disabled}
      className={`kiosk-button ${primary ? 'primary' : ''} ${input.cursor?.target === id ? 'targeted' : ''}`}
      onClick={action}
    >
      {label}
    </button>
  );
  return (
    <div
      className="kiosk-shell"
      data-view={view}
      data-layout={cameraView ? 'camera' : 'split'}
      ref={root}
      lang={language}
    >
      <header className="kiosk-header">
        <h1>{t('Movement · Kiosk', '動作互動站')}</h1>
        <div
          className="kiosk-teacher-controls"
          aria-label={t('Teacher controls', '老師控制')}
        >
          <button
            aria-pressed={cameraView}
            onClick={() => {
              const next = !cameraView;
              setCameraView(next);
              try {
                localStorage.setItem(
                  'forma-kiosk-layout',
                  next ? 'camera' : 'split',
                );
              } catch {
                /* Layout still works. */
              }
            }}
          >
            {cameraView
              ? t('Split view', '分欄顯示')
              : t('Camera view', '鏡頭全畫面')}
          </button>
          <button
            data-kiosk-action={navigating ? 'language' : undefined}
            onClick={() => {
              const next = language === 'en' ? 'zh-Hant' : 'en';
              setLanguage(next);
              try {
                localStorage.setItem('forma-studio-language', next);
              } catch {
                /* Session language still works. */
              }
            }}
          >
            {language === 'en' ? '繁中' : 'English'}
          </button>
          <button aria-pressed={sound} onClick={() => void toggleSound()}>
            {sound ? t('Sound on', '聲音開啟') : t('Sound off', '聲音關閉')}
          </button>
          <button
            onClick={() =>
              void toggleFullscreen().catch(() => {
                setCameraView(true);
                setFullscreenHint(true);
              })
            }
          >
            {fullscreen
              ? t('Exit full screen', '離開全螢幕')
              : t('Full screen', '全螢幕')}
          </button>
          <button
            onClick={() => {
              session.finish();
              tracker.stop();
              onExit();
            }}
          >
            {t('Teacher studio', '老師工作室')}
          </button>
        </div>
      </header>
      <main className="kiosk-layout">
        <section
          className="kiosk-camera"
          aria-label={t('Camera preview', '鏡頭預覽')}
        >
          <video
            ref={tracker.videoRef}
            muted
            playsInline
            className="kiosk-video"
          />
          <canvas
            ref={tracker.canvasRef}
            className="kiosk-skeleton"
            aria-hidden="true"
          />
          {!tracker.media && !tracker.error && (
            <div className="kiosk-camera-message">
              <strong>{t('Let’s get ready', '準備開始')}</strong>
              <p>
                {t(
                  'A teacher may need to allow the camera first.',
                  '首次使用，請老師允許使用鏡頭。',
                )}
              </p>
              <button
                className="kiosk-button primary"
                disabled={tracker.cameraStarting}
                onClick={() => void tracker.startCamera()}
              >
                {tracker.cameraStarting
                  ? t('Opening camera…', '鏡頭開啟中…')
                  : t('Enable camera', '開啟鏡頭')}
              </button>
            </div>
          )}
          {tracker.media && tracker.status === 'loading' && (
            <div className="kiosk-camera-message" role="status">
              {t('Getting the camera ready…', '正在準備鏡頭…')}
            </div>
          )}
          {tracker.error && (
            <div className="kiosk-camera-message" role="alert">
              <strong>{t('Camera needs help', '請老師協助設定鏡頭')}</strong>
              {!window.isSecureContext && (
                <p>
                  {t(
                    'Open the HTTPS address to enable the camera on this device.',
                    '請使用 HTTPS 網址，才能在這部裝置開啟鏡頭。',
                  )}
                  <a className="kiosk-button" href={httpsUrl.href}>
                    {t('Open HTTPS', '改用 HTTPS')}
                  </a>
                </p>
              )}
              <details>
                <summary>{t('Camera details', '鏡頭詳情')}</summary>
                <p>{tracker.error}</p>
              </details>
              <p>
                {t(
                  'Check camera access, then reconnect.',
                  '請檢查鏡頭權限，再重新連接。',
                )}
              </p>
              <button
                className="kiosk-button"
                onClick={() => void tracker.startCamera()}
              >
                {t('Reconnect camera', '重新連接鏡頭')}
              </button>
            </div>
          )}
          {tracker.status === 'ready' && (
            <div className="kiosk-camera-caption">
              {personPresent
                ? t('I can see you', '看見你了')
                : t(
                    'Show your shoulders and raise a hand to choose',
                    '讓鏡頭看見雙肩，舉手選擇',
                  )}
            </div>
          )}
          {screen === 'exercise' &&
            session.phase === 'setup' &&
            !session.paused && (
              <div className="kiosk-countdown" role="status">
                <strong>
                  {session.analysis.visible
                    ? Math.max(1, 3 - Math.floor(session.setupTime))
                    : '…'}
                </strong>
                <span>{t('Stand ready', '站好，準備')}</span>
              </div>
            )}
          {input.pauseProgress > 0 && (
            <div className="kiosk-pause-progress" role="status">
              {t('Keep arms crossed to pause', '保持雙手交叉以暫停')}
              <progress value={input.pauseProgress} max={1} />
            </div>
          )}
        </section>
        <section
          className="kiosk-panel"
          aria-label={t('Movement activity', '動作活動')}
        >
          {screen === 'choose' ? (
            <>
              <p className="kiosk-eyebrow">
                {t('Choose a movement', '選擇動作')} · {index + 1}/
                {exercises.length}
              </p>
              <button
                className={`kiosk-choice ${input.cursor?.target === 'choose' ? 'targeted' : ''}`}
                data-kiosk-action="choose"
                onClick={() => setScreen('ready')}
              >
                <PoseArt pose={exercise.id} />
                <h2>{exercise.name}</h2>
                <p>{exercise.duration}</p>
                <strong>{t('Choose this movement', '選擇這個動作')} →</strong>
              </button>
              <div className="kiosk-actions">
                {button('previous', t('← Previous', '← 上一個'), () =>
                  change(-1),
                )}
                {button('next', t('Next →', '下一個 →'), () => change(1))}
              </div>
            </>
          ) : screen === 'ready' ? (
            <>
              <h2>{exercise.name}</h2>
              <MovementDemo
                key={exercise.id}
                exercise={exercise}
                language={language}
                autoPlay
                gestureControls
              />
              {!bodyReady && (
                <p role="status">
                  {t(
                    'Step back until your whole body and feet are visible before starting.',
                    '開始前，請退後至鏡頭看見全身及雙腳。',
                  )}
                </p>
              )}
              <div className="kiosk-actions">
                {button('back', t('Choose another', '選其他動作'), browse)}
                {button(
                  'start',
                  t('I’m ready →', '準備好了 →'),
                  start,
                  tracker.status !== 'ready' || !bodyReady,
                  true,
                )}
              </div>
            </>
          ) : complete ? (
            <>
              <div className="kiosk-celebration" aria-hidden="true">
                <span>✦</span>
                <span>★</span>
                <span>✦</span>
              </div>
              <h2>{t('You did it!', '你做到了！')}</h2>
              <p className="kiosk-result">
                {count} / {exercise.target}{' '}
                {exercise.unit === 'reps'
                  ? t('movements', '次動作')
                  : t('seconds', '秒')}
              </p>
              <p>
                {t(
                  bodyReady
                    ? 'Take a breath. Choose what’s next.'
                    : 'Show your whole body and feet to play again, or choose another movement.',
                  bodyReady
                    ? '休息一下，再選擇下一步。'
                    : '再玩一次前，請讓鏡頭看見全身及雙腳，或選其他動作。',
                )}
              </p>
              <div className="kiosk-actions">
                {button(
                  'again',
                  t('Try again', '再玩一次'),
                  start,
                  tracker.status !== 'ready' || !bodyReady,
                )}
                {button(
                  'another',
                  t('Choose another →', '選其他動作 →'),
                  browse,
                  false,
                  true,
                )}
              </div>
            </>
          ) : session.paused ? (
            <>
              <h2>{t('Let’s pause', '休息一下')}</h2>
              <p>
                {pauseReason === 'tracking' || !bodyReady
                  ? t(
                      'Show your whole body, including your feet, to resume. Your progress is saved here.',
                      '讓鏡頭看見全身及雙腳再繼續，進度仍然保留。',
                    )
                  : t(
                      'Lower your arms, then choose Resume.',
                      '先放下雙手，再選擇繼續。',
                    )}
              </p>
              <strong className="kiosk-result">
                {count} / {exercise.target}
              </strong>
              <div className="kiosk-actions">
                {button(
                  'resume',
                  t('Resume →', '繼續 →'),
                  () => {
                    if (!bodyReady) return;
                    lastBodySeen.current = performance.now();
                    session.setPaused(false);
                    input.clear();
                  },
                  tracker.status !== 'ready' || !bodyReady,
                  true,
                )}
                {button('finish', t('Finish', '結束'), browse)}
              </div>
            </>
          ) : (
            <>
              <h2>{exercise.name}</h2>
              <div
                className="kiosk-score"
                role="status"
                aria-label={t('Progress', '進度')}
              >
                <strong key={count}>
                  {count}
                  <small> / {exercise.target}</small>
                </strong>
                <span>
                  {exercise.unit === 'reps'
                    ? t('movements completed', '已完成動作')
                    : t('seconds held', '保持秒數')}
                </span>
              </div>
              <div className="kiosk-stars" aria-hidden="true">
                {Array.from({ length: exercise.target }, (_, i) => (
                  <span key={i} className={i < count ? 'earned' : ''}>
                    ★
                  </span>
                ))}
              </div>
              <MovementDemo
                key={exercise.id}
                exercise={exercise}
                language={language}
                autoPlay
                showControls={false}
              />
              <p className="kiosk-coaching">
                {translateStudio(session.coaching.cue, language)}
              </p>
              <button
                className="kiosk-button"
                onClick={() => {
                  setPauseReason('gesture');
                  session.setPaused(true);
                }}
              >
                {t('Pause', '暫停')}
              </button>
            </>
          )}
        </section>
      </main>
      <footer className="kiosk-help">
        <strong>
          {navigating
            ? t(
                'Raise either hand · Move the dot · Hold to choose',
                '舉起一隻手 · 移動圓點 · 停留選擇',
              )
            : t(
                'To pause: cross your hands at your chest and hold',
                '暫停：雙手在胸前交叉並保持',
              )}
        </strong>
        <span>
          {navigating
            ? t(
                'Lower your hand after choosing. Touch also works.',
                '選好後放下手。也可觸碰按鈕。',
              )
            : t(
                'Move at your own pace. Every completed movement counts.',
                '按自己的速度活動，完成一次便計一次。',
              )}
        </span>
        {saveError && (
          <p role="alert">
            {t(
              'History could not be saved on this device.',
              '這部裝置未能儲存記錄。',
            )}
          </p>
        )}
        {audioError && (
          <p role="status">
            {t(
              'A teacher can tap Sound to enable audio.',
              '請老師點按聲音按鈕以開啟音效。',
            )}
          </p>
        )}
        {fullscreenHint && (
          <p role="status">
            {t(
              'Camera view fills the page. This browser keeps its toolbar visible.',
              '鏡頭已填滿網頁；這個瀏覽器仍會顯示工具列。',
            )}
          </p>
        )}
      </footer>
      {input.cursor && navigating && (
        <div
          className="kiosk-cursor"
          aria-hidden="true"
          style={{
            left: `${input.cursor.x * 100}%`,
            top: `${input.cursor.y * 100}%`,
          }}
        >
          <svg viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="27" className="cursor-track" />
            <circle
              cx="32"
              cy="32"
              r="27"
              className="cursor-fill"
              pathLength="1"
              strokeDasharray={`${input.cursor.progress} 1`}
            />
          </svg>
          <span />
        </div>
      )}
    </div>
  );
}
