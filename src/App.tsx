import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
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
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  Expand,
  Flower2,
  Focus,
  Footprints,
  History,
  LayoutGrid,
  Leaf,
  ListVideo,
  LockKeyhole,
  Maximize,
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
import { exercises, getExercise } from './lib/exercises';
import type { ExerciseId } from './lib/exercises';
import { formatTime } from './lib/analysis';
import type { SessionRecord } from './lib/analysis';
import { usePoseTracker } from './hooks/usePoseTracker';
import { useSession } from './hooks/useSession';
import { Logo, PoseArt } from './components/PoseArt';

type Page = 'studio' | 'library' | 'history';
function readHistory(): SessionRecord[] {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem('forma-sessions') ?? '[]',
    );
    return Array.isArray(data)
      ? data
          .filter(
            (v): v is SessionRecord =>
              v &&
              typeof v.id === 'string' &&
              typeof v.date === 'string' &&
              exercises.some((e) => e.id === v.exercise) &&
              Number.isFinite(v.duration) &&
              Number.isFinite(v.hold) &&
              Number.isFinite(v.reps) &&
              (v.score === null || Number.isFinite(v.score)) &&
              Array.isArray(v.cues) &&
              v.cues.every((c: unknown) => typeof c === 'string') &&
              ['camera', 'video'].includes(v.source),
          )
          .slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
export default function App({ onOpenPosture }: { onOpenPosture: () => void }) {
  const [page, setPage] = useState<Page>('studio');
  const [mode, setMode] = useState<'guided' | 'free'>('guided');
  const [selected, setSelected] = useState<ExerciseId>('warrior');
  const [source, setSource] = useState<'camera' | 'video'>('camera');
  const [overlay, setOverlay] = useState(true),
    [tweening, setTweening] = useState(false),
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
  const exercise = getExercise(selected);
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
  const session = useSession(exercise, mode, tolerance, source, save);
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
      active &&
      !session.paused &&
      session.analysis.cue !== lastSpoken.current &&
      'speechSynthesis' in window
    ) {
      lastSpoken.current = session.analysis.cue;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(session.analysis.cue);
      utterance.rate = 0.88;
      window.speechSynthesis.speak(utterance);
    }
    if (!sound || !active || session.paused) {
      window.speechSynthesis?.cancel();
      lastSpoken.current = '';
    }
  }, [sound, active, session.paused, session.analysis.cue]);
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
  function chooseExercise(id: ExerciseId) {
    if (active) session.finish();
    session.reset();
    setSelected(id);
    if (page !== 'studio') setPage('studio');
  }
  async function begin() {
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
  const elapsed = formatTime(session.stats.duration);
  const selectedIndex = exercises.findIndex((e) => e.id === selected);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#studio"
          className="brand-link"
          aria-label="Forma home"
          onClick={(e) => {
            e.preventDefault();
            navigate('studio');
          }}
        >
          <Logo />
        </a>
        <div className="nav-label">YOUR SPACE</div>
        <nav aria-label="Main navigation">
          <button
            className="nav-item"
            aria-label="Posture Monitor"
            onClick={() => {
              if (active) session.finish();
              tracker.stop();
              onOpenPosture();
            }}
          >
            <Monitor size={19} />
            <span>Posture Monitor</span>
          </button>
          <button
            aria-label="Movement studio"
            className={page === 'studio' ? 'nav-item selected' : 'nav-item'}
            onClick={() => navigate('studio')}
          >
            <LayoutGrid size={19} />
            <span>Movement studio</span>
            <span className="nav-dot" />
          </button>
          <button
            aria-label="Exercise library"
            className={page === 'library' ? 'nav-item selected' : 'nav-item'}
            onClick={() => navigate('library')}
          >
            <Flower2 size={20} />
            <span>Exercise library</span>
          </button>
          <button
            aria-label="My progress"
            className={page === 'history' ? 'nav-item selected' : 'nav-item'}
            onClick={() => navigate('history')}
          >
            <History size={19} />
            <span>My progress</span>
            {history.length > 0 && (
              <span className="nav-count">{history.length}</span>
            )}
          </button>
          <button
            className="nav-item compact-preferences"
            aria-label="Preferences"
            onClick={() => setSettings(true)}
          >
            <Settings2 size={19} />
          </button>
        </nav>
        <div className="sidebar-note">
          <div className="note-leaf">
            <Leaf size={22} />
          </div>
          <h3>
            Small moves.
            <br />
            Meaningful change.
          </h3>
          <p>A few mindful minutes can make room for a better day.</p>
          <span>
            Make this time yours <span>↗</span>
          </span>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={19} />
            Getting started
          </button>
          <button className="nav-item" onClick={() => setSettings(true)}>
            <Settings2 size={19} />
            Preferences
          </button>
          <div className="local-profile">
            <div className="avatar">Y</div>
            <div>
              <strong>Your personal space</strong>
              <span>Saved on this device</span>
            </div>
            <LockKeyhole size={14} />
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Your space <ChevronRight size={13} />
            <strong>
              {page === 'studio'
                ? 'Movement studio'
                : page === 'library'
                  ? 'Exercise library'
                  : 'My progress'}
            </strong>
          </div>
          <div className="private-badge">
            <span className="status-dot" /> Private by design{' '}
            <ShieldCheck size={15} />
          </div>
        </header>
        {page === 'studio' && (
          <>
            <section className="page-heading">
              <div>
                <div className="eyebrow">
                  <span /> MOVE WITH INTENTION
                </div>
                <h1>
                  Your movement, <span>more mindful.</span>
                </h1>
                <p>
                  A little guidance. A deeper connection. Find your flow, one
                  movement at a time.
                </p>
              </div>
              <button
                className="text-button how-it-works"
                onClick={() => setHelp(true)}
              >
                <CircleHelp size={16} /> How it works <ArrowUpRightIcon />
              </button>
            </section>
            <div
              className="workspace-tabs"
              role="tablist"
              aria-label="Studio mode"
            >
              <button
                role="tab"
                aria-selected={mode === 'guided'}
                className={mode === 'guided' ? 'active' : ''}
                onClick={() => changeMode('guided')}
              >
                <Sparkles size={17} />
                Guided practice
                <span className="tab-pill">A little direction</span>
              </button>
              <button
                role="tab"
                aria-selected={mode === 'free'}
                className={mode === 'free' ? 'active' : ''}
                onClick={() => changeMode('free')}
              >
                <ScanLine size={18} />
                Open analysis
              </button>
              <span className="tabs-caption">Your pace. Your practice.</span>
            </div>
            <section className="exercise-section">
              <div className="section-heading">
                <h2>
                  {mode === 'guided'
                    ? 'What feels good today?'
                    : 'Choose your movement'}
                </h2>
                <button
                  className="text-button"
                  onClick={() => navigate('library')}
                >
                  Explore exercises <ArrowRight size={15} />
                </button>
              </div>
              <div className="exercise-grid">
                {exercises.map((e, i) => (
                  <button
                    key={e.id}
                    className={`exercise-card ${e.color} ${selected === e.id ? 'chosen' : ''}`}
                    onClick={() => chooseExercise(e.id)}
                    aria-pressed={selected === e.id}
                  >
                    <div className="exercise-card-copy">
                      <span className="exercise-category">{e.category}</span>
                      <h3>{e.name}</h3>
                      <span className="exercise-time">
                        <Clock3 size={12} />
                        {e.duration}
                      </span>
                    </div>
                    <PoseArt pose={e.id} />
                    <span
                      className={`card-selection ${selected === e.id ? 'checked' : ''}`}
                    >
                      {selected === e.id ? <Check size={12} /> : `0${i + 1}`}
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <div className="studio-grid">
              <section className="camera-panel" ref={studioRef}>
                <div className="panel-toolbar">
                  <Segmented
                    aria-label="Input source"
                    value={source}
                    onChange={(value) =>
                      changeSource(value as 'camera' | 'video')
                    }
                    options={[
                      {
                        value: 'camera',
                        label: (
                          <span className="inline">
                            <Camera size={15} /> Live camera
                          </span>
                        ),
                      },
                      {
                        value: 'video',
                        label: (
                          <span className="inline">
                            <Upload size={15} /> Upload video
                          </span>
                        ),
                      },
                    ]}
                  />
                  <div className="toolbar-right">
                    <span className="local-label">
                      <LockKeyhole size={12} /> Only on your device
                    </span>
                    <Tooltip title="Expand preview">
                      <Button
                        type="text"
                        aria-label="Expand preview"
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
                    if (source === 'video') uploadFile(e.dataTransfer.files[0]);
                  }}
                >
                  <div className="stage-top">
                    <span className="stage-status">
                      <span
                        className={`status-dot ${hasTracking ? 'green' : ''}`}
                      />
                      {tracker.status === 'loading'
                        ? 'Preparing your studio'
                        : tracker.media
                          ? hasTracking
                            ? 'Body in frame'
                            : 'Finding your position'
                          : 'Your space to move'}
                    </span>
                    <span className="stage-quality">
                      {tracker.media ? (
                        <>
                          <Activity size={13} />{' '}
                          {tracker.status === 'ready'
                            ? 'Tracking ready'
                            : 'Loading model'}
                        </>
                      ) : (
                        <>
                          <ScanLine size={13} /> POSE TRACKING
                        </>
                      )}
                    </span>
                  </div>
                  <div
                    className={`media-layer ${mirror && source === 'camera' ? 'mirrored' : ''}`}
                    style={{ visibility: tracker.media ? 'visible' : 'hidden' }}
                  >
                    <video
                      ref={tracker.videoRef}
                      playsInline
                      muted
                      preload="auto"
                      aria-label={
                        source === 'camera'
                          ? 'Live camera preview'
                          : 'Uploaded video preview'
                      }
                    />
                    <canvas
                      ref={tracker.canvasRef}
                      aria-label="Body landmark overlay"
                    />
                  </div>
                  {!tracker.media && (
                    <div className="camera-empty">
                      <div className="framing-art">
                        <span className="frame-corner tl" />
                        <span className="frame-corner tr" />
                        <span className="frame-corner bl" />
                        <span className="frame-corner br" />
                        <PoseArt pose={selected} outline />
                        <div className="scan-line" />
                      </div>
                      <h3>
                        {source === 'camera'
                          ? 'Make room for a little movement.'
                          : 'A fresh perspective on your practice.'}
                      </h3>
                      <p>
                        {source === 'camera'
                          ? 'Turn on your camera. We’ll take it one breath at a time.'
                          : 'Drop a video here to explore your movement, frame by frame.'}
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
                          ? 'Enable camera'
                          : 'Choose a video'}
                      </Button>
                      <span className="camera-small">
                        {source === 'camera'
                          ? 'Your camera is off until you’re ready'
                          : 'MP4, WebM or MOV · up to 500 MB · stays on your device'}
                      </span>
                    </div>
                  )}
                  {tracker.media && tracker.status === 'loading' && (
                    <div className="loading-overlay">
                      <div className="loading-orbit" />
                      <h3>Getting your guide ready…</h3>
                      <p>Loading the pose model on your device.</p>
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
                            ? 'Stay there. We’re almost ready.'
                            : 'Step back so your full body is visible.'}
                        </p>
                      </div>
                    )}
                  {session.phase === 'rest' && (
                    <div className="countdown-overlay rest">
                      <Leaf size={28} />
                      <h3>A moment to breathe.</h3>
                      <span>{session.restTime}</span>
                      <p>
                        You’ve completed your{' '}
                        {exercise.unit === 'reps' ? 'repetitions' : 'hold'}.
                      </p>
                    </div>
                  )}
                  {session.paused && tracker.media && (
                    <div className="paused-overlay">
                      <Pause size={24} />
                      <span>Practice paused</span>
                      <Button onClick={pause}>Resume practice</Button>
                    </div>
                  )}
                  <div className="stage-bottom">
                    <span>
                      <Focus size={15} />
                      {source === 'camera'
                        ? 'Keep your whole body in view'
                        : tracker.media?.kind === 'video'
                          ? tracker.media.name
                          : 'A full-body view works best'}
                    </span>
                    {tracker.media && source === 'camera' && (
                      <button
                        className="stage-stop"
                        onClick={() => {
                          if (active) session.finish();
                          tracker.stop();
                        }}
                      >
                        <Square size={12} /> Camera off
                      </button>
                    )}
                    <span className="stage-brand">forma.</span>
                  </div>
                </div>
                {tracker.error && (
                  <Alert
                    title={tracker.error}
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
                        tracker.playing ? 'Pause video' : 'Play video'
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
                      aria-label="Video position"
                      value={tracker.time}
                      max={tracker.duration || 1}
                      step={0.1}
                      tooltip={{ formatter: (value) => formatTime(value ?? 0) }}
                      onChange={tracker.seek}
                    />
                    <span>{formatTime(tracker.duration)}</span>
                    <Tooltip title="Change video">
                      <Button
                        type="text"
                        aria-label="Change video"
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
                    Skeleton overlay
                  </label>
                  <label>
                    <Switch
                      size="small"
                      checked={mirror}
                      onChange={setMirror}
                      disabled={source === 'video'}
                    />{' '}
                    Mirror view
                  </label>
                  <button
                    className={`text-button audio-button ${sound ? 'on' : ''}`}
                    onClick={() => setSound(!sound)}
                  >
                    <AudioLines size={15} />
                    <span>Voice cues {sound ? 'on' : 'off'}</span>
                  </button>
                </div>
                <div className="session-bar">
                  <div className="session-time-icon">
                    <Clock3 size={20} />
                  </div>
                  <div className="session-time">
                    <span>
                      {active
                        ? 'SESSION IN PROGRESS'
                        : session.phase === 'complete'
                          ? 'SESSION COMPLETE'
                          : 'A MOMENT FOR YOU'}
                    </span>
                    <strong>
                      {active || session.phase === 'complete'
                        ? elapsed
                        : mode === 'guided'
                          ? exercise.duration
                          : 'Move at your own pace'}
                    </strong>
                  </div>
                  <div className="session-actions">
                    {active ? (
                      <>
                        <Tooltip
                          title={
                            session.paused ? 'Resume session' : 'Pause session'
                          }
                        >
                          <Button
                            aria-label={
                              session.paused
                                ? 'Resume session'
                                : 'Pause session'
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
                          Finish session
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
                          ? 'Practice again'
                          : mode === 'guided'
                            ? 'Start guided session'
                            : 'Start analysis'}
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
                  <h2>Your movement guide</h2>
                  <Tooltip title="Feedback is based on visible joint angles. A single camera cannot assess every aspect of a pose.">
                    <CircleHelp size={15} />
                  </Tooltip>
                </div>
                <div className="current-exercise">
                  <span className="eyebrow">
                    {mode === 'guided' ? 'YOUR FOCUS' : 'ANALYZING'}
                  </span>
                  <h3>{exercise.name}</h3>
                  <span>
                    {exercise.subtitle}
                    <span className="middot">·</span>Beginner friendly
                  </span>
                  <button
                    className="text-button pose-instructions"
                    onClick={() => setInstructions(true)}
                  >
                    View pose guide <ArrowRight size={12} />
                  </button>
                </div>
                <div
                  className={`coaching-cue ${hasTracking ? 'tracking' : ''}`}
                >
                  <div>
                    <span className="cue-dot" />
                    <strong>
                      {session.paused
                        ? 'Take your time'
                        : session.phase === 'rest'
                          ? 'Beautifully done'
                          : hasTracking
                            ? session.analysis.score === 100
                              ? 'You’re finding your flow'
                              : 'A little adjustment'
                            : 'Ready when you are'}
                    </strong>
                  </div>
                  <p>
                    {session.paused
                      ? 'Your session is paused. Resume when you’re ready.'
                      : session.phase === 'rest'
                        ? 'Relax your arms, release the pose, and breathe.'
                        : tracker.media
                          ? session.analysis.cue
                          : 'Settle into your space. Your personal cues will appear here as you move.'}
                  </p>
                </div>
                <div className="alignment-heading">
                  <span>Alignment check</span>
                  <span
                    className={`tracking-state ${hasTracking ? 'live' : ''}`}
                  >
                    {hasTracking ? 'LIVE' : 'WAITING'}
                  </span>
                </div>
                <div className="alignment-list">
                  {(hasTracking
                    ? session.analysis.checks
                    : [
                        { label: 'Full body in frame', value: '', good: false },
                        {
                          label:
                            exercise.id === 'warrior'
                              ? 'Arms at shoulder height'
                              : exercise.id === 'tree'
                                ? 'Standing leg extended'
                                : 'Controlled movement',
                          value: '',
                          good: false,
                        },
                        {
                          label: 'Steady, comfortable posture',
                          value: '',
                          good: false,
                        },
                      ]
                  ).map((check) => (
                    <div className="alignment-row" key={check.label}>
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
                      <span>{check.label}</span>
                      <strong>{check.value || '—'}</strong>
                    </div>
                  ))}
                </div>
                <div className="practice-metrics">
                  <div>
                    <span>
                      {exercise.unit === 'reps'
                        ? 'Completed reps'
                        : 'Aligned hold'}
                      <Tooltip
                        title={
                          exercise.unit === 'reps'
                            ? 'A full controlled movement and return counts as one rep.'
                            : 'Only time with all alignment checks passing counts.'
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
                  <div>
                    <span>Alignment</span>
                    <strong>
                      {hasTracking ? session.analysis.score : '—'}
                      <small>{hasTracking ? '%' : ''}</small>
                    </strong>
                    <span className="metric-caption">
                      {hasTracking ? 'Visible checks met' : 'Awaiting movement'}
                    </span>
                  </div>
                </div>
                <div className="breathing-note">
                  <Leaf size={17} />
                  <p>{exercise.focus}</p>
                </div>
              </aside>
            </div>
            {source === 'video' && tracker.media && (
              <section className="review-panel">
                <div className="section-heading">
                  <div>
                    <h2>Your movement timeline</h2>
                    <p>
                      Play during a session to analyze. Select a moment to
                      revisit it.
                    </p>
                  </div>
                  <span className="timeline-key">
                    <i /> Aligned <i className="adjust" /> Adjust{' '}
                    <i className="untracked" /> Out of frame
                  </span>
                </div>
                {session.timeline.length ? (
                  <>
                    <div className="timeline-track">
                      {session.timeline.map((point) => (
                        <Tooltip
                          key={point.time}
                          title={`${formatTime(point.time)} · ${point.visible ? point.score + '% checks met' : 'Body out of frame'}`}
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
                            {point.cue}
                            <ChevronRight size={14} />
                          </button>
                        ))}
                    </div>
                  </>
                ) : (
                  <div className="empty-timeline">
                    <ListVideo size={21} />
                    <span>
                      Your feedback timeline will appear as you analyze the
                      video.
                    </span>
                  </div>
                )}
              </section>
            )}
            <div className="bottom-guidance">
              <div className="guidance-icon">
                <Footprints size={20} />
              </div>
              <div>
                <strong>A little setup goes a long way.</strong>
                <span>
                  Find a well-lit spot, give yourself space, and place your
                  camera at hip height.
                </span>
              </div>
              <button className="text-button" onClick={() => setHelp(true)}>
                Setup tips <ArrowRight size={15} />
              </button>
            </div>
          </>
        )}
        {page === 'library' && (
          <>
            <section className="page-heading">
              <div>
                <div className="eyebrow">
                  <span /> FIND YOUR NEXT MOVEMENT
                </div>
                <h1>
                  A practice <span>for your everyday.</span>
                </h1>
                <p>
                  Four simple movements to build balance, create space, and
                  reconnect.
                </p>
              </div>
            </section>
            <div className="library-toolbar">
              <Segmented
                value={category}
                onChange={setCategory}
                options={['All exercises', 'Yoga', 'Warm-up']}
              />
              <span>
                {
                  exercises.filter(
                    (e) =>
                      category === 'All exercises' || e.category === category,
                  ).length
                }{' '}
                exercises
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
                      <Tag bordered={false}>{e.category}</Tag>
                      <PoseArt pose={e.id} />
                    </div>
                    <div className="library-copy">
                      <div className="inline">
                        <Clock3 size={14} />
                        {e.duration}
                        <span className="middot">·</span>Beginner
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
                        Practice {e.name}
                        <ArrowRight size={15} />
                      </Button>
                    </div>
                  </article>
                ))}
            </div>
          </>
        )}
        {page === 'history' && (
          <>
            <section className="page-heading">
              <div>
                <div className="eyebrow">
                  <span /> EVERY LITTLE MOVE COUNTS
                </div>
                <h1>
                  Look how far <span>you’ve moved.</span>
                </h1>
                <p>Your practice history, saved privately on this device.</p>
              </div>
            </section>
            <div className="history-stats">
              <div>
                <span>
                  <Activity size={18} />
                  Completed sessions
                </span>
                <strong>{history.length}</strong>
              </div>
              <div>
                <span>
                  <Clock3 size={18} />
                  Time in motion
                </span>
                <strong>
                  {Math.floor(
                    history.reduce((sum, s) => sum + s.duration, 0) / 60,
                  )}
                  <small> min</small>
                </strong>
              </div>
              <div>
                <span>
                  <Target size={18} />
                  Aligned hold time
                </span>
                <strong>
                  {formatTime(
                    history
                      .filter((s) => getExercise(s.exercise).unit === 'seconds')
                      .reduce((sum, s) => sum + s.hold, 0),
                  )}
                </strong>
              </div>
              <div>
                <span>
                  <TrendingUp size={18} />
                  Completed repetitions
                </span>
                <strong>{history.reduce((sum, s) => sum + s.reps, 0)}</strong>
              </div>
            </div>
            <section className="history-panel">
              <div className="section-heading">
                <h2>Your recent practice</h2>
                {history.length > 0 && (
                  <Button
                    type="text"
                    danger
                    onClick={() =>
                      Modal.confirm({
                        title: 'Clear your practice history?',
                        content:
                          'This removes all saved session summaries from this device.',
                        okText: 'Clear history',
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
                    Clear history
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
                          {new Date(record.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          ·{' '}
                          {record.source === 'camera'
                            ? 'Live camera'
                            : 'Video review'}
                        </span>
                      </div>
                      <span className="history-duration">
                        <Clock3 size={14} />
                        {formatTime(record.duration)}
                      </span>
                      <Tag color="green">
                        {record.score === null
                          ? 'No pose tracked'
                          : `${record.score}% alignment`}
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
                      <h3>Your story starts with one movement.</h3>
                      <p>
                        Complete your first session to see your progress here.
                      </p>
                    </>
                  }
                >
                  <Button type="primary" onClick={() => navigate('studio')}>
                    Find your flow <ArrowRight size={15} />
                  </Button>
                </Empty>
              )}
            </section>
          </>
        )}
        {storageWarning && (
          <Alert
            type="warning"
            title="Browser storage is unavailable. Your session is visible now, but may not be saved after this page closes."
            closable
          />
        )}
        <footer>
          <span>
            <Logo small /> A little more present. A little more you.
          </span>
          <span>
            <LockKeyhole size={12} /> Camera and video stay on your device.
          </span>
        </footer>
      </main>
      <input
        type="file"
        accept="video/*"
        ref={uploadRef}
        aria-label="Choose exercise video"
        className="visually-hidden"
        onChange={(e) => {
          uploadFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <Modal
        title={`${exercise.name} · pose guide`}
        open={instructions}
        onCancel={() => setInstructions(false)}
        footer={
          <Button type="primary" onClick={() => setInstructions(false)}>
            Ready to practice <ArrowRight size={15} />
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
        title="Make yourself comfortable"
        open={settings}
        onClose={() => setSettings(false)}
        width={390}
      >
        <p className="drawer-intro">
          A few small adjustments to make the studio yours.
        </p>
        <div className="setting-row">
          <div>
            <strong>Skeleton overlay</strong>
            <p>See the joints and connections we track.</p>
          </div>
          <Switch checked={overlay} onChange={setOverlay} />
        </div>
        <div className="setting-row">
          <div>
            <strong>Smooth skeleton movement</strong>
            <p>Tween keypoints between tracked frames for a softer overlay.</p>
          </div>
          <Switch
            aria-label="Smooth skeleton movement"
            checked={tweening}
            disabled={!overlay}
            onChange={setTweening}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Mirror camera</strong>
            <p>Move as you would in a mirror.</p>
          </div>
          <Switch checked={mirror} onChange={setMirror} />
        </div>
        <div className="setting-row">
          <div>
            <strong>Spoken guidance</strong>
            <p>Hear alignment cues while you move.</p>
          </div>
          <Switch checked={sound} onChange={setSound} />
        </div>
        <div className="setting-block">
          <strong>Alignment flexibility</strong>
          <p>Allow a little more room in the joint-angle targets.</p>
          <Select
            value={tolerance}
            onChange={(value) => {
              setTolerance(value);
              session.onSeek();
            }}
            options={[
              { value: 0, label: 'Standard · base angle ranges' },
              { value: 5, label: 'Gentle · 5° extra flexibility' },
              { value: 10, label: 'Relaxed · 10° extra flexibility' },
            ]}
            style={{ width: '100%' }}
          />
        </div>
        <div className="privacy-note">
          <ShieldCheck size={22} />
          <h3>Your practice is personal.</h3>
          <p>
            Frames are processed in your browser. Forma does not upload or
            record your camera feed. Only session summaries are stored locally.
          </p>
        </div>
      </Drawer>
      <Modal
        title={null}
        open={help}
        onCancel={() => setHelp(false)}
        footer={
          <Button type="primary" onClick={() => setHelp(false)}>
            I’m ready to move <ArrowRight size={15} />
          </Button>
        }
        width={600}
      >
        <div className="help-content">
          <span className="modal-leaf">
            <Leaf size={25} />
          </span>
          <div className="eyebrow">WELCOME TO YOUR SPACE</div>
          <h2>
            A good practice starts
            <br />
            with a little space.
          </h2>
          <div className="help-step">
            <span>01</span>
            <div>
              <h3>Set the scene</h3>
              <p>
                Use a well-lit space. Place your camera around hip height and
                step back until your head, hands, and feet fit in the frame.
                Face the camera.
              </p>
            </div>
          </div>
          <div className="help-step">
            <span>02</span>
            <div>
              <h3>Choose your kind of movement</h3>
              <p>
                Guided practice includes a framing countdown, an aligned hold or
                rep target, and a short rest. Open analysis lets you explore
                without a target or time limit.
              </p>
            </div>
          </div>
          <div className="help-step">
            <span>03</span>
            <div>
              <h3>Listen, adjust, breathe</h3>
              <p>
                Follow one cue at a time. Holds count when every check passes;
                warm-ups count a controlled movement and return. Use the video
                timeline to revisit feedback.
              </p>
            </div>
          </div>
          <div className="help-limit">
            <Focus size={18} />
            <p>
              Feedback describes visible alignment from one camera. It isn’t a
              medical assessment. Move within a comfortable range and stop if
              something hurts.
            </p>
          </div>
        </div>
      </Modal>
      <Modal
        open={!!session.recap}
        onCancel={() => session.setRecap(null)}
        footer={null}
        width={510}
      >
        <div className="recap-content">
          <span className="modal-leaf">
            <CheckCheck size={28} />
          </span>
          <div className="eyebrow">TIME WELL SPENT</div>
          <h2>You showed up for yourself.</h2>
          <p>
            {session.recap && getExercise(session.recap.exercise).name} ·{' '}
            {session.recap?.source === 'camera'
              ? 'Live practice'
              : 'Video review'}
          </p>
          {session.recap && (
            <>
              <div className="recap-metrics">
                <div>
                  <strong>{formatTime(session.recap.duration)}</strong>
                  <span>Time in motion</span>
                </div>
                <div>
                  <strong>
                    {getExercise(session.recap.exercise).unit === 'seconds'
                      ? `${Math.floor(session.recap.hold)}s`
                      : session.recap.reps}
                  </strong>
                  <span>
                    {getExercise(session.recap.exercise).unit === 'seconds'
                      ? 'Aligned hold'
                      : 'Completed reps'}
                  </span>
                </div>
                <div>
                  <strong>
                    {session.recap.score === null
                      ? '—'
                      : `${session.recap.score}%`}
                  </strong>
                  <span>Avg. alignment</span>
                </div>
              </div>
              {session.recap.cues.length > 0 ? (
                <div className="recap-cues">
                  <h3>A focus for next time</h3>
                  {session.recap.cues.map((cue) => (
                    <p key={cue}>
                      <Leaf size={14} />
                      {cue}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="recap-note">
                  {session.recap.score === null
                    ? 'No reliable pose was tracked. Try a brighter space with your whole body in view.'
                    : 'Carry that calm into the rest of your day.'}
                </p>
              )}
              <Button
                block
                type="primary"
                onClick={() => {
                  session.setRecap(null);
                  chooseExercise(
                    exercises[(selectedIndex + 1) % exercises.length].id,
                  );
                }}
              >
                Try another movement <ArrowRight size={16} />
              </Button>
              <Button
                block
                type="text"
                icon={<ArrowDownToLine size={15} />}
                onClick={() => session.recap && exportRecap(session.recap)}
              >
                Download session summary
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 12L12 4M4 4h8v8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
