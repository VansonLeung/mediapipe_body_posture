# Forma — movement studio & posture monitor

A private, browser-based movement studio and seated posture monitor built with Vite, React, TypeScript, Ant Design, and MediaPipe Pose Landmarker.

## Run

Requires Node.js 22.12+ (or a compatible newer release).

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5175**. Camera access works on localhost or HTTPS. The dev server uses port 5175 to avoid the existing app on 5173.

```sh
npm run build       # TypeScript checks and production bundle in dist/
npm run preview     # Preview production bundle
npm test            # Geometry, tracking confidence, and repetition tests
npm run test:e2e    # Chrome browser integration tests
```

Browser tests use installed Google Chrome. To use Playwright Chromium instead, remove `channel: 'chrome'` from `playwright.config.ts` and run `npx playwright install chromium`.

## Features

- **Guided practice:** select Warrior II, Tree pose, arm raises, or standing side bends. A three-second full-body framing countdown leads into a 30-second aligned hold or eight controlled repetitions, followed by an eight-second rest and a recap.
- **Open analysis:** practice without an automatic time or repetition limit. Both workflows support a live camera or an uploaded video.
- **Live coaching:** full-body skeleton with face anchors and a derived neck joint, optional keypoint tweening, joint angles, one alignment cue at a time, confidence gating, adjustable angle tolerances, optional spoken cues, and mirrored camera view. Tweening defaults to disabled and affects only the overlay; analysis continues to use raw landmarks.
- **Video review:** user-controlled playback, scrubbing, a feedback timeline, and clickable moments to revisit. Only played portions during an active session are analyzed into the timeline. Replaying previously credited time does not inflate hold totals.
- **Progress:** up to 100 session summaries in local storage, aggregate metrics, and JSON downloads. No account or backend.
- Responsive exercise library, illustrated pose instructions, camera setup tips, and accessible controls.

## Seated Posture Monitor

Open **http://127.0.0.1:5175/#posture**, or choose **Posture Monitor** in the studio navigation. Use **Movement Studio** in the monitor header to return. The monitor has its own dark navy interface and English/Traditional Chinese language switch. The language preference persists locally; camera references are intentionally captured anew for each setup.

1. Choose **Front**, **Side**, or **Diagonal** camera placement. For side and diagonal views, select whether the webcam is on **your left** or **your right**. Keep the camera upright; diagonal means a front-left or front-right view approximately 30–45° off center while you continue facing the screen.
2. Select your webcam, enable it, and check the upper-body framing. Front view needs the nose, both ears, and both shoulders. Side/diagonal views need the nose and the nearer ear and shoulder. Hips are optional and enable torso checks; wrists, legs, and feet are not required.
3. Choose **Calibrate & start** and hold a comfortable reference position steady for three seconds. Significant movement or tracking loss restarts calibration. Monitoring starts automatically after capture.
4. Use pause/resume, five-minute reminder snooze, and settings for reminder types, sensitivity, cooldown, voice, mirror, and optional skeleton tweening (off by default).
5. Finish to save a summary with monitored time, time near the reference, tracking gaps, and reminder events. History is separate from exercise sessions, and summaries can be downloaded as JSON.

The camera/landmark/tweening implementation is shared through `usePoseTracker`. `src/lib/posture.ts` provides separate reference calibration, view-dependent measurements, and sustained reminder logic. `src/hooks/usePostureMonitor.ts` manages the monitoring clock, camera lifecycle, alerts, and local history. No exercise-specific full-body gate or rep counter is used in this workspace.

| Profile  | Measurements                                                                                                                 | Default sustained-change delay |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Front    | Lateral head tilt, shoulder alignment, optional shoulder-to-hip lean, relative apparent head size                            | 5 seconds                      |
| Side     | Near-side ear-to-shoulder line, optional shoulder-to-hip lean, relative apparent head size when perspective can be checked   | 5 seconds                      |
| Diagonal | Changes from the captured projected head/torso geometry, conservative relative proximity checks; no shoulder-asymmetry score | At least 8 seconds             |

Reminders have a default 30-second cooldown. The apparent-size proximity check is suspended when its perspective cross-check is missing or changes too much. It does not measure centimeters or actual distance to the screen. Missing measurements are shown as unavailable, and time without all calibrated measurements is counted as a tracking gap rather than near-reference time. Calibrated channels that are unavailable never trigger an alert.

Keep the monitor page visible, for example beside your work or on a second screen. Monitoring automatically pauses when the page becomes hidden, and requires manual resume when you return. This is not an operating-system background monitor. Camera changes and profile changes end the current session and clear its reference. A change in video aspect ratio also invalidates the reference; camera movement that preserves the image geometry cannot reliably be distinguished from user movement, so recalibrate whenever the webcam is repositioned.

The measurements are heuristic changes relative to a user-selected reference, not anatomical angles, validated medical targets, or a diagnosis. Chair support, foot contact, weight distribution, and spinal curvature remain manual setup checks. Diagonal thresholds are conservative starting points and have not been clinically validated. Automated tests cover synthetic upper-body geometry, all three profile rules, calibration stability, tracking gaps, cooldown/snooze, and real MediaPipe inference on the reference photo; they do not replace testing with people in varied seated setups.

## How tracking works

`src/hooks/usePoseTracker.ts` loads the model on demand and attempts the GPU delegate, falling back to CPU when initialization fails. It samples changed video frames at approximately 10 fps to limit inference load. Optional skeleton tweening interpolates rendered keypoints over 120 ms on animation frames while posture analysis receives the unsmoothed model output. Inference currently runs synchronously on the main thread; slower devices may benefit from a future worker-based implementation.

`src/lib/analysis.ts` uses aspect-corrected 2D joint angles. Key body landmarks must have at least 0.6 visibility and remain inside the frame. Pose holds accumulate only when all checks pass. Warm-ups require a lower → raise/bend → return sequence; losing tracking, poor alignment, or seeking resets an incomplete repetition. All exercise targets are heuristics for visible alignment, not validated clinical measurements. A single frontal camera cannot reliably measure rotation, depth, foot contact, pain, or individual range of motion.

`src/hooks/useSession.ts` manages framing, practice, pause, rest, review samples, repetition state, and session summaries. Source changes and navigation release camera tracks and revoke uploaded-video object URLs. Completed live sessions turn the camera off.

## Assets and privacy

- Model: the official [MediaPipe Pose Landmarker Lite](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task), bundled at `public/models/pose_landmarker_lite.task`.
- WASM files are copied from the pinned npm package into `public/wasm` by the `postinstall` script. If lifecycle scripts are disabled, run `node scripts/copy-wasm.mjs` before starting or building.
- No inference assets require a third-party request at runtime. Google Fonts is optional; system fonts are used if unavailable.
- Camera/video frames are processed in the browser and are not uploaded or recorded by the app. Uploaded files are referenced with local object URLs. Only session summaries are persisted.
- Spoken cues use the browser's speech-synthesis service; voice availability depends on the browser/OS.
- Illustrations and app icons are SVG. The photo in `tests/fixtures/pose.jpg` is the official [MediaPipe test image](https://storage.googleapis.com/mediapipe-assets/pose.jpg), used only for automated inference verification and not shipped in the app.

Implementation reference: [Google's Pose Landmarker web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js).
