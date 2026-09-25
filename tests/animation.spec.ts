import { test, expect } from '@playwright/test';

test('stickman animates between poses, pauses exactly, and resets on exercise change', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/');
  const picture = page.locator('.movement-demo svg');
  const first = await picture.innerHTML();
  await page.getByRole('button', { name: 'Next picture', exact: true }).click();
  const second = await picture.innerHTML();
  await page.getByRole('button', { name: 'Next picture', exact: true }).click();
  await page.getByRole('button', { name: 'Next picture', exact: true }).click();
  await page
    .getByRole('button', { name: 'Play demonstration', exact: true })
    .click();
  await page.clock.runFor(1100);
  const middle = await picture.innerHTML();
  expect(middle).not.toBe(first);
  expect(middle).not.toBe(second);
  await page
    .getByRole('button', { name: 'Pause demonstration', exact: true })
    .click();
  const paused = await picture.innerHTML();
  await page.clock.runFor(2000);
  expect(await picture.innerHTML()).toBe(paused);
  await page
    .getByRole('button', { name: 'Play demonstration', exact: true })
    .click();
  await page.clock.runFor(250);
  expect(await picture.innerHTML()).not.toBe(paused);
  await page.getByRole('button', { name: 'Next picture', exact: true }).click();
  expect(await picture.innerHTML()).toBe(second);

  await page
    .getByRole('combobox', { name: 'Choose exercise' })
    .fill('High knee lifts');
  await page
    .getByTitle('High knee lifts · Teacher review', { exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Play demonstration', exact: true }),
  ).toBeVisible();
  const manual = await picture.innerHTML();
  await page
    .getByRole('button', { name: 'Play demonstration', exact: true })
    .click();
  await page.clock.runFor(1000);
  expect(await picture.innerHTML()).not.toBe(manual);
  await page.getByRole('combobox', { name: 'Language / 語言' }).click();
  await page.getByTitle('繁中', { exact: true }).click();
  await expect(
    page.getByRole('button', { name: '暫停示範', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.movement-demo')).toContainText('提起一邊膝蓋');
});

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`demonstration interpolates with a real clock (${reducedMotion})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    const picture = page.locator('.movement-demo svg');
    const poses: string[] = [];
    // The initial exercise has three catalogue pictures. A smooth animation
    // must pass through another pose, not merely advance to the next picture.
    for (let frame = 0; frame < 3; frame++) {
      poses.push(await picture.innerHTML());
      await page
        .getByRole('button', { name: 'Next picture', exact: true })
        .click();
    }
    await page
      .getByRole('button', { name: 'Play demonstration', exact: true })
      .click();
    await expect
      .poll(async () => poses.includes(await picture.innerHTML()))
      .toBe(false);
    await page
      .getByRole('button', { name: 'Pause demonstration', exact: true })
      .click();
    const paused = await picture.innerHTML();
    await page.waitForTimeout(300);
    expect(await picture.innerHTML()).toBe(paused);
    await page
      .getByRole('button', { name: 'Next picture', exact: true })
      .click();
    expect(poses).toContain(await picture.innerHTML());
  });
}

for (const width of [1280, 390]) {
  test(`library demonstrations autoplay at ${width}px with reduced motion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page
      .getByRole('button', { name: 'Exercise library', exact: true })
      .click();
    await expect(
      page
        .locator('.library-card')
        .getByRole('button', { name: 'Pause demonstration', exact: true }),
    ).toHaveCount(16);
    const card = page.locator('.library-card').filter({
      has: page.getByRole('heading', { name: /^(Arm raises|手臂平舉)$/ }),
    });
    const picture = card.locator('.movement-demo svg');
    const initial = await picture.innerHTML();
    await expect.poll(async () => await picture.innerHTML()).not.toBe(initial);
    await card
      .getByRole('button', { name: 'Pause demonstration', exact: true })
      .click();
    const paused = await picture.innerHTML();
    await page.waitForTimeout(300);
    expect(await picture.innerHTML()).toBe(paused);
    await card
      .getByRole('button', { name: 'Next picture', exact: true })
      .click();
    expect(await picture.innerHTML()).not.toBe(paused);
    await page.getByRole('combobox', { name: 'Language / 語言' }).click();
    await page.getByTitle('繁中', { exact: true }).click();
    await card.getByRole('button', { name: '播放示範', exact: true }).click();
    await expect(
      card.getByRole('button', { name: '暫停示範', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.library-card')).toHaveCount(17);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await card
      .getByRole('button', { name: '練習 手臂平舉', exact: true })
      .click();
    await expect(page.locator('.current-exercise h3')).toHaveText('手臂平舉');
    await expect(
      page
        .locator('.movement-demo')
        .getByRole('button', { name: '播放示範', exact: true }),
    ).toBeVisible();
  });
}
