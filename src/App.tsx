import { readHistory } from './lib/sessionHistory';
import { useEffect, useRef, useState } from 'react';
import zhHK from 'antd/locale/zh_HK';
import enUS from 'antd/locale/en_US';
import {
  Alert,
  Button,
  ConfigProvider,
  Drawer,
  Empty,
  Modal,
  Progress,
  Segmented,
  Select,
  Slider,
  Switch,
  Tag,
  Tooltip,
} from 'antd';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  AudioLines,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Expand,
  Flower2,
  Focus,
  History,
  LayoutGrid,
  Leaf,
  ListVideo,
  Maximize,
  Minimize,
  Pause,
  Play,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Target,
  TrendingUp,
  Upload,
  Monitor,
} from 'lucide-react';
import {
  availableExercises,
  activeCollection,
  isAvailableExercise,
  getExercise as getRawExercise,
  localizeExercise,
} from './catalog';
import { translateStudio } from './lib/studioLanguage';
import { categoryZh } from './catalog';
import type { StudioLanguage } from './catalog';
import {
  canStartRoutine,
  parseRoutines,
  routineStorageKey,
} from './lib/routines';
import type { Routine } from './lib/routines';
import { RoutineBuilder } from './components/RoutineBuilder';
import { TeacherReview, reviewTime } from './components/TeacherReview';
import type { ExerciseId } from './catalog';
import { formatTime } from './lib/analysis';
import type { SessionRecord } from './lib/analysis';
import { usePoseTracker } from './hooks/usePoseTracker';
import { useSession } from './hooks/useSession';
import { MovementDemo } from './components/MovementDemo';
import { PoseArt } from './components/PoseArt';

import { popupContainer, useAppFullscreen } from './hooks/useAppFullscreen';
import { useDropdownLayer } from './hooks/useDropdownLayer';

type Page = 'studio' | 'library' | 'history' | 'routines';
export default function App({
  onOpenPosture,
  onOpenKiosk,
}: {
  onOpenPosture: () => void;
  onOpenKiosk?: () => void;
}) {
  const [language, setLanguage] = useState<StudioLanguage>(() => {
    try {
      return localStorage.getItem('forma-studio-language') === 'zh-Hant'
        ? 'zh-Hant'
        : 'en';
    } catch {
      return 'en';
    }
  });
  const tr = (text: string) => translateStudio(text, language);
  const t = (en: string, zh: string) => (language === 'en' ? en : zh);
  const exercises = availableExercises.map((e) =>
    localizeExercise(e, language),
  );
  const getExercise = (id: ExerciseId) =>
    localizeExercise(getRawExercise(id), language);
  const [routines, setRoutines] = useState<Routine[]>(() => {
    try {
      return parseRoutines(localStorage.getItem(routineStorageKey) ?? '[]');
    } catch {
      return [];
    }
  });
  const [run, setRun] = useState<{ routine: Routine; index: number } | null>(
    null,
  );
  const [page, setPage] = useState<Page>('studio');
  const [mode, setMode] = useState<'guided' | 'free'>('guided');
  const [selected, setSelected] = useState<ExerciseId>(
    availableExercises[0].id,
  );
  const [source, setSource] = useState<'camera' | 'video'>('camera');
  const [overlay, setOverlay] = useState(true),
    [tweening, setTweening] = useState(true),
    [mirror, setMirror] = useState(true),
    [sound, setSound] = useState(false);
  const [tolerance, setTolerance] = useState(5);
  const [settings, setSettings] = useState(false),
    [help, setHelp] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [history, setHistory] = useState<SessionRecord[]>(readHistory);
  const [storageWarning, setStorageWarning] = useState(false);
  const [category, setCategory] = useState('All exercises');
  const uploadRef = useRef<HTMLInputElement>(null),
    studioRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const { fullscreen, toggleFullscreen } = useAppFullscreen(appRef);
  const dropdownContainer = useDropdownLayer();
  const baseExercise = getExercise(selected);
  const stepTarget = run?.routine.steps[run.index].target;
  const exercise =
    stepTarget && baseExercise.support === 'automatic'
      ? {
          ...baseExercise,
          target: stepTarget,
          duration: `${stepTarget} ${baseExercise.unit === 'seconds' ? t('sec hold', '秒保持') : t('reps', '次動作')}`,
        }
      : baseExercise;
  const reviewOnly = exercise.support === 'review';
  function storeRoutines(next: Routine[]) {
    setRoutines(next);
    try {
      localStorage.setItem(routineStorageKey, JSON.stringify(next));
    } catch {
      setStorageWarning(true);
    }
  }
  const save = (record: SessionRecord) => {
    setHistory((prev) => {
      const next = [record, ...prev].slice(0, 100);
      try {
        localStorage.setItem('forma-sessions', JSON.stringify(next));
      } catch {
        setStorageWarning(true);
      }
      return next;
    });
  };
  const session = useSession(
    exercise,
    mode,
    tolerance,
    source,
    save,
    run
      ? {
          id: run.routine.id,
          name: run.routine.name,
          step: run.index + 1,
          total: run.routine.steps.length,
        }
      : undefined,
  );
  const tracker = usePoseTracker({
    overlay,
    tweening,
    onFrame: session.onFrame,
    onSeek: session.onSeek,
  });
  const active = ['setup', 'practice', 'rest'].includes(session.phase);
  const lastSpoken = useRef('');
  useEffect(() => {
    if (
      sound &&
      !reviewOnly &&
      active &&
      !session.paused &&
      tr(session.coaching.cue) !== lastSpoken.current &&
      'speechSynthesis' in window
    ) {
      lastSpoken.current = tr(session.coaching.cue);
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(tr(session.coaching.cue));
      utterance.lang = language === 'zh-Hant' ? 'zh-HK' : 'en-GB';
      utterance.rate = 0.88;
      window.speechSynthesis.speak(utterance);
    }
    if (!sound || reviewOnly || !active || session.paused) {
      window.speechSynthesis?.cancel();
      lastSpoken.current = '';
    }
  }, [
    sound,
    active,
    session.paused,
    session.coaching.cue,
    language,
    reviewOnly,
  ]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  useEffect(() => {
    if (tracker.status === 'error' && active) {
      if (session.stats.duration > 0) session.finish();
      else session.reset();
    }
  }, [
    tracker.status,
    active,
    session.stats.duration,
    session.finish,
    session.reset,
  ]);
  useEffect(() => {
    if (session.phase === 'rest' || session.phase === 'complete')
      tracker.videoRef.current?.pause();
    if (session.phase === 'complete' && source === 'camera') tracker.stop();
  }, [session.phase, tracker.videoRef, source, tracker.stop]);
  function navigate(next: Page) {
    if (next !== page) {
      if (active) session.finish();
      tracker.stop();
      setPage(next);
    }
  }
  function changeSource(next: 'camera' | 'video') {
    if (active) session.finish();
    session.reset();
    tracker.stop();
    setSource(next);
  }
  function changeMode(next: 'guided' | 'free') {
    if (active) session.finish();
    session.reset();
    setMode(next);
  }
  function chooseExercise(id: ExerciseId, keepRoutine = false) {
    if (!isAvailableExercise(id)) return;
    if (!keepRoutine) setRun(null);
    if (active) session.finish();
    session.reset();
    setSelected(id);
    if (page !== 'studio') setPage('studio');
  }
  function startRoutine(routine: Routine) {
    if (!canStartRoutine(routine)) return;
    chooseExercise(routine.steps[0].exercise, true);
    setRun({ routine, index: 0 });
    setMode('guided');
  }
  function nextRoutineStep() {
    if (!run || !canStartRoutine(run.routine)) return;
    session.setRecap(null);
    if (run.index + 1 >= run.routine.steps.length) {
      setRun(null);
      session.reset();
      setPage('routines');
    } else {
      const index = run.index + 1;
      chooseExercise(run.routine.steps[index].exercise, true);
      setRun({ routine: run.routine, index });
    }
  }
  async function begin() {
    if (!isAvailableExercise(selected)) return;
    session.begin();
    if (!tracker.media) {
      if (source === 'camera') await tracker.startCamera();
      else {
        session.reset();
        uploadRef.current?.click();
      }
    } else if (tracker.status === 'ready' && !tracker.playing)
      tracker.togglePlay();
  }
  function finish() {
    session.finish();
    tracker.videoRef.current?.pause();
    if (source === 'camera') tracker.stop();
  }
  function pause() {
    session.setPaused(!session.paused);
    if (source === 'video') {
      if (session.paused && !tracker.playing) tracker.togglePlay();
      else if (!session.paused && tracker.playing) tracker.togglePlay();
    }
  }
  function uploadFile(file?: File) {
    if (!file) return;
    if (active) session.finish();
    if (tracker.upload(file)) {
      session.reset();
      setSource('video');
    }
  }
  function exportRecap(record: SessionRecord) {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { ...record, exerciseName: getExercise(record.exercise).name },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `forma-${record.date.slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const metricValue =
    exercise.unit === 'reps'
      ? session.stats.reps
      : Math.floor(session.stats.hold);
  const hasTracking = tracker.status === 'ready' && session.analysis.visible;
  const hasCoachingTracking =
    tracker.status === 'ready' && session.coaching.visible;
  const elapsed = formatTime(session.stats.duration);
  const recapIsCurrentStep =
    !!run &&
    session.recap?.routine?.id === run.routine.id &&
    session.recap.routine.step === run.index + 1 &&
    session.phase === 'complete';
  const selectedIndex = exercises.findIndex((e) => e.id === selected);
  return (
    <ConfigProvider
      locale={language === 'zh-Hant' ? zhHK : enUS}
      getPopupContainer={popupContainer}
      theme={{ token: { borderRadius: 5, controlHeight: 32 } }}
    >
      <div className="app-shell" ref={appRef} lang={language}>
        <header className="studio-header">
          <h1>
            <Activity size={19} />
            {tr('Movement Studio')}
          </h1>
          <nav aria-label={tr('Main navigation')}>
            <button
              aria-label={tr('Movement studio')}
              aria-current={page === 'studio' ? 'page' : undefined}
              className={page === 'studio' ? 'selected' : ''}
              onClick={() => navigate('studio')}
            >
              <LayoutGrid size={16} />
              <span>{tr('Practice')}</span>
            </button>
            <button
              aria-label={tr('Exercise library')}
              aria-current={page === 'library' ? 'page' : undefined}
              className={page === 'library' ? 'selected' : ''}
              onClick={() => navigate('library')}
            >
              <Flower2 size={16} />
              <span>{t('Exercises', '動作')}</span>
            </button>
            <button
              aria-label={tr('My progress')}
              aria-current={page === 'history' ? 'page' : undefined}
              className={page === 'history' ? 'selected' : ''}
              onClick={() => navigate('history')}
            >
              <History size={16} />
              <span>{tr('History')}</span>
              {history.length > 0 && <small>{history.length}</small>}
            </button>
            <button
              aria-label={t('Movement combinations', '動作組合')}
              aria-current={page === 'routines' ? 'page' : undefined}
              className={page === 'routines' ? 'selected' : ''}
              onClick={() => navigate('routines')}
            >
              <ListVideo size={16} />
              <span>{t('Combinations', '組合')}</span>
            </button>
          </nav>
          <div className="studio-header-actions">
            <Select
              size="small"
              aria-label="Language / 語言"
              getPopupContainer={dropdownContainer}
              popupMatchSelectWidth={96}
              value={language}
              onChange={(value: StudioLanguage) => {
                setLanguage(value);
                try {
                  localStorage.setItem('forma-studio-language', value);
                } catch {
                  setStorageWarning(true);
                }
              }}
              options={[
                { value: 'en', label: 'EN' },
                { value: 'zh-Hant', label: '繁中' },
              ]}
            />
            {onOpenKiosk && (
              <button
                className="text-button workspace-link"
                onClick={() => {
                  if (active) session.finish();
                  tracker.stop();
                  onOpenKiosk();
                }}
              >
                {t('Kiosk', '互動站')}
              </button>
            )}
            <button
              className="text-button workspace-link"
              aria-label={tr('Posture Monitor')}
              title={tr('Posture Monitor')}
              onClick={() => {
                if (active) session.finish();
                tracker.stop();
                onOpenPosture();
              }}
            >
              <Monitor size={17} />
              <span>{tr('Posture Monitor')}</span>
            </button>
            <Button
              type="text"
              aria-label={tr('Setup guide')}
              title={tr('Setup guide')}
              icon={<CircleHelp size={17} />}
              onClick={() => setHelp(true)}
            />
            <Button
              type="text"
              aria-label={
                fullscreen ? tr('Exit fullscreen') : tr('Fullscreen app')
              }
              title={fullscreen ? tr('Exit fullscreen') : tr('Fullscreen app')}
              icon={
                fullscreen ? <Minimize size={17} /> : <Maximize size={17} />
              }
              onClick={() => void toggleFullscreen().catch(() => {})}
            />
            <Button
              type="text"
              aria-label={tr('Preferences')}
              title={tr('Preferences')}
              icon={<Settings2 size={17} />}
              onClick={() => setSettings(true)}
            />
          </div>
        </header>
        <main
          className={`main-content ${page === 'studio' ? 'practice-content' : ''}`}
        >
          {page === 'studio' && (
            <>
              <div
                className="workspace-tabs"
                role="tablist"
                aria-label={tr('Studio mode')}
              >
                <button
                  role="tab"
                  aria-selected={mode === 'guided'}
                  className={mode === 'guided' ? 'active' : ''}
                  onClick={() => changeMode('guided')}
                >
                  <Sparkles size={17} />
                  {reviewOnly
                    ? t('Teacher review', '老師檢視')
                    : tr('Guided practice')}
                </button>
                <button
                  role="tab"
                  aria-selected={mode === 'free'}
                  className={mode === 'free' ? 'active' : ''}
                  onClick={() => changeMode('free')}
                >
                  <ScanLine size={18} />
                  {tr('Open analysis')}
                </button>
                <span className="collection-label">
                  {activeCollection.locales[language].name}
                </span>
              </div>
              <div
                className="exercise-picker"
                role="group"
                aria-label={tr('Exercise')}
              >
                <span>{tr('Exercise')}</span>
                <Select
                  className="movement-select"
                  aria-label={t('Choose exercise', '選擇動作')}
                  getPopupContainer={dropdownContainer}
                  virtual={false}
                  showSearch
                  optionFilterProp="label"
                  value={selected}
                  onChange={(id) => chooseExercise(id)}
                  options={exercises.map((e) => ({
                    value: e.id,
                    label: `${e.name} · ${e.support === 'review' ? t('Teacher review', '老師檢視') : run && e.id === selected ? exercise.duration : e.duration}`,
                  }))}
                />
                <button
                  className="text-button"
                  onClick={() => setInstructions(true)}
                >
                  <CircleHelp size={14} />
                  {tr('Pose guide')}
                </button>
              </div>
              {run && (
                <div className="routine-progress" role="status">
                  <strong>{run.routine.name}</strong>
                  <span>
                    {t('Step', '步驟')} {run.index + 1} /{' '}
                    {run.routine.steps.length} · {exercise.name}
                  </span>
                  {session.phase === 'complete' && (
                    <Button size="small" onClick={nextRoutineStep}>
                      {run.index + 1 < run.routine.steps.length
                        ? t('Next step', '下一步')
                        : t('Finish combination', '完成組合')}
                    </Button>
                  )}
                  <Button
                    size="small"
                    onClick={() => {
                      if (active) finish();
                      setRun(null);
                    }}
                  >
                    {t('Exit combination', '離開組合')}
                  </Button>
                </div>
              )}
              <div className="studio-grid">
                <section className="camera-panel" ref={studioRef}>
                  <div className="panel-toolbar">
                    <Segmented
                      aria-label={tr('Input source')}
                      value={source}
                      onChange={(value) =>
                        changeSource(value as 'camera' | 'video')
                      }
                      options={[
                        {
                          value: 'camera',
                          label: (
                            <span className="inline">
                              <Camera size={15} />
                              {tr('Live camera')}
                            </span>
                          ),
                        },
                        {
                          value: 'video',
                          label: (
                            <span className="inline">
                              <Upload size={15} />
                              {tr('Upload video')}
                            </span>
                          ),
                        },
                      ]}
                    />
                    <div className="toolbar-right">
                      <Tooltip title={tr('Expand preview')}>
                        <Button
                          type="text"
                          aria-label={tr('Expand preview')}
                          icon={<Expand size={17} />}
                          onClick={() => {
                            if (document.fullscreenElement)
                              void document.exitFullscreen();
                            else
                              void studioRef.current
                                ?.requestFullscreen?.()
                                .catch(() => {});
                          }}
                        />
                      </Tooltip>
                    </div>
                  </div>
                  <div
                    className={`video-stage ${tracker.media ? 'has-media' : ''}`}
                    onDragOver={(e) => {
                      if (source === 'video') e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (source === 'video')
                        uploadFile(e.dataTransfer.files[0]);
                    }}
                  >
                    <div className="stage-top">
                      <span className="stage-status">
                        <span
                          className={`status-dot ${hasTracking ? 'green' : ''}`}
                        />
                        {tracker.status === 'loading'
                          ? tr('Loading model')
                          : tracker.media
                            ? reviewOnly
                              ? t('Teacher review', '老師檢視')
                              : hasTracking
                                ? tr('Body in frame')
                                : tr('Body not in frame')
                            : tr('Camera off')}
                      </span>
                      <span className="stage-quality">
                        {tracker.media ? (
                          <>
                            <Activity size={13} />{' '}
                            {tracker.status === 'ready'
                              ? tr('Tracking ready')
                              : tr('Loading model')}
                          </>
                        ) : (
                          <>
                            <ScanLine size={13} />
                            {tr('POSE TRACKING')}
                          </>
                        )}
                      </span>
                    </div>
                    <div
                      className={`media-layer ${mirror && source === 'camera' ? 'mirrored' : ''}`}
                      style={{
                        visibility: tracker.media ? 'visible' : 'hidden',
                      }}
                    >
                      <video
                        ref={tracker.videoRef}
                        playsInline
                        muted
                        preload="auto"
                        aria-label={
                          source === 'camera'
                            ? tr('Live camera preview')
                            : tr('Uploaded video preview')
                        }
                      />
                      <canvas
                        ref={tracker.canvasRef}
                        aria-label={tr('Body landmark overlay')}
                      />
                    </div>
                    {!tracker.media && (
                      <div className="camera-empty">
                        {source === 'camera' ? (
                          <Camera size={32} />
                        ) : (
                          <Upload size={32} />
                        )}
                        <h3>
                          {source === 'camera'
                            ? tr('Camera preview')
                            : tr('Video analysis')}
                        </h3>
                        <p>
                          {source === 'camera'
                            ? tr(
                                'Enable the camera with your full body in view.',
                              )
                            : tr('Choose or drop a video here.')}
                        </p>
                        <Button
                          className="enable-button"
                          icon={
                            source === 'camera' ? (
                              <Camera size={16} />
                            ) : (
                              <Upload size={16} />
                            )
                          }
                          loading={tracker.cameraStarting}
                          onClick={() =>
                            source === 'camera'
                              ? void tracker.startCamera()
                              : uploadRef.current?.click()
                          }
                        >
                          {source === 'camera'
                            ? tr('Enable camera')
                            : tr('Choose a video')}
                        </Button>
                        <span className="camera-small">
                          {source === 'camera'
                            ? tr('Processed on your device')
                            : tr(
                                'MP4, WebM or MOV · up to 500 MB · stays on your device',
                              )}
                        </span>
                      </div>
                    )}
                    {tracker.media && tracker.status === 'loading' && (
                      <div className="loading-overlay">
                        <div className="loading-orbit" />
                        <h3>{tr('Loading pose tracking…')}</h3>
                        <p>{tr('Loading the pose model on your device.')}</p>
                      </div>
                    )}
                    {tracker.media &&
                      session.phase === 'setup' &&
                      tracker.status === 'ready' && (
                        <div className="countdown-overlay">
                          <span>
                            {session.analysis.visible ? (
                              Math.max(1, 3 - Math.floor(session.setupTime))
                            ) : (
                              <Maximize size={26} />
                            )}
                          </span>
                          <p>
                            {session.analysis.visible
                              ? tr('Hold still for the countdown.')
                              : tr(session.analysis.cue)}
                          </p>
                        </div>
                      )}
                    {session.phase === 'rest' && (
                      <div className="countdown-overlay rest">
                        <Leaf size={28} />
                        <h3>{tr('Rest')}</h3>
                        <span>{session.restTime}</span>
                        <p>
                          {tr('You’ve completed your')}{' '}
                          {exercise.unit === 'reps'
                            ? tr('repetitions')
                            : tr('hold')}
                          .
                        </p>
                      </div>
                    )}
                    {session.paused && tracker.media && (
                      <div className="paused-overlay">
                        <Pause size={24} />
                        <span>{tr('Practice paused')}</span>
                        <Button onClick={pause}>{tr('Resume practice')}</Button>
                      </div>
                    )}
                    <div className="stage-bottom">
                      <span>
                        <Focus size={15} />
                        {source === 'camera'
                          ? tr('Keep your whole body in view')
                          : tracker.media?.kind === 'video'
                            ? tracker.media.name
                            : tr('A full-body view works best')}
                      </span>
                      {tracker.media && source === 'camera' && (
                        <button
                          className="stage-stop"
                          onClick={() => {
                            if (active) session.finish();
                            tracker.stop();
                          }}
                        >
                          <Square size={12} />
                          {tr('Camera off')}
                        </button>
                      )}
                    </div>
                  </div>
                  {tracker.error && (
                    <Alert
                      title={tr(tracker.error)}
                      type="warning"
                      showIcon
                      closable
                      className="tracking-alert"
                    />
                  )}
                  {source === 'video' && tracker.media && (
                    <div className="video-controls">
                      <Button
                        type="text"
                        aria-label={
                          tracker.playing ? tr('Pause video') : tr('Play video')
                        }
                        disabled={tracker.status !== 'ready'}
                        icon={
                          tracker.playing ? (
                            <Pause size={17} />
                          ) : (
                            <Play size={17} />
                          )
                        }
                        onClick={tracker.togglePlay}
                      />
                      <span>{formatTime(tracker.time)}</span>
                      <Slider
                        aria-label={tr('Video position')}
                        value={tracker.time}
                        max={tracker.duration || 1}
                        step={0.01}
                        tooltip={{
                          formatter: (value) => formatTime(value ?? 0),
                        }}
                        onChange={tracker.seek}
                      />
                      <span>{formatTime(tracker.duration)}</span>
                      <Select
                        size="small"
                        aria-label={t('Playback speed', '播放速度')}
                        defaultValue={1}
                        onChange={(value) => {
                          if (tracker.videoRef.current)
                            tracker.videoRef.current.playbackRate = value;
                        }}
                        options={[0.25, 0.5, 1].map((value) => ({
                          value,
                          label: `${value}×`,
                        }))}
                      />
                      <Button
                        size="small"
                        aria-label={t('Back 0.1 seconds', '後退 0.1 秒')}
                        onClick={() => {
                          if (tracker.playing) tracker.togglePlay();
                          tracker.seek(Math.max(0, tracker.time - 0.1));
                        }}
                      >
                        −0.1s
                      </Button>
                      <Button
                        size="small"
                        aria-label={t('Forward 0.1 seconds', '前進 0.1 秒')}
                        onClick={() => {
                          if (tracker.playing) tracker.togglePlay();
                          tracker.seek(
                            Math.min(tracker.duration, tracker.time + 0.1),
                          );
                        }}
                      >
                        +0.1s
                      </Button>
                      <Tooltip title={tr('Change video')}>
                        <Button
                          type="text"
                          aria-label={tr('Change video')}
                          icon={<Upload size={15} />}
                          onClick={() => uploadRef.current?.click()}
                        />
                      </Tooltip>
                    </div>
                  )}
                  <div className="preview-options">
                    <label>
                      <Switch
                        size="small"
                        checked={overlay}
                        onChange={setOverlay}
                      />{' '}
                      {tr('Skeleton overlay')}
                    </label>
                    <label>
                      <Switch
                        size="small"
                        checked={mirror}
                        onChange={setMirror}
                        disabled={source === 'video'}
                      />{' '}
                      {tr('Mirror view')}
                    </label>
                    <button
                      className={`text-button audio-button ${sound ? 'on' : ''}`}
                      onClick={() => setSound(!sound)}
                    >
                      <AudioLines size={15} />
                      <span>
                        {tr('Voice cues')} {tr(sound ? 'on' : 'off')}
                      </span>
                    </button>
                  </div>
                  <div className="session-bar">
                    <div className="session-time-icon">
                      <Clock3 size={20} />
                    </div>
                    <div className="session-time">
                      <span>
                        {active
                          ? tr('SESSION IN PROGRESS')
                          : session.phase === 'complete'
                            ? tr('SESSION COMPLETE')
                            : tr('READY')}
                      </span>
                      <strong>
                        {active || session.phase === 'complete'
                          ? elapsed
                          : mode === 'guided'
                            ? exercise.duration
                            : '00:00'}
                      </strong>
                    </div>
                    <div className="session-actions">
                      {active ? (
                        <>
                          <Tooltip
                            title={
                              session.paused
                                ? tr('Resume session')
                                : tr('Pause session')
                            }
                          >
                            <Button
                              aria-label={
                                session.paused
                                  ? tr('Resume session')
                                  : tr('Pause session')
                              }
                              icon={
                                session.paused ? (
                                  <Play size={17} />
                                ) : (
                                  <Pause size={17} />
                                )
                              }
                              onClick={pause}
                            />
                          </Tooltip>
                          <Button
                            type="primary"
                            icon={<Square size={13} />}
                            onClick={finish}
                          >
                            {tr('Finish session')}
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="primary"
                          className="start-button"
                          loading={tracker.cameraStarting}
                          disabled={tracker.status === 'loading'}
                          icon={<Play size={15} fill="currentColor" />}
                          onClick={() => void begin()}
                        >
                          {session.phase === 'complete'
                            ? tr('Practice again')
                            : reviewOnly
                              ? t('Start review', '開始檢視')
                              : mode === 'guided'
                                ? tr('Start guided session')
                                : tr('Start analysis')}
                          <ArrowRight size={16} />
                        </Button>
                      )}
                    </div>
                  </div>
                </section>
                <aside className="coach-panel">
                  <div className="coach-heading">
                    <div className="coach-symbol">
                      <Sparkles size={18} />
                    </div>
                    <h2>
                      {reviewOnly
                        ? t('Teacher review', '老師檢視')
                        : t('Follow along', '跟著做')}
                    </h2>
                    <Tooltip
                      title={tr(
                        'Feedback is based on visible joint angles. A single camera cannot assess every aspect of a pose.',
                      )}
                    >
                      <CircleHelp size={15} />
                    </Tooltip>
                  </div>
                  <div className="current-exercise">
                    <span className="eyebrow">
                      {mode === 'guided' ? tr('EXERCISE') : tr('ANALYZING')}
                    </span>
                    <h3>{exercise.name}</h3>
                    <span>{exercise.subtitle}</span>
                    <p className="camera-guidance">
                      {exercise.camera === 'front'
                        ? t('Camera: front view', '鏡頭：正面')
                        : t('Camera: side view', '鏡頭：側面')}
                    </p>
                    <button
                      className="text-button pose-instructions"
                      onClick={() => setInstructions(true)}
                    >
                      {tr('View pose guide')}
                      <ArrowRight size={12} />
                    </button>
                  </div>
                  <MovementDemo
                    key={exercise.id}
                    exercise={exercise}
                    language={language}
                  />
                  {reviewOnly ? (
                    <TeacherReview
                      key={`${selected}-${session.phase === 'idle'}`}
                      language={language}
                      active={session.phase === 'practice'}
                      video={source === 'video' && !!tracker.media}
                      time={
                        source === 'video'
                          ? tracker.time
                          : session.stats.duration
                      }
                      attempts={session.attempts}
                      notes={session.notes}
                      onMark={session.markAttempt}
                      onRemove={session.removeAttempt}
                      onNotes={session.updateNotes}
                      onSeek={tracker.seek}
                    />
                  ) : (
                    <>
                      <div
                        className={`coaching-cue ${hasCoachingTracking ? 'tracking' : ''}`}
                      >
                        <div>
                          <span className="cue-dot" />
                          <strong>
                            {session.paused
                              ? tr('Paused')
                              : session.phase === 'rest'
                                ? tr('Target completed')
                                : hasCoachingTracking
                                  ? !session.coaching.needsAdjustment
                                    ? t('Keep going', '繼續吧')
                                    : t('Try this', '試試這樣做')
                                  : tr('Awaiting tracking')}
                          </strong>
                        </div>
                        <p>
                          {session.paused
                            ? tr('Resume to continue measurements.')
                            : session.phase === 'rest'
                              ? tr(
                                  'Relax your arms, release the pose, and breathe.',
                                )
                              : tracker.media
                                ? tr(session.coaching.cue)
                                : tr(
                                    'Enable the camera or load a video to see measurements.',
                                  )}
                        </p>
                      </div>
                      <div className="practice-metrics">
                        <div>
                          <span>
                            {exercise.unit === 'reps'
                              ? t('Movements completed', '已完成動作')
                              : t('Hold time', '保持時間')}
                            <Tooltip
                              title={
                                exercise.unit === 'reps'
                                  ? t(
                                      'A visible movement and return counts even when a technique adjustment is needed.',
                                      '只要能追蹤完整動作及返回起點，即使姿勢需要調整也會計算次數。',
                                    )
                                  : tr(
                                      'Only time with all alignment checks passing counts.',
                                    )
                              }
                            >
                              <CircleHelp size={12} />
                            </Tooltip>
                          </span>
                          <strong>
                            {metricValue}
                            <small>
                              {' '}
                              / {exercise.target}
                              {exercise.unit === 'seconds' ? 's' : ''}
                            </small>
                          </strong>
                          <Progress
                            percent={Math.min(
                              100,
                              (metricValue / exercise.target) * 100,
                            )}
                            showInfo={false}
                            strokeColor="#5d9b77"
                            railColor="#eaf0eb"
                            size="small"
                          />
                        </div>
                      </div>
                      <details className="teacher-measurements">
                        <summary>
                          {t('Teacher measurements', '老師測量資料')}
                        </summary>
                        <p>
                          {t(
                            'Experimental checks. Not yet validated with Primary 1–3 recordings.',
                            '實驗性檢查，尚未以小一至小三的影片驗證。',
                          )}
                        </p>
                        <div className="alignment-heading">
                          <span>{tr('Alignment check')}</span>
                          <span
                            className={`tracking-state ${hasTracking ? 'live' : ''}`}
                          >
                            {hasTracking ? tr('LIVE') : tr('WAITING')}
                          </span>
                        </div>
                        <div className="alignment-list">
                          {(hasTracking
                            ? session.analysis.checks
                            : [
                                {
                                  label: tr('Full body in frame'),
                                  value: '',
                                  good: false,
                                },
                                {
                                  label: t(
                                    'Follow the movement guide',
                                    '跟著動作指南',
                                  ),
                                  value: '',
                                  good: false,
                                },
                                {
                                  label: tr('Steady, comfortable posture'),
                                  value: '',
                                  good: false,
                                },
                              ]
                          ).map((check) => (
                            <div
                              className="alignment-row"
                              key={tr(check.label)}
                            >
                              <span
                                className={`check-icon ${hasTracking ? (check.good ? 'good' : 'adjust') : ''}`}
                              >
                                {hasTracking ? (
                                  check.good ? (
                                    <Check size={11} />
                                  ) : (
                                    <span>–</span>
                                  )
                                ) : (
                                  <span />
                                )}
                              </span>
                              <span>{tr(check.label)}</span>
                              <strong>{tr(check.value || '—')}</strong>
                            </div>
                          ))}
                        </div>
                        <div>
                          <span>{tr('Alignment')}</span>
                          <strong>
                            {hasTracking ? session.analysis.score : '—'}
                            <small>{hasTracking ? '%' : ''}</small>
                          </strong>
                          <span className="metric-caption">
                            {hasTracking
                              ? tr('Visible checks met')
                              : tr('Awaiting movement')}
                          </span>
                        </div>
                        {exercise.unit === 'reps' && (
                          <p>
                            {t(
                              'Repetitions meeting all checks',
                              '符合全部檢查的次數',
                            )}
                            : {session.stats.alignedReps}
                          </p>
                        )}
                      </details>
                    </>
                  )}
                  <div className="breathing-note">
                    <Leaf size={17} />
                    <p>{exercise.focus}</p>
                  </div>
                </aside>
              </div>
              {source === 'video' && tracker.media && !reviewOnly && (
                <details className="review-panel">
                  <summary>
                    {t('Teacher video feedback', '老師影片回饋')}
                  </summary>
                  <div className="section-heading">
                    <div>
                      <h2>{tr('Video timeline')}</h2>
                      <p>
                        {tr(
                          'Play during a session to analyze. Select a moment to revisit it.',
                        )}
                      </p>
                    </div>
                    <span className="timeline-key">
                      <i />
                      {tr('Aligned')}
                      <i className="adjust" />
                      {tr('Adjust')} <i className="untracked" />
                      {tr('Out of frame')}
                    </span>
                  </div>
                  {session.timeline.length ? (
                    <>
                      <div className="timeline-track">
                        {session.timeline.map((point) => (
                          <Tooltip
                            key={point.time}
                            title={`${formatTime(point.time)} · ${point.visible ? point.score + tr('% checks met') : tr('Body out of frame')}`}
                          >
                            <button
                              aria-label={`Review ${formatTime(point.time)}`}
                              className={
                                !point.visible
                                  ? 'untracked'
                                  : point.score === 100
                                    ? 'aligned'
                                    : 'adjust'
                              }
                              style={{
                                left: `${(point.time / (tracker.duration || 1)) * 100}%`,
                                width: `${Math.max(0.4, 100 / (tracker.duration || 1))}%`,
                              }}
                              onClick={() => tracker.seek(point.time)}
                            />
                          </Tooltip>
                        ))}
                      </div>
                      <div className="timeline-labels">
                        <span>00:00</span>
                        <span>{formatTime(tracker.duration)}</span>
                      </div>
                      <div className="review-cues">
                        {session.timeline
                          .filter(
                            (p, i, all) =>
                              p.visible &&
                              p.score < 100 &&
                              (i === 0 || p.cue !== all[i - 1].cue),
                          )
                          .slice(0, 8)
                          .map((point) => (
                            <button
                              key={point.time}
                              onClick={() => tracker.seek(point.time)}
                            >
                              <span>{formatTime(point.time)}</span>
                              {tr(point.cue)}
                              <ChevronRight size={14} />
                            </button>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="empty-timeline">
                      <ListVideo size={21} />
                      <span>
                        {tr('Play during a session to analyze the video.')}
                      </span>
                    </div>
                  )}
                </details>
              )}
            </>
          )}
          {page === 'library' && (
            <>
              <h2 className="view-title">{tr('Exercise library')}</h2>
              <div className="library-toolbar">
                <Segmented
                  value={category}
                  onChange={setCategory}
                  options={[
                    'All exercises',
                    ...new Set(availableExercises.map((e) => e.category)),
                  ].map((value) => ({
                    value,
                    label: language === 'en' ? value : categoryZh[value],
                  }))}
                />
                <span>
                  {
                    exercises.filter(
                      (e) =>
                        category === 'All exercises' || e.category === category,
                    ).length
                  }{' '}
                  {tr('exercises')}
                </span>
              </div>
              <div className="library-grid">
                {exercises
                  .filter(
                    (e) =>
                      category === 'All exercises' || e.category === category,
                  )
                  .map((e) => (
                    <article className="library-card" key={e.id}>
                      <div className={`library-art ${e.color}`}>
                        <Tag bordered={false}>
                          {language === 'en'
                            ? e.category
                            : categoryZh[e.category]}
                        </Tag>
                        <MovementDemo
                          exercise={e}
                          language={language}
                          autoPlay
                        />
                      </div>
                      <div className="library-copy">
                        <div className="inline">
                          <Clock3 size={14} />
                          {e.duration}
                          <span className="middot">·</span>
                          {e.support === 'review'
                            ? t('Teacher review', '老師檢視')
                            : t('Automatic checks', '自動檢查')}
                        </div>
                        <h2>{e.name}</h2>
                        <p>{e.subtitle}</p>
                        <ol>
                          {e.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                        <Button
                          block
                          type="primary"
                          onClick={() => chooseExercise(e.id)}
                        >
                          {t('Practice', '練習')} {e.name}
                          <ArrowRight size={15} />
                        </Button>
                      </div>
                    </article>
                  ))}
              </div>
            </>
          )}
          {page === 'routines' && (
            <RoutineBuilder
              language={language}
              routines={routines}
              onSave={(routine) =>
                storeRoutines([
                  ...routines.filter((r) => r.id !== routine.id),
                  routine,
                ])
              }
              onDelete={(id) =>
                storeRoutines(routines.filter((r) => r.id !== id))
              }
              onStart={startRoutine}
            />
          )}
          {page === 'history' && (
            <>
              <h2 className="view-title">{tr('Session history')}</h2>
              <div className="history-stats">
                <div>
                  <span>
                    <Activity size={18} />
                    {tr('Completed sessions')}
                  </span>
                  <strong>{history.length}</strong>
                </div>
                <div>
                  <span>
                    <Clock3 size={18} />
                    {tr('Time in motion')}
                  </span>
                  <strong>
                    {Math.floor(
                      history.reduce((sum, s) => sum + s.duration, 0) / 60,
                    )}
                    <small>{tr('min')}</small>
                  </strong>
                </div>
                <div>
                  <span>
                    <Target size={18} />
                    {tr('Aligned hold time')}
                  </span>
                  <strong>
                    {formatTime(
                      history
                        .filter(
                          (s) => getExercise(s.exercise).unit === 'seconds',
                        )
                        .reduce((sum, s) => sum + s.hold, 0),
                    )}
                  </strong>
                </div>
                <div>
                  <span>
                    <TrendingUp size={18} />
                    {tr('Completed repetitions')}
                  </span>
                  <strong>{history.reduce((sum, s) => sum + s.reps, 0)}</strong>
                </div>
              </div>
              <section className="history-panel">
                <div className="section-heading">
                  <h2>{tr('Recent sessions')}</h2>
                  {history.length > 0 && (
                    <Button
                      type="text"
                      danger
                      onClick={() =>
                        Modal.confirm({
                          title: tr('Clear practice history?'),
                          getContainer: popupContainer,
                          content: tr(
                            'This removes all saved session summaries from this device.',
                          ),
                          okText: tr('Clear history'),
                          okButtonProps: { danger: true },
                          onOk: () => {
                            try {
                              localStorage.removeItem('forma-sessions');
                              setHistory([]);
                            } catch {
                              setStorageWarning(true);
                            }
                          },
                        })
                      }
                    >
                      {tr('Clear history')}
                    </Button>
                  )}
                </div>
                {history.length ? (
                  <div className="history-list">
                    {history.map((record) => (
                      <button
                        className="history-row"
                        key={record.id}
                        onClick={() => session.setRecap(record)}
                      >
                        <div
                          className={`history-art ${getExercise(record.exercise).color}`}
                        >
                          <PoseArt pose={record.exercise} />
                        </div>
                        <div>
                          <strong>{getExercise(record.exercise).name}</strong>
                          <span>
                            {new Date(record.date).toLocaleDateString(
                              undefined,
                              {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}{' '}
                            ·{' '}
                            {record.source === 'camera'
                              ? tr('Live camera')
                              : tr('Video review')}
                          </span>
                        </div>
                        <span className="history-duration">
                          <Clock3 size={14} />
                          {formatTime(record.duration)}
                        </span>
                        <Tag color="green">
                          {record.assessment === 'review'
                            ? t('Teacher review', '老師檢視')
                            : record.score === null
                              ? tr('No pose tracked')
                              : `${record.score}% ${tr('Alignment')}`}
                        </Tag>
                        <ChevronRight size={17} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty
                    image={
                      <div className="history-empty-icon">
                        <Leaf size={36} />
                      </div>
                    }
                    description={
                      <>
                        <h3>{tr('No sessions yet')}</h3>
                        <p>
                          {tr(
                            'Complete your first session to see your progress here.',
                          )}
                        </p>
                      </>
                    }
                  >
                    <Button type="primary" onClick={() => navigate('studio')}>
                      {tr('Start practice')}
                      <ArrowRight size={15} />
                    </Button>
                  </Empty>
                )}
              </section>
            </>
          )}
          {storageWarning && (
            <Alert
              type="warning"
              title={tr(
                'Browser storage is unavailable. Your session is visible now, but may not be saved after this page closes.',
              )}
              closable
            />
          )}
        </main>
        <input
          type="file"
          accept="video/*"
          ref={uploadRef}
          aria-label={tr('Choose exercise video')}
          className="visually-hidden"
          onChange={(e) => {
            uploadFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <Modal
          getContainer={popupContainer}
          title={`${exercise.name} · ${tr('Pose guide')}`}
          open={instructions}
          onCancel={() => setInstructions(false)}
          footer={
            <Button type="primary" onClick={() => setInstructions(false)}>
              {tr('Done')}
            </Button>
          }
        >
          <div className={`pose-guide-art ${exercise.color}`}>
            <PoseArt pose={exercise.id} />
          </div>
          <ol className="pose-guide-steps">
            {exercise.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="pose-guide-focus">{exercise.focus}</p>
        </Modal>
        <Drawer
          getContainer={popupContainer}
          title={tr('Preferences')}
          open={settings}
          onClose={() => setSettings(false)}
          width={390}
        >
          <div className="setting-row">
            <div>
              <strong>{tr('Skeleton overlay')}</strong>
              <p>{tr('See the joints and connections we track.')}</p>
            </div>
            <Switch checked={overlay} onChange={setOverlay} />
          </div>
          <div className="setting-row">
            <div>
              <strong>{tr('Smooth skeleton movement')}</strong>
              <p>
                {tr(
                  'Tween keypoints between tracked frames for a softer overlay.',
                )}
              </p>
            </div>
            <Switch
              aria-label={tr('Smooth skeleton movement')}
              checked={tweening}
              disabled={!overlay}
              onChange={setTweening}
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>{tr('Mirror camera')}</strong>
              <p>{tr('Move as you would in a mirror.')}</p>
            </div>
            <Switch checked={mirror} onChange={setMirror} />
          </div>
          <div className="setting-row">
            <div>
              <strong>{tr('Spoken guidance')}</strong>
              <p>{tr('Hear alignment cues while you move.')}</p>
            </div>
            <Switch checked={sound} onChange={setSound} />
          </div>
          <div className="setting-block">
            <strong>{tr('Alignment flexibility')}</strong>
            <p>{tr('Allow a little more room in the joint-angle targets.')}</p>
            <Select
              value={tolerance}
              onChange={(value) => {
                setTolerance(value);
                session.onSeek();
              }}
              options={[
                { value: 0, label: tr('Standard · base angle ranges') },
                { value: 5, label: tr('Gentle · 5° extra flexibility') },
                { value: 10, label: tr('Relaxed · 10° extra flexibility') },
              ]}
              style={{ width: '100%' }}
            />
          </div>
          <div className="privacy-note">
            <ShieldCheck size={22} />
            <h3>{tr('Local processing')}</h3>
            <p>
              {tr(
                'Frames are processed in your browser. Forma does not upload or record your camera feed. Only session summaries are stored locally.',
              )}
            </p>
          </div>
        </Drawer>
        <Modal
          getContainer={popupContainer}
          title={tr('Setup guide')}
          open={help}
          onCancel={() => setHelp(false)}
          footer={
            <Button type="primary" onClick={() => setHelp(false)}>
              {tr('Done')}
            </Button>
          }
          width={600}
        >
          <div className="help-content">
            <div className="help-step">
              <span>01</span>
              <div>
                <h3>{tr('Camera placement')}</h3>
                <p>
                  {tr(
                    'Use a well-lit space. Place your camera around hip height and step back until your head, hands, and feet fit in the frame. Face the camera.',
                  )}
                </p>
              </div>
            </div>
            <div className="help-step">
              <span>02</span>
              <div>
                <h3>{tr('Practice modes')}</h3>
                <p>
                  {tr(
                    'Guided practice includes a framing countdown, an aligned hold or rep target, and a short rest. Open analysis lets you explore without a target or time limit.',
                  )}
                </p>
              </div>
            </div>
            <div className="help-step">
              <span>03</span>
              <div>
                <h3>{tr('Alignment feedback')}</h3>
                <p>
                  {tr(
                    'A visible movement and return counts even when an adjustment is needed. Holds count when all shape checks pass. Open Teacher measurements for the separate technique results.',
                  )}
                </p>
              </div>
            </div>
            <div className="help-limit">
              <Focus size={18} />
              <p>
                {tr(
                  'Feedback describes visible alignment from one camera. It isn’t a medical assessment. Move within a comfortable range and stop if something hurts.',
                )}
              </p>
            </div>
          </div>
        </Modal>
        <Modal
          getContainer={popupContainer}
          open={!!session.recap}
          onCancel={() => session.setRecap(null)}
          footer={null}
          width={510}
        >
          <div className="recap-content">
            <h2>{tr('Session summary')}</h2>
            <p>
              {session.recap && getExercise(session.recap.exercise).name} ·{' '}
              {session.recap?.source === 'camera'
                ? tr('Live practice')
                : tr('Video review')}
            </p>
            {session.recap && (
              <>
                <div className="recap-metrics">
                  <div>
                    <strong>{formatTime(session.recap.duration)}</strong>
                    <span>{tr('Time in motion')}</span>
                  </div>
                  <div>
                    <strong>
                      {session.recap.assessment === 'review'
                        ? (session.recap.attempts?.length ?? 0)
                        : getExercise(session.recap.exercise).unit === 'seconds'
                          ? `${Math.floor(session.recap.hold)}s`
                          : session.recap.reps}
                    </strong>
                    <span>
                      {session.recap.assessment === 'review'
                        ? t('Teacher-marked attempts', '老師標記次數')
                        : getExercise(session.recap.exercise).unit === 'seconds'
                          ? tr('Aligned hold')
                          : tr('Completed reps')}
                    </span>
                  </div>
                  <div>
                    <strong>
                      {session.recap.score === null
                        ? '—'
                        : `${session.recap.score}%`}
                    </strong>
                    <span>{tr('Avg. alignment')}</span>
                  </div>
                </div>
                {session.recap.cues.length > 0 ? (
                  <div className="recap-cues">
                    <h3>{tr('Recorded cues')}</h3>
                    {session.recap.cues.map((cue) => (
                      <p key={tr(cue)}>
                        <Leaf size={14} />
                        {tr(cue)}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="recap-note">
                    {session.recap.assessment === 'review'
                      ? t(
                          'Teacher review — no automatic technique score.',
                          '老師檢視 — 不提供自動技術評分。',
                        )
                      : session.recap.score === null
                        ? tr(
                            'No reliable pose was tracked. Try a brighter space with your whole body in view.',
                          )
                        : tr('No adjustment cues recorded.')}
                  </p>
                )}
                {session.recap.alignedReps !== undefined &&
                  getExercise(session.recap.exercise).unit === 'reps' && (
                    <p>
                      {t(
                        'Repetitions meeting all checks',
                        '符合全部檢查的次數',
                      )}
                      : {session.recap.alignedReps}
                    </p>
                  )}
                {session.recap.routine && (
                  <p>
                    {session.recap.routine.name} · {t('Step', '步驟')}{' '}
                    {session.recap.routine.step} / {session.recap.routine.total}
                  </p>
                )}
                {session.recap.notes && <p>{session.recap.notes}</p>}
                {session.recap.attempts?.map((attempt, i) => (
                  <p key={i}>
                    {reviewTime(attempt.time)} ·{' '}
                    {attempt.note || t('Attempt', '動作')}
                  </p>
                ))}
                <Button
                  block
                  type="primary"
                  onClick={() => {
                    if (recapIsCurrentStep) {
                      nextRoutineStep();
                      return;
                    }
                    session.setRecap(null);
                    chooseExercise(
                      exercises[(selectedIndex + 1) % exercises.length].id,
                    );
                  }}
                >
                  {recapIsCurrentStep && run
                    ? run.index + 1 === run.routine.steps.length
                      ? t('Finish combination', '完成組合')
                      : t('Next step', '下一步')
                    : t('Next exercise', '下一個動作')}{' '}
                  <ArrowRight size={16} />
                </Button>
                <Button
                  block
                  type="text"
                  icon={<ArrowDownToLine size={15} />}
                  onClick={() => session.recap && exportRecap(session.recap)}
                >
                  {tr('Download session summary')}
                </Button>
              </>
            )}
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
}
