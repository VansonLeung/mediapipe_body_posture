import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('workspaces coexist, profiles and bilingual settings work on desktop and mobile', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Posture Monitor', exact: true })
    .click();
  await expect(page.locator('.pm-brand strong')).toContainText(
    'Posture Monitor',
  );
  await page.screenshot({
    path: 'test-results/posture-desktop.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Diagonal view 30–45°', exact: true })
    .click();
  await page.getByText('Your right', { exact: true }).click();
  await page.getByRole('button', { name: 'Setup guide', exact: true }).click();
  await expect(
    page.getByText(/Diagonal: place the camera at the front-left/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.pm-reading')).toHaveCount(3);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(
    page.getByRole('switch', { name: 'Smooth skeleton movement', exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole('switch', { name: 'Smooth skeleton movement', exact: true })
    .check();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByText('繁', { exact: true }).click();
  await expect(page.locator('.pm-brand strong')).toContainText('坐姿監測');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(
    page.getByText('斜前方視角至少等待 8 秒，以減少日常轉身或伸手時的提醒。'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'test-results/posture-mobile.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: '運動工作室', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Movement Studio' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Posture Monitor', exact: true })
    .click();
  await expect(page.locator('.pm-brand strong')).toContainText('坐姿監測');
  expect(errors).toEqual([]);
});

test('seated monitor gives a localized recoverable camera denial message', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('forma-posture-language', 'zh');
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () =>
        Promise.reject(new DOMException('Denied', 'NotAllowedError')),
    });
  });
  await page.goto('/#posture');
  await page.getByRole('button', { name: '開啟鏡頭', exact: true }).click();
  await expect(
    page.getByText('未獲鏡頭使用權限。請在瀏覽器允許使用鏡頭，然後重試。'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '開啟鏡頭', exact: true }),
  ).toBeEnabled();
});

test('real tracking calibrates, monitors, pauses and persists a separate summary', async ({
  page,
}) => {
  const reference = `data:image/jpeg;base64,${(await readFile('tests/fixtures/pose.jpg')).toString('base64')}`;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
          const stream = canvas.captureStream(10),
            track = stream.getVideoTracks()[0],
            stop = track.stop.bind(track);
          track.stop = () => {
            clearInterval(interval);
            stop();
          };
          Object.assign(window, { postureCameraTrack: track });
          return stream;
        },
      });
    },
    { reference },
  );
  await page.goto('/#posture');
  await page
    .getByRole('button', { name: 'Enable camera', exact: true })
    .click();
  await expect(
    page.getByText('Upper body in frame', { exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await page
    .getByRole('button', { name: 'Calibrate & start', exact: true })
    .click();
  await expect(page.locator('.pm-session-state')).toHaveText('Monitoring', {
    timeout: 20000,
  });
  await expect(
    page.locator('.pm-stat').first().locator('strong'),
  ).not.toHaveText('00:00', { timeout: 10000 });
  await page
    .getByRole('button', { name: 'Pause monitoring', exact: true })
    .click();
  const duration = await page
    .locator('.pm-stat')
    .first()
    .locator('strong')
    .innerText();
  await page.waitForTimeout(650);
  await expect(page.locator('.pm-stat').first().locator('strong')).toHaveText(
    duration,
  );
  await page
    .locator('.pm-video-overlay')
    .getByRole('button', { name: 'Resume monitoring', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Finish session', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Session summary' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { postureCameraTrack: MediaStreamTrack })
          .postureCameraTrack.readyState,
    ),
  ).toBe('ended');
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('forma-posture-sessions') ?? '[]')
          .length,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(() => localStorage.getItem('forma-sessions')),
  ).toBeNull();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  await page
    .locator('.pm-header')
    .getByRole('button', { name: 'Session history' })
    .click();
  await expect(page.locator('.pm-history-item')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('utility view fits desktop and both fullscreen modes have no outer gutters', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/#posture');
  await expect(
    page.locator('.pm-intro, .pm-footer, .pm-bottom-note'),
  ).toHaveCount(0);
  await expect(
    page.getByText('Make space for better habits.', { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page
    .getByRole('button', { name: 'Fullscreen app', exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.fullscreenElement?.classList.contains('pm-shell'),
      ),
    )
    .toBe(true);
  const appBounds = await page.locator('.pm-main').evaluate((el) => {
    const rect = el.getBoundingClientRect(),
      style = getComputedStyle(el);
    return {
      x: rect.x,
      width: rect.width,
      viewport: innerWidth,
      padding: style.padding,
    };
  });
  expect(appBounds.x).toBe(0);
  expect(appBounds.width).toBe(appBounds.viewport);
  expect(appBounds.padding).toBe('0px');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    await page
      .getByRole('dialog')
      .evaluate((el) => document.fullscreenElement?.contains(el)),
  ).toBe(true);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('.pm-reading').first().click();
  await expect(
    page.getByRole('dialog', { name: 'Head position', exact: true }),
  ).toBeVisible();
  expect(
    await page
      .getByRole('dialog', { name: 'Head position', exact: true })
      .evaluate((el) => document.fullscreenElement?.contains(el)),
  ).toBe(true);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page
    .getByRole('button', { name: 'Exit fullscreen', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
  await page
    .getByRole('button', { name: 'Expand camera preview', exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.fullscreenElement?.classList.contains('pm-camera'),
      ),
    )
    .toBe(true);
  const cameraBounds = await page.locator('.pm-video').evaluate((el) => {
    const rect = el.getBoundingClientRect(),
      camera = el.closest('.pm-camera')!;
    return {
      x: rect.x,
      width: rect.width,
      viewport: innerWidth,
      padding: getComputedStyle(camera).padding,
    };
  });
  expect(cameraBounds.x).toBe(0);
  expect(cameraBounds.width).toBe(cameraBounds.viewport);
  expect(cameraBounds.padding).toBe('0px');
  await page
    .getByRole('button', { name: 'Expand camera preview', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
});
