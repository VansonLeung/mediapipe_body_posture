import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Exercise the real UI, tracker lifecycle and repetition analyser with a
// deterministic pose stream. This verifies commands, not model accuracy.
async function simulatedCamera(page: Page) {
  await page.route('**/*@mediapipe_tasks-vision*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `export const FilesetResolver = { forVisionTasks: async () => ({}) };
      export const PoseLandmarker = { createFromOptions: async () => ({
        detectForVideo: () => ({ landmarks: window.kioskTestPose?.length ? [window.kioskTestPose] : [] }), close() {}
      }) };`,
    }),
  );
  await page.addInitScript(() => {
    const p = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 1,
    }));
    for (const [i, x, y] of [
      [0, 0.5, 0.12],
      [11, 0.4, 0.3],
      [12, 0.6, 0.3],
      [13, 0.4, 0.45],
      [14, 0.6, 0.45],
      [15, 0.4, 0.65],
      [16, 0.6, 0.65],
      [23, 0.4, 0.6],
      [24, 0.6, 0.6],
      [25, 0.4, 0.75],
      [26, 0.6, 0.75],
      [27, 0.4, 0.9],
      [28, 0.6, 0.9],
    ])
      p[i] = { x, y, visibility: 1 };
    Object.assign(window, {
      kioskTestPose: p,
      kioskTestNeutral: structuredClone(p),
      kioskTestStreams: [],
    });
    Object.defineProperty(
      Object.getPrototypeOf(navigator.mediaDevices),
      'getUserMedia',
      {
        value: async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d')!;
          const draw = () => {
            ctx.fillStyle = '#315b50';
            ctx.fillRect(0, 0, 640, 480);
          };
          draw();
          const interval = setInterval(draw, 50),
            stream = canvas.captureStream(20);
          const track = stream.getVideoTracks()[0],
            stop = track.stop.bind(track);
          track.stop = () => {
            clearInterval(interval);
            stop();
          };
          (window as any).kioskTestStreams.push(stream);
          return stream;
        },
      },
    );
  });
}
async function neutral(page: Page) {
  await page.evaluate(() => {
    (window as any).kioskTestPose = structuredClone(
      (window as any).kioskTestNeutral,
    );
  });
  // Wait for the video frame to be processed before timing the lowered-hand
  // dwell release. WebKit can deliver that first frame later than Chromium.
  await expect(page.locator('.kiosk-cursor')).toHaveCount(0);
  await page.waitForTimeout(450);
}
async function pointAt(page: Page, action: string) {
  const button = page.locator(`[data-kiosk-action="${action}"]`);
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize()!;
  const x = (box!.x + box!.width / 2) / viewport.width,
    y = (box!.y + box!.height / 2) / viewport.height;
  await page.evaluate(
    ({ x, y }) => {
      const p = structuredClone((window as any).kioskTestNeutral);
      p[16] = { x: 0.5 - (x - 0.5) * 0.6, y: 0.09 + y * 0.465, visibility: 1 };
      (window as any).kioskTestPose = p;
    },
    { x, y },
  );
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 900, height: 1280 },
  { width: 390, height: 844 },
]) {
  test(`kiosk is separate and supports camera selection at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await simulatedCamera(page);
    await page.goto('/#kiosk');
    if (
      (await page.locator('.kiosk-shell').getAttribute('data-layout')) ===
      'camera'
    )
      await page
        .getByRole('button', { name: 'Split view', exact: true })
        .click();
    await expect(
      page.getByText('I can see you', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('.kiosk-choice h2')).toHaveText('Arm raises');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await pointAt(page, 'next');
    await expect(page.locator('.kiosk-choice h2')).toHaveText(
      'Standing side bends',
    );
    // Keeping the hand in place must not keep paging through movements.
    await page.waitForTimeout(1600);
    await expect(page.locator('.kiosk-choice h2')).toHaveText(
      'Standing side bends',
    );
    await neutral(page);
    await pointAt(page, 'choose');
    await expect(page.locator('.kiosk-shell')).toHaveAttribute(
      'data-view',
      'ready',
    );
    await neutral(page);
    await pointAt(page, 'language');
    await expect(
      page.getByRole('heading', { name: '動作互動站', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '準備好了 →', exact: true }),
    ).toBeInViewport();
    await neutral(page);
    await pointAt(page, 'start');
    await expect(page.locator('.kiosk-shell')).toHaveAttribute(
      'data-view',
      'practice',
    );
    await neutral(page);
    await expect(
      page.getByRole('button', { name: '暫停', exact: true }),
    ).toBeInViewport();
    const demo = await page
      .locator('.kiosk-panel .movement-demo')
      .boundingBox();
    const coaching = await page.locator('.kiosk-coaching').boundingBox();
    expect(demo!.y + demo!.height).toBeLessThanOrEqual(coaching!.y + 1);
    await page.screenshot({
      path: test.info().outputPath('kiosk-practice.png'),
    });
    await page.getByRole('button', { name: '老師工作室', exact: true }).click();
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.locator('.kiosk-shell')).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        (window as any).kioskTestStreams.every((s: MediaStream) =>
          s.getTracks().every((t) => t.readyState === 'ended'),
        ),
      ),
    ).toBe(true);
  });
}

test('camera-only start, counting, crossed-arms pause, resume, tracking loss and completion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await simulatedCamera(page);
  await page.goto('/#kiosk');
  await expect(page.getByText('I can see you', { exact: true })).toBeVisible();
  await pointAt(page, 'choose');
  await expect(page.locator('.kiosk-shell')).toHaveAttribute(
    'data-view',
    'ready',
  );
  await neutral(page);
  await pointAt(page, 'start');
  await expect(page.locator('.kiosk-shell')).toHaveAttribute(
    'data-view',
    'practice',
  );
  await neutral(page);
  await expect(page.locator('.kiosk-countdown')).toHaveCount(0, {
    timeout: 10000,
  });
  await expect(page.locator('.kiosk-cursor')).toHaveCount(0);
  await neutral(page);
  const rep = async () => {
    await page.evaluate(() => {
      const p = structuredClone((window as any).kioskTestNeutral);
      for (const [i, x] of [
        [13, 0.25],
        [14, 0.75],
        [15, 0.1],
        [16, 0.9],
      ])
        p[i] = { x, y: 0.3, visibility: 1 };
      (window as any).kioskTestPose = p;
    });
    await page.waitForTimeout(400);
    await neutral(page);
  };
  await rep();
  await expect(page.getByRole('status', { name: 'Progress' })).toContainText(
    '1 / 4',
  );
  await page.evaluate(() => {
    const p = structuredClone((window as any).kioskTestNeutral);
    p[15] = { x: 0.6, y: 0.37, visibility: 1 };
    p[16] = { x: 0.4, y: 0.37, visibility: 1 };
    (window as any).kioskTestPose = p;
  });
  await expect(page.locator('.kiosk-shell')).toHaveAttribute(
    'data-view',
    'paused',
  );
  await neutral(page);
  await pointAt(page, 'resume');
  await expect(page.locator('.kiosk-shell')).toHaveAttribute(
    'data-view',
    'practice',
  );
  await neutral(page);
  await page.evaluate(() => {
    (window as any).kioskTestPose = [];
  });
  await expect(page.locator('.kiosk-shell')).toHaveAttribute(
    'data-view',
    'paused',
  );
  await expect(page.locator('.kiosk-result')).toHaveText('1 / 4');
  await neutral(page);
  await pointAt(page, 'resume');
  await expect(page.locator('.kiosk-shell')).toHaveAttribute(
    'data-view',
    'practice',
  );
  await neutral(page);
  for (let i = 0; i < 3; i++) await rep();
  await expect(
    page.getByRole('heading', { name: 'You did it!', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.kiosk-result')).toContainText('4 / 4');
  await neutral(page);
  await pointAt(page, 'another');
  await expect(page.locator('.kiosk-shell')).toHaveAttribute(
    'data-view',
    'choose',
  );
  const history = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('forma-sessions')!),
  );
  expect(history[0]).toMatchObject({
    exercise: 'arms',
    reps: 4,
    source: 'camera',
  });
});

for (const viewport of [
  { width: 768, height: 1024 },
  { width: 800, height: 1280 },
  { width: 1024, height: 1366 },
]) {
  test(`tablet camera view keeps overlays usable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await simulatedCamera(page);
    await page.goto('/#kiosk');
    const shell = page.locator('.kiosk-shell');
    await expect(shell).toHaveAttribute('data-layout', 'camera');
    await expect(
      page.getByText('I can see you', { exact: true }),
    ).toBeVisible();
    const preview = await page.locator('.kiosk-camera').boundingBox();
    expect(preview).toMatchObject({
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });
    await expect(page.locator('.kiosk-video')).toHaveCSS(
      'object-fit',
      'contain',
    );
    await expect(page.locator('.kiosk-skeleton')).toHaveCSS(
      'object-fit',
      'contain',
    );
    await pointAt(page, 'choose');
    await expect(shell).toHaveAttribute('data-view', 'ready');
    await neutral(page);
    await pointAt(page, 'start');
    await expect(shell).toHaveAttribute('data-view', 'practice');
    await neutral(page);
    await expect(page.locator('.kiosk-countdown')).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(
      page.getByRole('button', { name: 'Pause', exact: true }),
    ).toBeInViewport({ ratio: 1 });
    const score = await page.locator('.kiosk-score').boundingBox();
    const demo = await page.locator('.movement-demo').boundingBox();
    expect(score!.x + score!.width).toBeLessThan(viewport.width / 2);
    expect(demo!.x).toBeGreaterThan(viewport.width / 2);
    // The centre remains the camera, rather than a transparent input-blocking panel.
    expect(
      await page.evaluate(() =>
        document
          .elementFromPoint(innerWidth / 2, innerHeight / 2)
          ?.classList.contains('kiosk-video'),
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath('tablet-camera-view.png'),
    });
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await neutral(page);
    await pointAt(page, 'resume');
    await expect(shell).toHaveAttribute('data-view', 'practice');
    await page.getByRole('button', { name: 'Split view', exact: true }).click();
    await expect(shell).toHaveAttribute('data-layout', 'split');
    await page
      .getByRole('button', { name: 'Camera view', exact: true })
      .click();
    // Rotation changes the layout without replacing the video or losing practice.
    await page.setViewportSize({
      width: viewport.height,
      height: viewport.width,
    });
    await expect(shell).toHaveAttribute('data-view', 'practice');
    await expect(
      page.getByRole('button', { name: 'Pause', exact: true }),
    ).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(
        () =>
          (window as any).kioskTestStreams.filter((s: MediaStream) =>
            s.getVideoTracks().some((t) => t.readyState === 'live'),
          ).length,
      ),
    ).toBe(1);
  });
}

test('camera denial is recoverable and the original workspace remains available', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(
      Object.getPrototypeOf(navigator.mediaDevices),
      'getUserMedia',
      {
        value: async () => {
          throw new DOMException('Denied', 'NotAllowedError');
        },
      },
    ),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Kiosk', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Camera needs help');
  await expect(
    page.getByRole('button', { name: 'Reconnect camera', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Teacher studio', exact: true })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Choose exercise' }),
  ).toBeVisible();
});
