import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark } from '../lib/analysis';
import {
  deriveNeckLandmarks,
  SKELETON_TWEEN_DURATION_MS,
  tweenLandmarks,
} from '../lib/poseTween';

type Media =
  | { kind: 'camera'; stream: MediaStream }
  | { kind: 'video'; url: string; name: string };
export type TrackingStatus = 'idle' | 'loading' | 'ready' | 'error';
const connections = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [0, 9],
  [0, 10],
  [9, 10],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [29, 31],
  [28, 30],
  [30, 32],
];
interface Options {
  overlay: boolean;
  tweening: boolean;
  onFrame: (points: Landmark[], time: number, aspect: number) => void;
  onSeek: () => void;
}
export function usePoseTracker({
  overlay,
  tweening,
  onFrame,
  onSeek,
}: Options) {
  const videoRef = useRef<HTMLVideoElement>(null),
    canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarker = useRef<PoseLandmarker | null>(null);
  const initialization = useRef<Promise<PoseLandmarker> | null>(null);
  const mediaRef = useRef<Media | null>(null),
    requestId = useRef(0);
  const options = useRef({ overlay, tweening, onFrame, onSeek });
  options.current = { overlay, tweening, onFrame, onSeek };
  const [media, setMedia] = useState<Media | null>(null);
  const [status, setStatus] = useState<TrackingStatus>('idle');
  const [error, setError] = useState('');
  const [cameraStarting, setCameraStarting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0),
    [duration, setDuration] = useState(0);
  const releaseMedia = useCallback(() => {
    const previous = mediaRef.current;
    if (previous?.kind === 'camera')
      previous.stream.getTracks().forEach((t) => t.stop());
    if (previous?.kind === 'video') URL.revokeObjectURL(previous.url);
    mediaRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
  }, []);
  const stop = useCallback(() => {
    requestId.current++;
    releaseMedia();
    setMedia(null);
    setStatus('idle');
    setPlaying(false);
    setCameraStarting(false);
    setTime(0);
    setDuration(0);
    setError('');
  }, [releaseMedia]);
  const startCamera = useCallback(
    async (deviceId?: string) => {
      const id = ++requestId.current;
      setCameraStarting(true);
      setStatus('idle');
      setError('');
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            'Camera access needs localhost or an HTTPS connection.',
          );
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...(deviceId
              ? { deviceId: { exact: deviceId } }
              : { facingMode: 'user' }),
            width: { ideal: 960 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (id !== requestId.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        releaseMedia();
        const next: Media = { kind: 'camera', stream };
        mediaRef.current = next;
        setMedia(next);
      } catch (e) {
        if (id !== requestId.current) return;
        const name = e instanceof Error ? e.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was denied. Allow camera access in your browser and try again, or upload a video.'
            : name === 'NotFoundError'
              ? 'No camera was found. Connect a camera or upload a video to get started.'
              : e instanceof Error
                ? e.message
                : 'Could not open the camera. Please try again.',
        );
        setStatus('error');
      } finally {
        if (id === requestId.current) setCameraStarting(false);
      }
    },
    [releaseMedia],
  );
  const upload = useCallback(
    (file: File) => {
      if (!file.type.startsWith('video/')) {
        setError('Please choose a video file, such as MP4, WebM, or MOV.');
        return false;
      }
      if (file.size > 500 * 1024 * 1024) {
        setError('Choose a video smaller than 500 MB.');
        return false;
      }
      requestId.current++;
      releaseMedia();
      setError('');
      setTime(0);
      setDuration(0);
      const next: Media = {
        kind: 'video',
        url: URL.createObjectURL(file),
        name: file.name,
      };
      mediaRef.current = next;
      setMedia(next);
      return true;
    },
    [releaseMedia],
  );
  useEffect(() => {
    if (!media) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false,
      frameId = 0,
      lastTime = -1,
      lastInference = 0,
      tweenStart = 0;
    let targetPoints: Landmark[] = [],
      renderedPoints: Landmark[] = [],
      tweenFrom: Landmark[] = [];
    setStatus('loading');
    if (media.kind === 'camera') video.srcObject = media.stream;
    else {
      video.srcObject = null;
      video.src = media.url;
    }
    const onPlay = () => setPlaying(true),
      onPause = () => setPlaying(false);
    const onTime = () => {
      setTime(video.currentTime);
      if (Number.isFinite(video.duration)) setDuration(video.duration);
    };
    const seeking = () => {
      options.current.onSeek();
      targetPoints = [];
      renderedPoints = [];
      tweenFrom = [];
      canvasRef.current
        ?.getContext('2d')
        ?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };
    const mediaError = () => {
      setError(
        'This video could not be decoded. Try an MP4 (H.264) or WebM file supported by your browser.',
      );
      setStatus('error');
    };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onTime);
    video.addEventListener('durationchange', onTime);
    video.addEventListener('error', mediaError);
    video.addEventListener('seeking', seeking);
    async function initialize() {
      try {
        if (!initialization.current)
          initialization.current = (async () => {
            const { FilesetResolver, PoseLandmarker } =
              await import('@mediapipe/tasks-vision');
            const files = await FilesetResolver.forVisionTasks(
              `${import.meta.env.BASE_URL}wasm`,
            );
            const base = {
              modelAssetPath: `${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`,
            };
            let model: PoseLandmarker;
            try {
              model = await PoseLandmarker.createFromOptions(files, {
                baseOptions: { ...base, delegate: 'GPU' },
                runningMode: 'VIDEO',
                numPoses: 1,
              });
            } catch {
              model = await PoseLandmarker.createFromOptions(files, {
                baseOptions: { ...base, delegate: 'CPU' },
                runningMode: 'VIDEO',
                numPoses: 1,
              });
            }
            landmarker.current = model;
            return model;
          })().catch((e) => {
            initialization.current = null;
            throw e;
          });
        const model = await initialization.current;
        if (cancelled) return;
        setStatus('ready');
        // File playback is user controlled, so the start of a clip isn't skipped while the model loads.
        if (media?.kind === 'camera') await video!.play();
        const drawSkeleton = (points: Landmark[]) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          if (
            canvas.width !== video!.videoWidth ||
            canvas.height !== video!.videoHeight
          ) {
            canvas.width = video!.videoWidth;
            canvas.height = video!.videoHeight;
          }
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (!options.current.overlay || !points.length) return;

          ctx.strokeStyle = '#a8e5bc';
          ctx.lineWidth = Math.max(2, canvas.width / 300);
          ctx.lineCap = 'round';
          for (const [a, b] of connections)
            if (
              (points[a]?.visibility ?? 0) > 0.5 &&
              (points[b]?.visibility ?? 0) > 0.5
            ) {
              ctx.beginPath();
              ctx.moveTo(
                points[a].x * canvas.width,
                points[a].y * canvas.height,
              );
              ctx.lineTo(
                points[b].x * canvas.width,
                points[b].y * canvas.height,
              );
              ctx.stroke();
            }
          const neck = deriveNeckLandmarks(points);
          if (neck && (neck.base.visibility ?? 0) > 0.5) {
            ctx.beginPath();
            ctx.moveTo(neck.top.x * canvas.width, neck.top.y * canvas.height);
            ctx.lineTo(neck.base.x * canvas.width, neck.base.y * canvas.height);
            ctx.stroke();
          }
          for (const i of [
            0, 2, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27,
            28,
          ])
            if ((points[i]?.visibility ?? 0) > 0.5) {
              ctx.beginPath();
              ctx.arc(
                points[i].x * canvas.width,
                points[i].y * canvas.height,
                Math.max(4, canvas.width / 180),
                0,
                Math.PI * 2,
              );
              ctx.fillStyle = '#ecfff0';
              ctx.fill();
              ctx.stroke();
            }
          if (neck && (neck.base.visibility ?? 0) > 0.5)
            for (const point of [neck.top, neck.base]) {
              ctx.beginPath();
              ctx.arc(
                point.x * canvas.width,
                point.y * canvas.height,
                Math.max(4, canvas.width / 180),
                0,
                Math.PI * 2,
              );
              ctx.fillStyle = '#ecfff0';
              ctx.fill();
              ctx.stroke();
            }
        };
        const tick = (now: number) => {
          if (cancelled) return;
          if (
            video!.readyState >= 2 &&
            !video!.seeking &&
            video!.currentTime !== lastTime &&
            now - lastInference >= 90
          ) {
            lastTime = video!.currentTime;
            lastInference = now;
            try {
              const result = model.detectForVideo(video!, performance.now());
              const points: Landmark[] = result.landmarks[0] ?? [];
              if (!points.length) {
                targetPoints = [];
                renderedPoints = [];
                tweenFrom = [];
              } else if (
                options.current.tweening &&
                renderedPoints.length === points.length
              ) {
                tweenFrom = renderedPoints.map((point) => ({ ...point }));
                targetPoints = points;
                tweenStart = now;
              } else {
                targetPoints = points;
                renderedPoints = points.map((point) => ({ ...point }));
                tweenFrom = renderedPoints;
                tweenStart = now;
              }
              options.current.onFrame(
                points,
                video!.currentTime,
                video!.videoWidth / video!.videoHeight,
              );
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : 'Tracking stopped. Reload the video or reconnect your camera.',
              );
              setStatus('error');
              return;
            }
          }
          if (options.current.tweening && targetPoints.length) {
            renderedPoints = tweenLandmarks(
              tweenFrom,
              targetPoints,
              (now - tweenStart) / SKELETON_TWEEN_DURATION_MS,
            );
          } else if (targetPoints.length) {
            renderedPoints = targetPoints;
          }
          drawSkeleton(renderedPoints);
          frameId = requestAnimationFrame(tick);
        };
        frameId = requestAnimationFrame(tick);
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setError(
            `Could not initialize pose tracking. ${e instanceof Error ? e.message : 'Please try again.'}`,
          );
        }
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onTime);
      video.removeEventListener('durationchange', onTime);
      video.removeEventListener('error', mediaError);
      video.removeEventListener('seeking', seeking);
    };
  }, [media]);
  useEffect(
    () => () => {
      requestId.current++;
      releaseMedia();
      const pending = initialization.current;
      initialization.current = null;
      if (pending)
        void pending
          .then((m) => {
            m.close();
          })
          .catch(() => {});
    },
    [releaseMedia],
  );
  useEffect(() => {
    if (!overlay) {
      const c = canvasRef.current;
      c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    }
  }, [overlay]);
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused)
      void v
        .play()
        .catch(() =>
          setError('Playback could not start. Try a different video.'),
        );
    else v.pause();
  };
  const seek = (value: number) => {
    if (videoRef.current && Number.isFinite(value))
      videoRef.current.currentTime = value;
  };
  return {
    videoRef,
    canvasRef,
    media,
    status,
    error,
    cameraStarting,
    playing,
    time,
    duration,
    startCamera,
    stop,
    upload,
    togglePlay,
    seek,
  };
}
