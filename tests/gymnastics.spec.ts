import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
async function blankCamera(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d')!;
        const paint = () => {
          ctx.fillStyle = '#eee';
          ctx.fillRect(0, 0, 640, 480);
        };
        paint();
        const interval = setInterval(paint, 100),
          stream = canvas.captureStream(10);
        const track = stream.getVideoTracks()[0],
          stop = track.stop.bind(track);
        track.stop = () => {
          clearInterval(interval);
          stop();
        };
        return stream;
      },
    });
  });
}

test('pilot catalogue is bilingual and combination editing persists only offered movements', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.collection-label')).toHaveText(
    'Primary 1–3 · Standing movements',
  );
  await page.getByRole('combobox', { name: 'Choose exercise' }).fill('Bridge');
  await expect(
    page.getByTitle('Bridge / backbend · Teacher review', { exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Exercise library', exact: true })
    .click();
  await expect(page.locator('.library-card')).toHaveCount(17);
  await expect(
    page
      .locator('.library-card')
      .filter({ hasText: /Bridge|Arch|Plank|Jump|Warrior|Tree/ }),
  ).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Language / 語言' }).click();
  await page.getByTitle('繁中', { exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '站立平衡', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '動作工作室' })).toBeVisible();
  await page.getByRole('button', { name: '動作組合', exact: true }).click();
  await page.getByRole('textbox', { name: '組合名稱' }).fill('伸展與平衡');
  await page.getByRole('button', { name: '加入步驟', exact: true }).click();
  await page.getByRole('spinbutton', { name: '步驟目標 1' }).fill('3');
  await page.getByRole('combobox', { name: '加入動作' }).fill('手臂平舉');
  await page.getByTitle('手臂平舉', { exact: true }).click();
  await page.getByRole('button', { name: '加入步驟', exact: true }).click();
  await page.getByRole('button', { name: '上移步驟 2', exact: true }).click();
  await page.getByRole('button', { name: '儲存組合', exact: true }).click();
  await expect(page.locator('.routine-list')).toContainText(
    '手臂平舉 → 站立平衡',
  );
  await page.reload();
  await page.getByRole('button', { name: '動作組合', exact: true }).click();
  await expect(page.locator('.routine-list')).toContainText('伸展與平衡');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('forma-routines-v1')!)[0].steps,
    ),
  ).toEqual([
    { exercise: 'arms', target: 4 },
    { exercise: 'standing-balance', target: 3 },
  ]);
  expect(errors).toEqual([]);
});

test('new movements offer bilingual demonstrations and selectable automatic targets', async ({
  page,
}) => {
  await page.goto('/');
  for (const name of ['Overhead reaches', 'Elbow bends']) {
    await page.getByRole('combobox', { name: 'Choose exercise' }).fill(name);
    await page.getByTitle(`${name} · 4 slow reps`, { exact: true }).click();
    await expect(page.locator('.current-exercise h3')).toHaveText(name);
    await expect(page.locator('.practice-metrics')).toContainText('/ 4');
    const initial = await page.locator('.movement-demo svg').innerHTML();
    await page
      .getByRole('button', { name: 'Next picture', exact: true })
      .click();
    expect(await page.locator('.movement-demo svg').innerHTML()).not.toBe(
      initial,
    );
  }
  await page.getByRole('combobox', { name: 'Language / 語言' }).click();
  await page.getByTitle('繁中', { exact: true }).click();
  await expect(page.locator('.current-exercise h3')).toHaveText('屈伸手肘');
  await expect(
    page.getByRole('button', { name: '下一張', exact: true }),
  ).toBeVisible();
});

test('requested morning movements have illustrated teacher review and reusable combinations', async ({
  page,
}) => {
  await page.goto('/');
  for (const [name, camera] of [
    ['Marching in place', 'front'],
    ['High knee lifts', 'side'],
    ['Shoulder circles', 'side'],
    ['Clasped-hands overhead stretch', 'front'],
    ['Clasped-hands forward stretch', 'side'],
    ['Standing cat–cow', 'side'],
    ['Hand-on-hip side stretch', 'front'],
    ['Gentle standing twists', 'front'],
    ['Hands-on-hips hip circles', 'front'],
    ['Hands-on-hips side knee lifts', 'front'],
  ]) {
    await page.getByRole('combobox', { name: 'Choose exercise' }).fill(name);
    await page.getByTitle(`${name} · Teacher review`, { exact: true }).click();
    await expect(page.locator('.current-exercise h3')).toHaveText(name);
    await expect(page.locator('.camera-guidance')).toHaveText(
      `Camera: ${camera} view`,
    );
    await expect(
      page.getByRole('button', { name: 'Start review', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.practice-metrics')).toHaveCount(0);
    const initial = await page.locator('.movement-demo svg').innerHTML();
    await page
      .getByRole('button', { name: 'Next picture', exact: true })
      .click();
    expect(await page.locator('.movement-demo svg').innerHTML()).not.toBe(
      initial,
    );
  }
  await page.getByRole('combobox', { name: 'Language / 語言' }).click();
  await page.getByTitle('繁中', { exact: true }).click();
  await expect(page.locator('.current-exercise h3')).toHaveText('叉腰側提膝');
  await expect(page.locator('.movement-demo')).toContainText('膝蓋向外側');
  await page.getByRole('button', { name: '動作組合', exact: true }).click();
  await page
    .locator('.routine-templates article')
    .filter({ hasText: '晨間動作組合' })
    .getByRole('button', { name: '以此建立組合', exact: true })
    .click();
  await page.getByRole('button', { name: '儲存組合', exact: true }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('forma-routines-v1')!),
  );
  expect(saved[0].steps.map((s: { exercise: string }) => s.exercise)).toEqual([
    'march-in-place',
    'high-knees',
    'shoulder-circles',
    'clasped-overhead-stretch',
    'clasped-forward-stretch',
    'standing-cat-cow',
    'hand-on-hip-side-stretch',
    'standing-twists',
  ]);
});

test('step-and-lift starter supports demonstrations and manual attempts before automatic balance', async ({
  page,
}) => {
  await blankCamera(page);
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Movement combinations', exact: true })
    .click();
  await page
    .locator('.routine-templates article')
    .filter({ hasText: 'Step and lift' })
    .getByRole('button', { name: 'Use as a starting point', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save combination', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Practice combination', exact: true })
    .click();
  for (const name of ['Side step', 'Alternating knee lifts']) {
    await expect(page.locator('.current-exercise h3')).toHaveText(name);
    await expect(page.locator('.practice-metrics')).toHaveCount(0);
    const initial = await page.locator('.movement-demo svg').innerHTML();
    await page
      .getByRole('button', { name: 'Next picture', exact: true })
      .click();
    expect(await page.locator('.movement-demo svg').innerHTML()).not.toBe(
      initial,
    );
    await page
      .getByRole('button', { name: 'Start review', exact: true })
      .click();
    await expect(
      page.getByRole('textbox', { name: 'Attempt note', exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    await page
      .getByRole('textbox', { name: 'Attempt note', exact: true })
      .fill(`${name} completed`);
    await page.getByRole('button', { name: /^Mark attempt/ }).click();
    await page
      .getByRole('textbox', { name: 'Session notes', exact: true })
      .fill('Following teacher pace');
    await page
      .getByRole('button', { name: 'Finish session', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toContainText(
      'Teacher review — no automatic technique score.',
    );
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Next step', exact: true })
      .click();
  }
  await expect(page.locator('.current-exercise h3')).toHaveText(
    'Standing balance',
  );
  await expect(page.locator('.practice-metrics')).toContainText('/ 5s');
  const records = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('forma-sessions')!),
  );
  expect(records.map((r: { exercise: string }) => r.exercise)).toEqual([
    'knee-lifts',
    'side-step',
  ]);
  for (const record of records) {
    expect(record).toMatchObject({
      assessment: 'review',
      score: null,
      reps: 0,
      hold: 0,
      notes: 'Following teacher pace',
    });
    expect(record.attempts).toHaveLength(1);
    expect(record.attempts[0].note).toContain('completed');
  }
});

test('unavailable combinations remain visible and must be edited before practice', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('forma-routines-v1'))
      localStorage.setItem(
        'forma-routines-v1',
        JSON.stringify([
          {
            id: 'old',
            name: 'Older routine',
            steps: [
              { exercise: 'arms', target: 4 },
              { exercise: 'bridge', target: 0 },
              { exercise: 'withdrawn-id', target: 2 },
            ],
          },
        ]),
      );
  });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Movement combinations', exact: true })
    .click();
  await expect(page.locator('.routine-list')).toContainText(
    '2. Bridge / backbend',
  );
  await expect(page.locator('.routine-list')).toContainText('3. withdrawn-id');
  await expect(
    page.getByRole('button', { name: 'Practice combination', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Save combination', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Remove step 3', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Remove step 2', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save combination', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Practice combination', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Practice combination', exact: true })
    .click();
  await expect(page.locator('.current-exercise h3')).toHaveText('Arm raises');
});

test('historical draft movements retain notes and exports without reentering the practice selector', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'forma-sessions',
      JSON.stringify([
        {
          id: 'old-review',
          date: '2026-09-24T10:00:00Z',
          exercise: 'arch',
          source: 'video',
          duration: 12,
          hold: 0,
          reps: 0,
          score: null,
          cues: [],
          assessment: 'review',
          notes: 'Teacher observations',
          attempts: [{ time: 2.5, note: 'First attempt' }],
        },
      ]),
    ),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'My progress', exact: true }).click();
  await expect(page.locator('.history-row')).toContainText('Arch position');
  await page.locator('.history-row').click();
  await expect(
    page.getByText('Teacher observations', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/First attempt/)).toBeVisible();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download session summary', exact: true })
    .click();
  const { readFile } = await import('node:fs/promises');
  const record = JSON.parse(
    await readFile((await (await download).path())!, 'utf8'),
  );
  expect(record.exercise).toBe('arch');
  expect(record.attempts[0].time).toBe(2.5);
  await page
    .getByRole('button', { name: 'Next exercise', exact: true })
    .click();
  await expect(page.locator('.current-exercise h3')).toHaveText(
    'Standing side bends',
  );
});

test('pilot combination advances on confirmation and completes after the last step', async ({
  page,
}) => {
  await blankCamera(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      'forma-routines-v1',
      JSON.stringify([
        {
          id: 'pilot',
          name: 'Reach and stand',
          steps: [
            { exercise: 'arms', target: 4 },
            { exercise: 'standing-balance', target: 3 },
          ],
        },
      ]),
    ),
  );
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Movement combinations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Practice combination', exact: true })
    .click();
  await expect(page.locator('.routine-progress')).toContainText('Step 1 / 2');
  await page.getByRole('tab', { name: 'Open analysis' }).click();
  await page
    .getByRole('button', { name: 'Start analysis', exact: true })
    .click();
  await expect(page.locator('.session-time strong')).not.toHaveText('00:00', {
    timeout: 45000,
  });
  await page
    .getByRole('button', { name: 'Finish session', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Next step', exact: true })
    .click();
  await expect(page.locator('.routine-progress')).toContainText('Step 2 / 2');
  await expect(page.locator('.practice-metrics')).toContainText('/ 3s');
  await page
    .getByRole('button', { name: 'Start analysis', exact: true })
    .click();
  await expect(page.locator('.session-time strong')).not.toHaveText('00:00', {
    timeout: 45000,
  });
  await page
    .getByRole('button', { name: 'Finish session', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Finish combination', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Movement combinations', exact: true }),
  ).toBeVisible();
  const records = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('forma-sessions')!),
  );
  expect(
    records.map((r: { routine: { step: number } }) => r.routine.step),
  ).toEqual([2, 1]);
});

test('demonstrations and simple progress come first, with measurements available to the teacher', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.current-exercise h3')).toHaveText('Arm raises');
  await expect(
    page.locator('.teacher-measurements .alignment-list'),
  ).not.toBeVisible();
  await expect(page.locator('.practice-metrics')).toContainText(
    'Movements completed',
  );
  const initial = await page.locator('.movement-demo svg').innerHTML();
  await page.getByRole('button', { name: 'Next picture', exact: true }).click();
  expect(await page.locator('.movement-demo svg').innerHTML()).not.toBe(
    initial,
  );
  await expect(page.locator('.movement-demo')).toContainText(
    'Slowly lift both arms',
  );
  await page.getByText('Teacher measurements', { exact: true }).click();
  await expect(
    page.locator('.teacher-measurements .alignment-list'),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('uploaded practice supports slow playback, precise seeking and JSON export', async ({
  page,
}) => {
  await page.goto('/');
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
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
      ctx.fillStyle = i % 2 ? '#eeeeee' : '#dddddd';
      ctx.fillRect(0, 0, 320, 240);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    return Array.from(new Uint8Array(await (await done).arrayBuffer()));
  });
  await page.getByRole('tab', { name: 'Open analysis' }).click();
  await page
    .getByLabel('Choose exercise video', { exact: true })
    .setInputFiles({
      name: 'bridge.webm',
      mimeType: 'video/webm',
      buffer: Buffer.from(bytes),
    });
  await expect(page.getByText('Tracking ready', { exact: true })).toBeVisible({
    timeout: 45000,
  });
  await page
    .getByRole('button', { name: 'Start analysis', exact: true })
    .click();
  await page.getByRole('button', { name: 'Pause video', exact: true }).click();
  await page.getByRole('combobox', { name: 'Playback speed' }).click();
  await page.getByTitle('0.5×', { exact: true }).click();
  expect(await page.locator('video').evaluate((v) => v.playbackRate)).toBe(0.5);
  await page
    .getByRole('button', { name: 'Forward 0.1 seconds', exact: true })
    .click();
  expect(
    await page.locator('video').evaluate((v) => v.currentTime),
  ).toBeGreaterThanOrEqual(0.09);
  await expect(page.locator('.timeline-key')).not.toBeVisible();
  await page
    .getByRole('button', { name: 'Finish session', exact: true })
    .click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download session summary', exact: true })
    .click();
  const path = await (await download).path();
  const { readFile } = await import('node:fs/promises');
  const summary = JSON.parse(await readFile(path!, 'utf8'));
  expect(summary).toMatchObject({
    exercise: 'arms',
    source: 'video',
    score: null,
    hold: 0,
    reps: 0,
  });
  expect(summary.alignedReps).toBe(0);
});
