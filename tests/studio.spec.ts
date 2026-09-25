import { test, expect } from '@playwright/test';
test('compact studio fills fullscreen and keeps controls accessible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect(page.locator('.sidebar, .page-heading, footer')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page
    .getByRole('button', { name: 'Fullscreen app', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.className))
    .toBe('app-shell');
  expect(
    await page.locator('.main-content').evaluate((el) => ({
      x: el.getBoundingClientRect().x,
      width: el.getBoundingClientRect().width,
      padding: getComputedStyle(el).padding,
      viewport: innerWidth,
    })),
  ).toMatchObject({ x: 0, width: 1280, padding: '0px', viewport: 1280 });
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    await page
      .getByRole('dialog')
      .evaluate((el) => document.fullscreenElement?.contains(el)),
  ).toBe(true);
  await page
    .getByText('Gentle · 5° extra flexibility', { exact: true })
    .click();
  await expect(
    page.getByText('Relaxed · 10° extra flexibility', { exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Preferences', exact: true }),
  ).not.toBeVisible();
  await page.getByRole('button', { name: 'Pose guide', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    await page
      .getByRole('dialog')
      .evaluate((el) => document.fullscreenElement?.contains(el)),
  ).toBe(true);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page
    .getByRole('button', { name: 'Exit fullscreen', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Expand preview', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.className))
    .toBe('camera-panel');
  expect(
    await page
      .locator('.camera-panel')
      .evaluate((el) => getComputedStyle(el).padding),
  ).toBe('0px');
  expect(
    await page
      .locator('.video-stage')
      .evaluate((el) => el.getBoundingClientRect().x),
  ).toBe(0);
  expect(
    await page
      .locator('.video-stage')
      .evaluate((el) => el.getBoundingClientRect().width === innerWidth),
  ).toBe(true);
  await page
    .getByRole('button', { name: 'Expand preview', exact: true })
    .click();
});

test('studio, library, preferences, and responsive layout', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Movement Studio' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Start guided session' }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/studio-desktop.png',
    fullPage: true,
  });
  await page.getByRole('tab', { name: 'Open analysis' }).click();
  await expect(
    page.getByRole('button', { name: 'Start analysis' }),
  ).toBeVisible();
  await page.getByText('Upload video', { exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Choose a video' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Exercise library', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Exercise library' }),
  ).toBeVisible();
  await page.getByText('Warm-up', { exact: true }).first().click();
  await expect(
    page.getByRole('button', { name: 'Practice Arm raises' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Practice Warrior II' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Practice Arm raises' }).click();
  await expect(page.locator('.current-exercise h3')).toHaveText('Arm raises');
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await expect(
    page.getByText('Alignment flexibility', { exact: true }),
  ).toBeVisible();
  const tweening = page.getByRole('switch', {
    name: 'Smooth skeleton movement',
  });
  await expect(tweening).toBeChecked();
  await tweening.uncheck();
  await expect(tweening).not.toBeChecked();
  await tweening.check();
  await expect(tweening).toBeChecked();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'My progress', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'No sessions yet' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start practice' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'test-results/studio-mobile.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test('handles denied camera permission with a recoverable message', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () =>
        Promise.reject(
          new DOMException('Permission denied', 'NotAllowedError'),
        ),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Enable camera' }).click();
  await expect(page.getByText(/Camera access was denied/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Enable camera' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Start guided session' }).click();
  await expect(page.getByText(/Camera access was denied/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Start guided session' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Session summary' }),
  ).toHaveCount(0);
});
test('loads the real MediaPipe model and analyzes an uploaded video locally', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Open analysis' }).click();
  await page.getByText('Upload video', { exact: true }).click();
  const data = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    const done = new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });
    recorder.start();
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = '#c2cfb7';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#416849';
      ctx.fillRect(i * 10, 190, 60, 100);
      await new Promise((r) => setTimeout(r, 100));
    }
    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    return Array.from(new Uint8Array(await (await done).arrayBuffer()));
  });
  await page.getByLabel('Choose exercise video').setInputFiles({
    name: 'movement.webm',
    mimeType: 'video/webm',
    buffer: Buffer.from(data),
  });
  await expect(page.getByText('Tracking ready', { exact: true })).toBeVisible({
    timeout: 45000,
  });
  await page.getByRole('button', { name: 'Start analysis' }).click();
  await expect(
    page.getByRole('button', { name: 'Pause video', exact: true }),
  ).toBeVisible();
  await page.getByText('Teacher video feedback', { exact: true }).click();
  await expect(page.locator('.timeline-track button').first()).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator('.coaching-cue')).toContainText('Step back');
  await expect(page.locator('.session-time strong')).not.toHaveText('00:00', {
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Finish session' }).click();
  await expect(
    page.getByRole('heading', { name: 'Session summary' }),
  ).toBeVisible();
  await expect(
    page.getByText('No reliable pose was tracked.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: /My progress/ }).click();
  await expect(page.locator('.history-row')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: /My progress/ }).click();
  await expect(page.locator('.history-row')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('guided camera practice detects a real pose, pauses session time, and releases the camera', async ({
  page,
}) => {
  const { readFile } = await import('node:fs/promises');
  const reference = `data:image/jpeg;base64,${(await readFile('tests/fixtures/pose.jpg')).toString('base64')}`;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(
    ({ reference }) => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: async () => {
          const image = new Image();
          image.src = reference;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = 1000;
          canvas.height = 667;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(image, 0, 0);
          const interval = setInterval(() => ctx.drawImage(image, 0, 0), 100);
          const stream = canvas.captureStream(10);
          const track = stream.getVideoTracks()[0];
          const originalStop = track.stop.bind(track);
          track.stop = () => {
            clearInterval(interval);
            originalStop();
          };
          Object.assign(window, { testCameraTrack: track });
          return stream;
        },
      });
    },
    { reference },
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Start guided session' }).click();
  await expect(page.getByText('Body in frame', { exact: true })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator('.session-time strong')).not.toHaveText('00:00', {
    timeout: 15000,
  });
  await expect(page.locator('.countdown-overlay')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Pause session', exact: true })
    .click();
  await expect(
    page.getByText('Practice paused', { exact: true }),
  ).toBeVisible();
  const hold = await page.locator('.session-time strong').first().innerText();
  await page.waitForTimeout(600);
  await expect(page.locator('.session-time strong').first()).toHaveText(hold);
  await page
    .getByRole('button', { name: 'Resume practice', exact: true })
    .click();
  await page.getByRole('button', { name: 'Finish session' }).click();
  await expect(
    page.getByRole('heading', { name: 'Session summary' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { testCameraTrack: MediaStreamTrack })
          .testCameraTrack.readyState,
    ),
  ).toBe('ended');
  await expect(page.locator('.recap-metrics strong').nth(2)).toHaveText(/\d+%/);
  expect(errors).toEqual([]);
});
