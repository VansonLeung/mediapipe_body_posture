import { useEffect, useMemo, useRef, useState } from 'react';
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
  theme,
} from 'antd';
import enUS from 'antd/locale/en_US';
import zhTW from 'antd/locale/zh_TW';
import {
  Activity,
  Armchair,
  ArrowLeft,
  Bell,
  BellOff,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  Eye,
  Focus,
  History,
  Languages,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  UserRound,
} from 'lucide-react';
import type {
  CameraProfile,
  CameraSide,
  MonitorRecord,
  PostureMetric,
  ReminderEvent,
} from '../lib/posture';
import { defaultMonitorOptions, metricKeys } from '../lib/posture';
import { monitorTranslations } from '../lib/postureLanguage';
import type { MonitorLanguage, MonitorTextKey } from '../lib/postureLanguage';
import { formatTime } from '../lib/analysis';
import { usePostureMonitor } from '../hooks/usePostureMonitor';
import { popupContainer, useAppFullscreen } from '../hooks/useAppFullscreen';
import './posture.css';

const metricIcons = {
  head: UserRound,
  torso: Activity,
  shoulders: SlidersHorizontal,
  proximity: Focus,
};
const cues: Record<PostureMetric, MonitorTextKey> = {
  head: 'headCue',
  torso: 'torsoCue',
  shoulders: 'shouldersCue',
  proximity: 'proximityCue',
};
const descriptions: Record<PostureMetric, MonitorTextKey> = {
  head: 'headSideDetail',
  torso: 'torsoDetail',
  shoulders: 'shouldersDetail',
  proximity: 'proximityDetail',
};
function readLanguage(): MonitorLanguage {
  try {
    return localStorage.getItem('forma-posture-language') === 'zh'
      ? 'zh'
      : 'en';
  } catch {
    return 'en';
  }
}

export default function PostureMonitor({
  onOpenStudio,
}: {
  onOpenStudio: () => void;
}) {
  const [language, setLanguage] = useState<MonitorLanguage>(readLanguage);
  const t = (key: MonitorTextKey) => monitorTranslations[language][key];
  const [profile, setProfile] = useState<CameraProfile>('front');
  const [side, setSide] = useState<CameraSide>('left');
  const [reminders, setReminders] = useState(true),
    [voice, setVoice] = useState(false);
  const [overlay, setOverlay] = useState(true),
    [tweening, setTweening] = useState(true),
    [mirror, setMirror] = useState(true);
  const [enabled, setEnabled] = useState({ ...defaultMonitorOptions.enabled });
  const [sustain, setSustain] = useState(5),
    [cooldown, setCooldown] = useState(30),
    [flexibility, setFlexibility] = useState(1);
  const [settings, setSettings] = useState(false),
    [guide, setGuide] = useState(false),
    [history, setHistory] = useState(false);
  const [detail, setDetail] = useState<PostureMetric | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [deviceId, setDeviceId] = useState('');
  const preview = useRef<HTMLDivElement>(null);
  const appRoot = useRef<HTMLDivElement>(null);
  const { fullscreen: appFullscreen, toggleFullscreen } =
    useAppFullscreen(appRoot);
  const options = useMemo(
    () => ({
      profile,
      side,
      reminders,
      enabled,
      sustain,
      cooldown,
      flexibility,
    }),
    [profile, side, reminders, enabled, sustain, cooldown, flexibility],
  );
  const onReminder = (event: ReminderEvent) => {
    if (voice && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(t(cues[event.key]));
      speech.lang = language === 'zh' ? 'zh-HK' : 'en-US';
      speech.rate = 0.92;
      window.speechSynthesis.speak(speech);
    }
  };
  const monitor = usePostureMonitor(options, overlay, tweening, onReminder);
  const { engine, tracker } = monitor;
  const active = engine.phase === 'monitoring' || engine.phase === 'paused';
  const snoozed = performance.now() < engine.snoozeUntil;
  const checks = engine.checks;
  const coverage = engine.stats.duration
    ? Math.round((engine.stats.tracked / engine.stats.duration) * 100)
    : 0;
  const hint =
    profile === 'front'
      ? 'frontHint'
      : profile === 'side'
        ? 'sideHint'
        : 'diagonalHint';
  useEffect(() => {
    const update = async () => {
      try {
        setDevices(
          ((await navigator.mediaDevices?.enumerateDevices()) ?? []).filter(
            (d) => d.kind === 'videoinput',
          ),
        );
      } catch {
        /* Device selection is optional. */
      }
    };
    void update();
    navigator.mediaDevices?.addEventListener('devicechange', update);
    return () =>
      navigator.mediaDevices?.removeEventListener('devicechange', update);
  }, [tracker.media]);
  useEffect(() => {
    try {
      localStorage.setItem('forma-posture-language', language);
    } catch {
      /* Session controls still work without storage. */
    }
  }, [language]);
  useEffect(() => {
    if (!voice || !reminders) window.speechSynthesis?.cancel();
  }, [voice, reminders]);
  function changeProfile(next: CameraProfile) {
    if (next === profile) return;
    monitor.clearReference();
    setProfile(next);
  }
  function changeSide(next: CameraSide) {
    if (next === side) return;
    monitor.clearReference();
    setSide(next);
  }
  function download(record: MonitorRecord) {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ workspace: 'posture-monitor', ...record }, null, 2)],
        { type: 'application/json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `forma-posture-${record.date.slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const status = !tracker.media
    ? 'cameraOff'
    : tracker.status === 'loading'
      ? 'loading'
      : engine.phase === 'paused'
        ? 'paused'
        : engine.ready
          ? 'ready'
          : 'finding';
  return (
    <ConfigProvider
      getPopupContainer={popupContainer}
      locale={language === 'zh' ? zhTW : enUS}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#38b8ff',
          colorInfo: '#38b8ff',
          colorBgBase: '#091827',
          colorBgContainer: '#10243a',
          colorBgElevated: '#10243a',
          colorText: '#e8f3ff',
          colorTextSecondary: '#91aac1',
          colorBorder: '#29455f',
          borderRadius: 12,
          fontFamily: '"DM Sans", "Noto Sans TC", sans-serif',
        },
      }}
    >
      <div
        ref={appRoot}
        className="pm-shell"
        lang={language === 'zh' ? 'zh-Hant' : 'en'}
      >
        <header className="pm-header">
          <div className="pm-brand">
            <span className="pm-app-icon">
              <Armchair size={28} />
            </span>
            <div>
              <strong>{t('title')}</strong>
            </div>
          </div>
          <div className="pm-header-actions">
            <Button
              type="text"
              icon={<ArrowLeft size={15} />}
              onClick={() => {
                monitor.finish(false);
                onOpenStudio();
              }}
            >
              {t('studio')}
            </Button>
            <div className="pm-language">
              <Languages size={16} />
              <Segmented
                aria-label={t('language')}
                value={language}
                onChange={(value) => setLanguage(value as MonitorLanguage)}
                options={[
                  { label: 'EN', value: 'en' },
                  { label: '繁', value: 'zh' },
                ]}
              />
            </div>
            <Button
              aria-label={t('history')}
              title={t('history')}
              icon={<History size={17} />}
              onClick={() => setHistory(true)}
            />
            <Button
              aria-label={t(appFullscreen ? 'exitFullscreen' : 'appFullscreen')}
              title={t(appFullscreen ? 'exitFullscreen' : 'appFullscreen')}
              icon={
                appFullscreen ? <Minimize size={17} /> : <Maximize size={17} />
              }
              onClick={() => void toggleFullscreen().catch(() => {})}
            />
            <Button
              aria-label={t('settings')}
              icon={<Settings2 size={18} />}
              onClick={() => setSettings(true)}
            />
          </div>
        </header>
        <main className="pm-main">
          <section className="pm-profiles">
            <div className="pm-profile-label">
              <span>{t('cameraProfile')}</span>
              <button onClick={() => setGuide(true)}>
                <CircleHelp size={14} />
                {t('guide')}
              </button>
            </div>
            <div className="pm-profile-grid">
              {(['front', 'side', 'diagonal'] as CameraProfile[]).map((p) => (
                <button
                  className={`pm-profile ${profile === p ? 'selected' : ''}`}
                  key={p}
                  aria-pressed={profile === p}
                  onClick={() => changeProfile(p)}
                >
                  <div>
                    <strong>{t(p)}</strong>
                    <span>
                      {p === 'front' ? '0°' : p === 'side' ? '90°' : '30–45°'}
                    </span>
                  </div>
                  <span className="pm-radio">
                    {profile === p && <Check size={11} />}
                  </span>
                </button>
              ))}
            </div>
            <div className="pm-profile-foot">
              <p>{t(hint)}</p>
              {profile !== 'front' && (
                <label>
                  <span>{t('cameraSide')}</span>
                  <Segmented
                    aria-label={t('cameraSide')}
                    value={side}
                    onChange={(value) => changeSide(value as CameraSide)}
                    options={[
                      { value: 'left', label: t('left') },
                      { value: 'right', label: t('right') },
                    ]}
                  />
                </label>
              )}
            </div>
          </section>
          <div className="pm-dashboard">
            <aside className="pm-calibration pm-panel">
              <div className="pm-section-title">
                <ScanLine size={17} />
                <h2>{t('calibration')}</h2>
              </div>
              <div
                className={`pm-cal-orbit ${engine.reference ? 'complete' : ''}`}
              >
                <Progress
                  type="circle"
                  percent={
                    engine.phase === 'calibrating'
                      ? Math.round(engine.progress)
                      : engine.reference
                        ? 100
                        : 0
                  }
                  size={42}
                  strokeWidth={3}
                  strokeColor={engine.reference ? '#3edba4' : '#43bdff'}
                  railColor="#16344c"
                  format={() =>
                    engine.reference ? (
                      <Check size={18} />
                    ) : (
                      <ScanLine size={18} />
                    )
                  }
                />
              </div>
              <h3>
                {engine.phase === 'calibrating'
                  ? t('calibrating')
                  : engine.reference
                    ? t('referenceReady')
                    : t('calibrationTitle')}
              </h3>
              <p>
                {engine.phase === 'calibrating'
                  ? t(
                      engine.calibrationUnstable
                        ? 'unstable'
                        : engine.ready
                          ? 'stable'
                          : 'needFrame',
                    )
                  : engine.reference
                    ? t('referenceHint')
                    : t('calibrationHint')}
              </p>
              <Button
                block
                type="primary"
                icon={
                  engine.reference ? (
                    <RotateCcw size={15} />
                  ) : (
                    <ScanLine size={15} />
                  )
                }
                disabled={
                  tracker.status !== 'ready' ||
                  !engine.ready ||
                  engine.phase === 'calibrating'
                }
                onClick={monitor.calibrate}
              >
                {engine.phase === 'calibrating'
                  ? `${Math.round(engine.progress)}%`
                  : t(engine.reference ? 'recalibrate' : 'calibrate')}
              </Button>
              {!tracker.media && (
                <span className="pm-cal-note">{t('needCamera')}</span>
              )}
            </aside>
            <section className="pm-camera pm-panel" ref={preview}>
              <div className="pm-camera-toolbar">
                <span>
                  <Camera size={16} />
                  {t('camera')}
                </span>
                <Select
                  aria-label={t('cameraDevice')}
                  value={deviceId}
                  disabled={tracker.cameraStarting}
                  onChange={(value) => {
                    setDeviceId(value);
                    if (tracker.media)
                      void monitor.startCamera(value || undefined);
                    else monitor.clearReference();
                  }}
                  options={[
                    { value: '', label: t('defaultCamera') },
                    ...devices
                      .map((d, i) => ({
                        value: d.deviceId,
                        label: d.label || `${t('camera')} ${i + 1}`,
                      }))
                      .filter((d) => d.value),
                  ]}
                />
                <Button
                  type="text"
                  aria-label={t('fullscreen')}
                  icon={<Maximize size={15} />}
                  onClick={() => {
                    if (document.fullscreenElement)
                      void document.exitFullscreen();
                    else
                      void preview.current
                        ?.requestFullscreen?.()
                        .catch(() => {});
                  }}
                />
              </div>
              <div className={`pm-video ${tracker.media ? 'has-camera' : ''}`}>
                <div className="pm-video-status">
                  <span className={engine.ready ? 'ready' : ''}>
                    <i />
                    {t(status)}
                  </span>
                  <span>
                    <Clock3 size={14} />
                    {formatTime(engine.stats.duration)}
                  </span>
                </div>
                <div
                  className={`pm-media ${mirror ? 'mirrored' : ''}`}
                  style={{ visibility: tracker.media ? 'visible' : 'hidden' }}
                >
                  <video
                    ref={tracker.videoRef}
                    muted
                    playsInline
                    aria-label={
                      language === 'zh'
                        ? '坐姿鏡頭預覽'
                        : 'Seated camera preview'
                    }
                  />
                  <canvas ref={tracker.canvasRef} aria-label={t('overlay')} />
                </div>
                {!tracker.media && (
                  <div className="pm-camera-empty">
                    <Camera size={32} />
                    <h3>{t('noCamera')}</h3>
                    <p>{t('noCameraHint')}</p>
                    <Button
                      type="primary"
                      icon={<Camera size={16} />}
                      loading={tracker.cameraStarting}
                      onClick={() =>
                        void monitor.startCamera(deviceId || undefined)
                      }
                    >
                      {t('enableCamera')}
                    </Button>
                  </div>
                )}
                {tracker.media && tracker.status === 'loading' && (
                  <div className="pm-video-overlay">
                    <div className="pm-spinner" />
                    <span>{t('loading')}</span>
                  </div>
                )}
                {engine.phase === 'calibrating' && (
                  <div className="pm-video-overlay calibration">
                    <span className="pm-countdown">
                      {Math.max(1, Math.ceil(3 * (1 - engine.progress / 100)))}
                    </span>
                    <p>{t(engine.ready ? 'stable' : 'needFrame')}</p>
                  </div>
                )}
                {engine.phase === 'paused' && (
                  <div className="pm-video-overlay">
                    <Pause size={27} />
                    <h3>{t('paused')}</h3>
                    <p>{t('backgroundHint')}</p>
                    <Button
                      onClick={monitor.resume}
                      disabled={engine.needsRecalibration}
                    >
                      {t('resume')}
                    </Button>
                  </div>
                )}
              </div>
              <div className="pm-preview-controls">
                <label>
                  <Switch
                    aria-label={t('overlay')}
                    checked={overlay}
                    onChange={setOverlay}
                    size="small"
                  />
                  {t('overlay')}
                </label>
                <label>
                  <Switch
                    aria-label={t('mirror')}
                    checked={mirror}
                    onChange={setMirror}
                    size="small"
                  />
                  {t('mirror')}
                </label>
                <span>
                  <ShieldCheck size={12} />
                  {t('private')}
                </span>
              </div>
              <div className="pm-camera-actions">
                <span className="pm-session-state">
                  <i className={active ? 'live' : ''} />
                  {t(
                    engine.phase === 'monitoring'
                      ? 'monitoring'
                      : engine.phase === 'paused'
                        ? 'paused'
                        : engine.reference
                          ? 'referenceReady'
                          : 'waiting',
                  )}
                </span>
                {active && (
                  <>
                    <Button
                      aria-label={t(
                        engine.phase === 'paused' ? 'resume' : 'pause',
                      )}
                      icon={
                        engine.phase === 'paused' ? (
                          <Play size={15} />
                        ) : (
                          <Pause size={15} />
                        )
                      }
                      disabled={engine.needsRecalibration}
                      onClick={
                        engine.phase === 'paused'
                          ? monitor.resume
                          : monitor.pause
                      }
                    />
                    <Button
                      onClick={() => monitor.finish()}
                      icon={<Square size={12} />}
                    >
                      {t('finish')}
                    </Button>
                  </>
                )}
                {!active && tracker.media && (
                  <Button
                    onClick={() => monitor.finish(false)}
                    icon={<Square size={12} />}
                  >
                    {t('stopCamera')}
                  </Button>
                )}
              </div>
            </section>
            <aside className="pm-readings">
              <div className={`pm-reminder-toggle ${reminders ? 'on' : ''}`}>
                <span className="pm-round-icon">
                  <Bell size={23} />
                </span>
                <div>
                  <strong>{t('reminders')}</strong>
                  <span>
                    {t(
                      snoozed
                        ? 'snoozed'
                        : reminders
                          ? 'remindersHint'
                          : 'remindersOff',
                    )}
                  </span>
                </div>
                <Switch
                  aria-label={t('reminders')}
                  checked={reminders}
                  onChange={setReminders}
                />
              </div>
              {metricKeys
                .filter((key) => profile === 'front' || key !== 'shoulders')
                .map((key) => {
                  const check = checks.find((c) => c.key === key);
                  const Icon = metricIcons[key];
                  const state =
                    engine.needsRecalibration || !engine.ready
                      ? 'unavailable'
                      : (check?.status ?? 'waiting');
                  return (
                    <button
                      className={`pm-reading ${state}`}
                      key={key}
                      onClick={() => setDetail(key)}
                    >
                      <span className="pm-round-icon">
                        <Icon size={23} />
                      </span>
                      <div>
                        <span>{t(key)}</span>
                        <strong>
                          {check?.delta != null &&
                          engine.ready &&
                          !engine.needsRecalibration
                            ? `${check.delta > 0 ? '+' : ''}${check.delta.toFixed(1)}${key === 'proximity' ? '%' : '°'}`
                            : '—'}
                        </strong>
                        <small>
                          {t(
                            !engine.reference
                              ? 'waiting'
                              : (state as 'near' | 'changed' | 'unavailable'),
                          )}
                        </small>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  );
                })}
            </aside>
          </div>
          {monitor.cameraError && (
            <Alert
              type="error"
              showIcon
              title={t(
                monitor.cameraError.includes('denied')
                  ? 'cameraDenied'
                  : 'cameraTrouble',
              )}
              className="pm-alert"
            />
          )}
          {engine.needsRecalibration && (
            <Alert
              type="warning"
              showIcon
              title={t('cameraChanged')}
              className="pm-alert"
            />
          )}
          {monitor.alert && reminders && !snoozed && (
            <div className="pm-live-alert" role="status">
              <span className="pm-round-icon">
                <Bell size={22} />
              </span>
              <div>
                <strong>{t('reminder')}</strong>
                <p>{t(cues[monitor.alert.key])}</p>
              </div>
              <Button onClick={monitor.snooze}>{t('snooze')}</Button>
            </div>
          )}
          <section className="pm-session-strip">
            <div className="pm-stat">
              <span>
                <Clock3 size={16} />
                {t('duration')}
              </span>
              <strong>{formatTime(engine.stats.duration)}</strong>
            </div>
            <div className="pm-stat green">
              <span>
                <Armchair size={16} />
                {t('referenceTime')}
              </span>
              <strong>{formatTime(engine.stats.near)}</strong>
            </div>
            <button className="pm-stat" onClick={() => setGuide(true)}>
              <span>
                <Eye size={16} />
                {t('coverage')}
              </span>
              <strong>
                {coverage}
                <em>%</em>
              </strong>
              <small>
                {t('gapTime')} · {formatTime(engine.stats.gaps)}
              </small>
            </button>
            <button className="pm-stat" onClick={() => setHistory(true)}>
              <span>
                <Bell size={16} />
                {t('reminderCount')}
              </span>
              <strong>{engine.stats.reminders}</strong>
            </button>
            <div className="pm-snooze">
              <Button
                disabled={!active || !reminders}
                icon={snoozed ? <Bell size={16} /> : <BellOff size={16} />}
                onClick={snoozed ? monitor.wake : monitor.snooze}
              >
                {t(snoozed ? 'wake' : 'snooze')}
              </Button>
              {snoozed && (
                <span>
                  {formatTime(
                    Math.max(
                      0,
                      (engine.snoozeUntil - performance.now()) / 1000,
                    ),
                  )}
                </span>
              )}
            </div>
          </section>
          {monitor.storageError && (
            <Alert
              title={t('storageError')}
              type="warning"
              className="pm-alert"
            />
          )}
        </main>
        <Drawer
          getContainer={popupContainer}
          rootClassName="pm-portal"
          title={t('settings')}
          open={settings}
          onClose={() => setSettings(false)}
          width={420}
        >
          {(
            [
              { key: 'overlay', value: overlay, set: setOverlay },
              { key: 'tweening', value: tweening, set: setTweening },
              { key: 'mirror', value: mirror, set: setMirror },
              { key: 'voice', value: voice, set: setVoice },
            ] as const
          ).map((item) => (
            <div className="pm-setting" key={item.key}>
              <div>
                <strong>{t(item.key)}</strong>
                {item.key === 'tweening' && <p>{t('tweenHint')}</p>}
                {item.key === 'voice' && <p>{t('voiceHint')}</p>}
              </div>
              <Switch
                aria-label={t(item.key)}
                checked={item.value}
                onChange={item.set}
                disabled={item.key === 'tweening' && !overlay}
              />
            </div>
          ))}
          <div className="pm-setting-block">
            <strong>{t('flexibility')}</strong>
            <Select
              aria-label={t('flexibility')}
              value={flexibility}
              onChange={setFlexibility}
              options={[
                { value: 1, label: t('standard') },
                { value: 1.25, label: t('gentle') },
                { value: 1.5, label: t('relaxed') },
              ]}
            />
          </div>
          <div className="pm-setting-block">
            <label>
              {t('sustained')}
              <b>
                {sustain} {t('seconds')}
              </b>
            </label>
            <Slider
              aria-label={t('sustained')}
              min={3}
              max={15}
              value={sustain}
              onChange={setSustain}
            />
            <p>{t('diagonalGrace')}</p>
          </div>
          <div className="pm-setting-block">
            <label>
              {t('cooldown')}
              <b>
                {cooldown} {t('seconds')}
              </b>
            </label>
            <Slider
              aria-label={t('cooldown')}
              min={15}
              max={120}
              step={5}
              value={cooldown}
              onChange={setCooldown}
            />
          </div>
          <div className="pm-setting-block">
            <strong>{t('checks')}</strong>
            {metricKeys
              .filter((key) => profile === 'front' || key !== 'shoulders')
              .map((key) => (
                <div className="pm-setting compact" key={key}>
                  <span>{t(key)}</span>
                  <Switch
                    aria-label={`${t(key)} ${t('reminders')}`}
                    checked={enabled[key]}
                    onChange={(value) =>
                      setEnabled((prev) => ({ ...prev, [key]: value }))
                    }
                  />
                </div>
              ))}
          </div>
          <p className="pm-setting-note">{t('finishFirst')}</p>
        </Drawer>
        <Modal
          getContainer={popupContainer}
          rootClassName="pm-portal"
          title={detail ? t(detail) : ''}
          open={!!detail}
          onCancel={() => setDetail(null)}
          footer={
            <Button type="primary" onClick={() => setDetail(null)}>
              {t('done')}
            </Button>
          }
        >
          {detail && (
            <div className="pm-detail">
              <div>
                <span>{t('currentChange')}</span>
                <strong>
                  {checks.find((c) => c.key === detail)?.delta?.toFixed(1) ??
                    '—'}{' '}
                  {detail === 'proximity' ? '%' : '°'}
                </strong>
              </div>
              <div>
                <span>{t('threshold')}</span>
                <strong>
                  {checks
                    .find((c) => c.key === detail)
                    ?.threshold?.toFixed(0) ?? '—'}{' '}
                  {detail === 'proximity' ? '%' : '°'}
                </strong>
              </div>
              <p>
                {t(
                  detail === 'head' && profile === 'front'
                    ? 'headFrontDetail'
                    : descriptions[detail],
                )}
              </p>
            </div>
          )}
        </Modal>
        <Modal
          getContainer={popupContainer}
          rootClassName="pm-portal"
          title={t('guideTitle')}
          open={guide}
          onCancel={() => setGuide(false)}
          footer={
            <Button type="primary" onClick={() => setGuide(false)}>
              {t('done')}
            </Button>
          }
        >
          <div className="pm-guide">
            <p>{t('guideIntro')}</p>
            <div className="pm-guide-reference">
              <SeatedReference />
            </div>
            {(['front', 'side', 'diagonal'] as CameraProfile[]).map((p) => (
              <div key={p}>
                <CameraPlacement profile={p} />
                <p>
                  {t(
                    p === 'front'
                      ? 'guideFront'
                      : p === 'side'
                        ? 'guideSide'
                        : 'guideDiagonal',
                  )}
                </p>
              </div>
            ))}
            <p>{t('guideChair')}</p>
            <p>{t('timeHint')}</p>
            <p>{t('backgroundHint')}</p>
            <aside>{t('guideLimits')}</aside>
          </div>
        </Modal>
        <Drawer
          getContainer={popupContainer}
          rootClassName="pm-portal"
          title={t('history')}
          open={history}
          onClose={() => setHistory(false)}
          width={480}
        >
          <p className="pm-history-hint">{t('historyHint')}</p>
          {monitor.records.length ? (
            monitor.records.map((record) => (
              <button
                className="pm-history-item"
                key={record.id}
                onClick={() => {
                  setHistory(false);
                  monitor.setRecap(record);
                }}
              >
                <span className="pm-round-icon">
                  <Armchair size={21} />
                </span>
                <div>
                  <strong>
                    {t(record.profile)}
                    {record.profile !== 'front' && ` · ${t(record.side)}`}
                  </strong>
                  <span>
                    {new Date(record.date).toLocaleString(
                      language === 'zh' ? 'zh-HK' : 'en-GB',
                      {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    )}{' '}
                    · {formatTime(record.duration)}
                  </span>
                </div>
                <ChevronRight size={15} />
              </button>
            ))
          ) : (
            <Empty description={t('noHistory')} />
          )}
        </Drawer>
        <Modal
          getContainer={popupContainer}
          rootClassName="pm-portal"
          open={!!monitor.recap}
          onCancel={() => monitor.setRecap(null)}
          footer={null}
          width={550}
        >
          <div className="pm-recap">
            <h2>{t('summary')}</h2>
            {monitor.recap && (
              <>
                <div className="pm-recap-grid">
                  <div>
                    <strong>{formatTime(monitor.recap.duration)}</strong>
                    <span>{t('duration')}</span>
                  </div>
                  <div>
                    <strong>{formatTime(monitor.recap.near)}</strong>
                    <span>{t('referenceTime')}</span>
                  </div>
                  <div>
                    <strong>{monitor.recap.reminders}</strong>
                    <span>{t('reminderCount')}</span>
                  </div>
                </div>
                <p>
                  {t('gapTime')} · {formatTime(monitor.recap.gaps)}
                </p>
                <div className="pm-events">
                  <h3>{t('events')}</h3>
                  {monitor.recap.events.length ? (
                    monitor.recap.events.map((event, i) => (
                      <p key={i}>
                        <time>{formatTime(event.at)}</time>
                        {t(cues[event.key])}
                      </p>
                    ))
                  ) : (
                    <p>{t('noEvents')}</p>
                  )}
                </div>
                <Button
                  block
                  type="primary"
                  icon={<Download size={15} />}
                  onClick={() => monitor.recap && download(monitor.recap)}
                >
                  {t('download')}
                </Button>
                <Button
                  block
                  type="text"
                  onClick={() => monitor.setRecap(null)}
                >
                  {t('done')}
                </Button>
              </>
            )}
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
}

function CameraPlacement({ profile }: { profile: CameraProfile }) {
  const camera =
    profile === 'front' ? [38, 12] : profile === 'side' ? [8, 43] : [13, 17];
  return (
    <svg className="pm-placement-art" viewBox="0 0 76 66" aria-hidden="true">
      <path
        d="M27 23h30v4H27"
        stroke="currentColor"
        strokeWidth="2"
        opacity=".5"
      />
      <circle cx="42" cy="42" r="7" fill="currentColor" opacity=".7" />
      <path
        d="M31 53q11 6 22 0"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M${camera[0]} ${camera[1]}L42 40`}
        stroke="currentColor"
        strokeDasharray="2 3"
        opacity=".6"
      />
      <rect
        x={camera[0] - 6}
        y={camera[1] - 4}
        width="12"
        height="8"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx={camera[0]} cy={camera[1]} r="1.5" fill="currentColor" />
    </svg>
  );
}
function SeatedReference() {
  return (
    <svg viewBox="0 0 270 235" aria-hidden="true">
      <ellipse cx="135" cy="214" rx="85" ry="8" fill="#43baff" opacity=".07" />
      <path
        d="M81 91V156H164M119 156V207M89 210H149"
        fill="none"
        stroke="#355b75"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M185 97H249M227 97V210"
        fill="none"
        stroke="#25435b"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M208 92h30l7-27" fill="none" stroke="#497089" strokeWidth="3" />
      <circle cx="134" cy="40" r="18" fill="#49677b" />
      <path
        d="M122 63Q138 64 138 83L143 130L165 139L190 143"
        fill="none"
        stroke="#36566b"
        strokeWidth="25"
        strokeLinecap="round"
      />
      <path
        d="M190 143L194 199L211 204"
        fill="none"
        stroke="#36566b"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M134 77L158 98L201 96"
        fill="none"
        stroke="#547186"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M139 43L134 78L143 137L190 143L194 200M134 78L159 98L200 96"
        fill="none"
        stroke="#4bdca9"
        strokeWidth="2.5"
        opacity=".85"
      />
      {[
        [139, 43],
        [134, 78],
        [143, 137],
        [190, 143],
        [194, 200],
        [159, 98],
        [200, 96],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#6cf2c1" />
      ))}
    </svg>
  );
}
