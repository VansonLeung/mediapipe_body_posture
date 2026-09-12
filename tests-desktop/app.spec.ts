import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('desktop bundle loads both workspaces, tracks a video, persists data and fills native fullscreen', async () => {
  const userData = await mkdtemp(join(tmpdir(), 'forma-desktop-'));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    ...(process.env.FORMA_TEST_EXECUTABLE
      ? { executablePath: process.env.FORMA_TEST_EXECUTABLE }
      : {}),
    args: [
      ...(process.env.FORMA_TEST_EXECUTABLE ? [] : [resolve('.')]),
      `--user-data-dir=${userData}`,
      '--use-fake-device-for-media-stream',
    ],
    env,
  });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await expect(
      page.getByRole('heading', { name: 'Movement Studio', exact: true }),
    ).toBeVisible();
    expect(page.url()).toBe('forma://app/');
    expect(
      await page.evaluate(() => ({
        secure: isSecureContext,
        cameraAPI: typeof navigator.mediaDevices?.getUserMedia,
        node: typeof (window as unknown as { require?: unknown }).require,
      })),
    ).toEqual({ secure: true, cameraAPI: 'function', node: 'undefined' });
    expect(
      await app.evaluate(({ BrowserWindow }) => {
        const prefs =
          BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
        return {
          sandbox: prefs.sandbox,
          node: prefs.nodeIntegration,
          isolation: prefs.contextIsolation,
        };
      }),
    ).toEqual({ sandbox: true, node: false, isolation: true });
    expect(
      await page.evaluate(async () => (await fetch('/../package.json')).status),
    ).toBe(404);

    await page
      .getByRole('button', { name: 'Fullscreen app', exact: true })
      .click();
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isFullScreen(),
        ),
      )
      .toBe(true);
    await expect(page.locator('html')).toHaveClass(/desktop-fullscreen/);
    expect(
      await page
        .locator('.main-content')
        .evaluate((el) => getComputedStyle(el).padding),
    ).toBe('0px');
    await page
      .getByRole('button', { name: 'Preferences', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page
      .getByRole('button', { name: 'Posture Monitor', exact: true })
      .click();
    await expect(page.locator('.pm-brand')).toContainText('Posture Monitor');
    await expect(
      page.getByRole('button', { name: 'Exit fullscreen', exact: true }),
    ).toBeVisible();
    expect(
      await page
        .locator('.pm-main')
        .evaluate((el) => getComputedStyle(el).padding),
    ).toBe('0px');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page
      .getByRole('button', { name: 'Exit fullscreen', exact: true })
      .click();
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isFullScreen(),
        ),
      )
      .toBe(false);
    await page
      .getByRole('button', { name: 'Movement Studio', exact: true })
      .click();

    // Exercise Chromium's actual camera permission path using synthetic hardware.
    // OS consent is stubbed only in this test, so it never opens a personal webcam.
    await app.evaluate(({ systemPreferences }) => {
      systemPreferences.askForMediaAccess = async () => true;
    });
    await page
      .getByRole('button', { name: 'Enable camera', exact: true })
      .click();
    await expect(page.getByText('Tracking ready', { exact: true })).toBeVisible(
      { timeout: 45000 },
    );
    const track = await page
      .locator('video')
      .evaluateHandle(
        (video) => (video.srcObject as MediaStream).getVideoTracks()[0],
      );
    expect(await track.evaluate((track) => track.readyState)).toBe('live');
    await page.getByRole('button', { name: 'Camera off', exact: true }).click();
    expect(await track.evaluate((track) => track.readyState)).toBe('ended');
    await track.dispose();
    expect(
      await page.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          stream.getTracks().forEach((track) => track.stop());
          return 'allowed';
        } catch (error) {
          return (error as DOMException).name;
        }
      }),
    ).toBe('NotAllowedError');

    // Record a real pose into a local video: exercises MediaPipe, WASM, blob playback and CSP together.
    const reference = `data:image/jpeg;base64,${(await readFile('tests/fixtures/pose.jpg')).toString('base64')}`;
    const video = await page.evaluate(async (reference) => {
      const image = new Image();
      image.src = reference;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 667;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const stream = canvas.captureStream(10);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];
      const done = new Promise<Blob>((resolve) => {
        recorder.ondataavailable = (event) => chunks.push(event.data);
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: 'video/webm' }));
      });
      recorder.start();
      const interval = setInterval(() => ctx.drawImage(image, 0, 0), 100);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      recorder.stop();
      clearInterval(interval);
      stream.getTracks().forEach((track) => track.stop());
      return Array.from(new Uint8Array(await (await done).arrayBuffer()));
    }, reference);
    await page.getByRole('tab', { name: 'Open analysis', exact: true }).click();
    await page.getByText('Upload video', { exact: true }).click();
    await page.getByLabel('Choose exercise video').setInputFiles({
      name: 'pose.webm',
      mimeType: 'video/webm',
      buffer: Buffer.from(video),
    });
    await expect(page.getByText('Tracking ready', { exact: true })).toBeVisible(
      { timeout: 45000 },
    );
    await page
      .getByRole('button', { name: 'Start analysis', exact: true })
      .click();
    await expect(
      page.getByText('Body in frame', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('.timeline-track button').first()).toBeVisible();
    await expect(page.locator('.session-time strong')).not.toHaveText('00:00');
    await page
      .getByRole('button', { name: 'Finish session', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Session summary', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.recap-metrics strong').nth(2)).toHaveText(
      '100%',
    );
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.reload();
    await page
      .getByRole('button', { name: 'My progress', exact: true })
      .click();
    await expect(page.locator('.history-row')).toHaveCount(1);
    expect(errors).toEqual([]);
    await page.screenshot({ path: 'test-results/electron-desktop.png' });
  } finally {
    await app.close();
    await rm(userData, { recursive: true, force: true });
  }
});
