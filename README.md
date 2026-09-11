# Forma — movement studio

A private, browser-based yoga and warm-up coach built with Vite, React, TypeScript, Ant Design, and MediaPipe Pose Landmarker.

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
