# Forma — movement studio & posture monitor

A local movement studio and seated posture monitor for browsers and Electron, built with Vite, React, TypeScript, Ant Design, and MediaPipe Pose Landmarker.

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

### Mobile camera testing over HTTPS

Keep `npm run dev` for HTTP on port **5175**. In another terminal run:

```sh
npm run dev:https
```

On the same Wi-Fi/LAN, open the **Network** HTTPS URL printed by Vite, for example `https://<computer-LAN-IP>:5176/#kiosk`. Use the computer's address, not `localhost` on the tablet. Both servers can run together; they use separate dependency caches. Models, WASM and hot reload use the same HTTPS origin.

The default HTTPS mode uses a cached, self-signed development certificate from [Vite's basic SSL plugin](https://github.com/vitejs/vite-plugin-basic-ssl). The browser will show a certificate warning. Accepting the warning can be sufficient for local testing, but it does not guarantee camera permission in every mobile browser. `getUserMedia` requires a [secure context](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). If the tablet still blocks the camera, use a certificate whose issuing CA is trusted on that tablet and whose subject alternative names include the computer's LAN IP or hostname:

```sh
DEV_HTTPS_CERT=.certs/dev-cert.pem DEV_HTTPS_KEY=.certs/dev-key.pem npm run dev:https
```

Supply both PEM file paths. `.certs/` is ignored by git. For iPadOS, a manually installed CA certificate also needs SSL trust enabled under **Settings → General → About → Certificate Trust Settings**; see [Apple's certificate trust instructions](https://support.apple.com/en-us/102390). Installing/trusting a CA is a device setup step; this app does not change system trust settings. HTTP, HTTPS and each different hostname/IP have separate browser permissions and local storage.

Browser tests use installed Google Chrome. To use Playwright Chromium instead, remove `channel: 'chrome'` from `playwright.config.ts` and run `npx playwright install chromium`.

## Electron desktop app

```sh
npm run electron:dev    # Vite hot reload inside Electron; uses a separate local port
npm run electron:start  # Build and run the production app, without a web server
npm run electron:pack   # Build an unpacked desktop app in release/
npm run electron:dist   # Build an installer for the current platform
npm run electron:dist:mac # Build the macOS DMG
npm run electron:dist:win # Cross-build the Windows x64 NSIS installer on macOS
npm run test:electron   # Desktop integration test, including real MediaPipe video inference
npm run test:desktop-security # Local resource and permission boundary tests
```

Both workspaces use the same React code and bundled model/WASM assets in the desktop app. Production assets are served from a local `forma://app` origin, with no server or network connection required. Electron storage is separate from browser storage; session summaries remain on that device.

The fullscreen button expands the native desktop window. You can also use **View → Toggle Full Screen** (Control–Command–F on macOS, F11 on Windows/Linux). App fullscreen and camera-only fullscreen have no outer content padding. Settings and detail dialogs stay accessible in fullscreen.

Camera access is requested when you enable it. On macOS, allow Forma in **System Settings → Privacy & Security → Camera** if access was previously denied. Microphone access is not requested. Development runs appear as Electron in operating-system permission prompts. The desktop renderer is sandboxed, with Node.js disabled and an isolated, fullscreen-only preload API; media permission is restricted to the local app.

Packaging targets are macOS DMG, Windows x64 NSIS, and Linux AppImage. Run `npm run electron:dist:win` (or `./scripts/build.sh`) on macOS to create the Windows installer in `release/`. macOS builds use an ad-hoc signature for local use. Public distribution requires the appropriate code-signing identities; Apple notarization can be configured in `electron-builder.yml`. No publishing or auto-update service is configured.

Electron implementation references: [local application protocols](https://www.electronjs.org/docs/latest/api/protocol), [permission handlers](https://www.electronjs.org/docs/latest/api/session), and [macOS packaging](https://www.electron.build/mac/).

## Features

- **Compact workspaces:** toolbar navigation, concise labels, camera-first layouts, and no promotional headers or footers. Desktop practice fits the viewport; narrow screens use a stacked layout.

- **Primary 1–3 pilot:** 17 standing movements, including arm raises, gentle side bends, balance, reaching, marching, shoulder and hip circles, standing cat–cow, twists, and knee lifts. One student, no jumping or equipment; each exercise specifies a front or side camera view. Automatic guided practice uses a three-second framing countdown, four repetitions or a five-second shape hold by default, and an eight-second rest. The 12 teacher-reviewed exercises use manual attempt markers and explicit completion. These are editable pilot defaults, not validated age-specific prescriptions.
- **Open analysis:** practice without an automatic time or repetition limit. Both workflows support a live camera or an uploaded video.
- **Live coaching:** full-body skeleton with face anchors and a derived neck joint, optional keypoint tweening, joint angles, one alignment cue at a time, confidence gating, adjustable angle tolerances, optional spoken cues, and mirrored camera view. Tweening defaults to enabled and affects only the overlay; analysis continues to use raw landmarks.
- **Video review:** user-controlled playback, scrubbing, a feedback timeline, and clickable moments to revisit. Only played portions during an active session are analyzed into the timeline. Replaying previously credited time does not inflate hold totals.
- **Progress:** up to 100 session summaries in local storage, aggregate metrics, and JSON downloads. No account or backend.
- Responsive exercise library, illustrated pose instructions, camera setup tips, and accessible controls.

## Movement catalogue and combinations

Exercise content is a standalone data area inside this repository: see [catalog/README.md](catalog/README.md) for the schema, movement rationale, and authoring workflow. All 36 existing IDs are preserved, with 13 new definitions added. The 17-movement **Primary 1–3** collection determines what appears in the library, exercise selector, next-exercise navigation, and combination builder. The other 32 definitions remain drafts, available to historical records but not to new practice. The AI-generated gymnastics poster is retained as provisional provenance; it is not an approved syllabus. Arch and Bridge remain separate records.

English and Traditional Chinese are available for exercise content, feedback, practice controls, and combinations. Illustrated demonstrations and completion progress lead the practice panel; detailed measurements and video feedback are expandable teacher views. All 16 moving exercises have user-controlled animated demonstrations, including the teacher-reviewed movements; standing balance has a static illustration. Demonstrations are available both in guided practice and on each moving exercise’s card in the exercise library (動作資料庫). Library demonstrations start playing automatically when browsing; each card retains Pause and Next picture controls. **Play demonstration** smoothly moves the stickman between catalogue poses with a short pause at each stage. **Pause demonstration** freezes the current position; **Next picture** advances to an exact pose. Demonstrations play smoothly even when the OS Reduce Motion setting is enabled; no additional animation toggle is needed. Playback stops advancing while the page is hidden. Menus respect reduced motion through Ant Design’s motion setting rather than global CSS duration overrides. They are schematic illustrations, not recordings or validated teaching videos.

- **Counting:** a visible lower → raise/bend → return cycle counts as a completed movement even if alignment needs adjustment. The separate `alignedReps` count requires all checks to pass. Timestamped practice tolerates tracking gaps up to 0.75 seconds and requires each endpoint to remain visible for at least 0.1 seconds. Longer gaps, pauses, and seeking invalidate incomplete cycles; no endpoint is inferred during a gap. Holds still credit only time when the selected shape checks pass. Historical records without `alignedReps` keep their original totals.
- **Combinations:** create, reorder, edit, and save sequences from the active collection, or copy one of eight bundled starter combinations. Finish each step and explicitly choose **Next step**; the final step offers **Finish combination**. Each step saves a session summary with the combination identity and step position. Saved definitions persist locally; active progress does not resume after reload.
- **Unavailable steps:** older combinations containing draft or unknown movements remain visible with their unavailable steps identified. Practice and saving edits are blocked until those steps are removed or replaced explicitly. Nothing is silently substituted. Historical session notes, attempt markers, and JSON exports remain readable.
- **Video:** 0.25×/0.5×/1× playback, 0.01-second scrubbing, and 0.1-second seek buttons remain available. Seek buttons are time offsets, not guaranteed frame stepping. Videos are not recorded or persisted. Historical teacher-review sessions keep their notes and manual markers.

`catalog/exercises/` owns definitions and bilingual instructions; `catalog/messages/` owns feedback wording; `catalog/assets/` owns illustration geometry and stages; `catalog/collections/` owns availability; `catalog/routines/` owns starter sequences. `src/catalog/` loads and validates these files. `src/analysis/` owns implemented capabilities, geometry, visibility gates, phases, and analyzer dispatch. Catalogue content can reference an existing analyzer but cannot create a new one.

Publication, content review, and analyzer validation are separate concepts. Published means offered by this pilot, not professionally approved. All content reviews remain pending, all automatic profiles are experimental, and no profile claims validation for Primary 1–3. The tests cover synthetic geometry, counting, catalogue constraints, migration compatibility, and browser workflows; representative recordings with the intended audience are still needed.

## Seated Posture Monitor

Open **http://127.0.0.1:5175/#posture**, or choose **Posture Monitor** in the studio navigation. Use **Movement Studio** in the monitor header to return. The monitor has its own dark navy interface and English/Traditional Chinese language switch. The language preference persists locally; camera references are intentionally captured anew for each setup.

1. Choose **Front**, **Side**, or **Diagonal** camera placement. For side and diagonal views, select whether the webcam is on **your left** or **your right**. Keep the camera upright; diagonal means a front-left or front-right view approximately 30–45° off center while you continue facing the screen.
2. Select your webcam, enable it, and check the upper-body framing. Front view needs the nose, both ears, and both shoulders. Side/diagonal views need the nose and the nearer ear and shoulder. Hips are optional and enable torso checks; wrists, legs, and feet are not required.
3. Choose **Calibrate & start** and hold a comfortable reference position steady for three seconds. Significant movement or tracking loss restarts calibration. Monitoring starts automatically after capture.
4. Use pause/resume, five-minute reminder snooze, and settings for reminder types, sensitivity, cooldown, voice, mirror, and optional skeleton tweening (on by default).
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

`src/analysis/` uses aspect-corrected 2D joint angles. Key body landmarks must have at least 0.6 visibility to acquire tracking and remain inside the frame. Overhead reaches and elbow bends retain tracking down to 0.5 visibility once acquired, avoiding repeated loss/reacquisition around the threshold. Pose holds accumulate only when all checks pass. Warm-ups require a lower → raise/bend → return sequence. Tracking gaps longer than 0.75 seconds, pauses, or seeking reset incomplete movement cycles; any loss or poor alignment still resets the separate quality-qualified repetition cycle. The child-facing coaching heading and spoken cue wait 350 ms before switching, independently of raw measurements. Return instructions persist through intermediate poses rather than asking the child to raise again while lowering. All exercise targets are heuristics for visible alignment, not validated clinical measurements. A single frontal camera cannot reliably measure rotation, depth, foot contact, pain, or individual range of motion.

`src/hooks/useSession.ts` manages framing, practice, pause, rest, review samples, repetition state, and session summaries. Source changes and navigation release camera tracks and revoke uploaded-video object URLs. Completed live sessions turn the camera off.

## Assets and privacy

- Model: the official [MediaPipe Pose Landmarker Lite](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task), bundled at `public/models/pose_landmarker_lite.task`.
- WASM files are copied from the pinned npm package into `public/wasm` by the `postinstall` script. If lifecycle scripts are disabled, run `node scripts/copy-wasm.mjs` before starting or building.
- No inference assets or fonts require a third-party request at runtime. The interface uses system fonts.
- Camera/video frames are processed in the browser and are not uploaded or recorded by the app. Uploaded files are referenced with local object URLs. Only session summaries are persisted.
- Spoken cues use the browser's speech-synthesis service; voice availability depends on the browser/OS.
- Illustrations and app icons are SVG. The photo in `tests/fixtures/pose.jpg` is the official [MediaPipe test image](https://storage.googleapis.com/mediapipe-assets/pose.jpg), used only for automated inference verification and not shipped in the app.

Implementation reference: [Google's Pose Landmarker web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js).

### Movement kiosk

Open **Kiosk / 互動站** from Movement Studio, or visit `http://localhost:5175/#kiosk`. The original teacher workspace and exercise library remain available through **Teacher studio / 老師工作室**. The kiosk is a separate interface sharing the catalogue, tracking, counting and local session history. It offers the five front-facing movements with automatic analysis; teacher-reviewed movements remain in the teacher workspace.

- A raised wrist controls a mirrored, smoothed cursor. Either hand works; lower the active hand before switching hands. Body-relative reach maps to the viewport, independently of the letterboxed camera image.
- Hold the cursor on a highlighted button for **1.4 seconds** to select. Leave the buttons or lower the hand for at least **0.3 seconds** before the next selection. The ring shows progress. Touch and keyboard controls remain available.
- Select a movement, watch the animated example, then choose **I’m ready / 準備好了**. Whole-body visibility starts the existing three-second preparation countdown.
- Menu pointing is disabled while exercising. Hold both hands crossed at the chest for **1.8 seconds** to pause. Lower the hands and point to **Resume / 繼續** to continue. The gesture uses pose wrists/shoulders, not finger or pinch recognition.
- Missing body tracking for **1.8 seconds**, or hiding the page, pauses practice. Earned counts remain. After **45 seconds** without a visible body the kiosk saves any activity and returns to movement selection. Completion offers another attempt or another movement; navigation does not start cameras in the teacher workspace.
- Large counts, earned stars and a completion celebration reflect the existing analysis. Optional synthesized chimes play once per newly earned repetition (or held second). The Sound control needs a teacher's touch/keyboard action to unlock browser audio. Motion demonstrations remain animated regardless of OS Reduce Motion; decorative celebrations respect it.
- **Camera view / 鏡頭全畫面** fills the browser viewport with the camera and overlays progress, the animated example and controls. It is the initial default on portrait screens at least 600 CSS pixels wide. The centre stays clear during practice; menus appear as readable overlay cards. **Split view / 分欄顯示** restores the original kiosk layout, and the choice is remembered locally. Switching views or rotating the tablet keeps the same camera stream and session. Both layouts preserve the full captured image with matching video/skeleton letterboxing; a landscape camera source may leave space above and below on a portrait display. Browser fullscreen is optional and requires a supported browser plus a touch/keyboard action; if unavailable, camera view still fills the webpage while browser toolbars remain visible.

Camera permission must be granted at installation/startup. The kiosk attempts to open the camera on entry but cannot grant browser permission or enable browser fullscreen/audio through camera gestures. Camera/model errors offer a reconnect control and expandable diagnostics. Streams and tracking are released when leaving the workspace.

Implementation lives in `src/kiosk/`: `input.ts` contains gesture and dwell logic; `useKioskInput.ts` connects the cursor to eligible buttons; `KioskStudio.tsx` provides the student flow. Gesture thresholds and body-relative cursor reach are initial prototype defaults, not validated with Primary 1–3 children. Test reach, lighting, accidental activations and recognition at the installed camera distance before unattended use. Automated kiosk tests supply deterministic camera landmarks to verify selection, pausing, counting and layout; they do not establish real-camera gesture accuracy.
