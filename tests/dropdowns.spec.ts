import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

async function expectExposedOptions(
  page: Page,
  picker: Locator,
  count: number,
) {
  const listId = await picker.getAttribute('aria-controls');
  const menu = page
    .locator('.studio-dropdown-layer .ant-select-dropdown')
    .filter({ has: page.locator(`[id="${listId}"]`) });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS('opacity', '1');
  const options = menu.locator('.ant-select-item-option');
  await expect(options).toHaveCount(count);
  // Bounding boxes alone do not detect an item covered by a canvas or panel.
  await expect
    .poll(() =>
      options.evaluateAll((items) =>
        items.every((item) => {
          const box = item.getBoundingClientRect();
          return [box.left + 6, box.right - 6].every((x) =>
            item.contains(
              document.elementFromPoint(x, box.top + box.height / 2),
            ),
          );
        }),
      ),
    )
    .toBe(true);
}

for (const width of [1280, 390]) {
  test(`menus stay exposed and selectable at ${width}px and in fullscreen`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    for (const fullscreen of [false, true]) {
      if (fullscreen) {
        await page
          .getByRole('button', { name: 'Fullscreen app', exact: true })
          .click();
        await expect
          .poll(() =>
            page.evaluate(() => document.fullscreenElement?.className),
          )
          .toBe('app-shell');
      }
      const language = page.getByRole('combobox', {
        name: 'Language / 語言',
      });
      await language.click();
      await expectExposedOptions(
        page,
        page.getByRole('combobox', { name: 'Language / 語言' }),
        2,
      );
      await page.getByTitle('繁中', { exact: true }).click();
      await expect(
        page.getByRole('heading', { name: '動作工作室' }),
      ).toBeVisible();
      if (fullscreen)
        expect(
          await page.evaluate(() => document.fullscreenElement?.className),
        ).toBe('app-shell');
      await language.click();
      await page
        .locator('.studio-dropdown-layer')
        .getByTitle('EN', { exact: true })
        .click();

      const exercise = page.getByRole('combobox', {
        name: 'Choose exercise',
      });
      await exercise.click();
      // The expanded collection exceeds the popup height. Reach its last item
      // by scrolling the menu, including on narrow screens and in fullscreen.
      const listId = await exercise.getAttribute('aria-controls');
      const movementMenu = page
        .locator('.studio-dropdown-layer .ant-select-dropdown')
        .filter({ has: page.locator(`[id="${listId}"]`) });
      await expect(movementMenu).toHaveCSS('opacity', '1');
      await movementMenu.hover();
      await page.mouse.wheel(0, 900);
      await page
        .getByTitle('Hands-on-hips side knee lifts · Teacher review', {
          exact: true,
        })
        .click();
      await expect(page.locator('.current-exercise h3')).toHaveText(
        'Hands-on-hips side knee lifts',
      );
      await exercise.fill('Side step');
      await expectExposedOptions(page, exercise, 1);
      await page
        .getByTitle('Side step · Teacher review', { exact: true })
        .click();
      await expect(page.locator('.current-exercise h3')).toHaveText(
        'Side step',
      );
      await exercise.fill('Overhead reaches');
      await expectExposedOptions(page, exercise, 1);
      await page
        .getByTitle('Overhead reaches · 4 slow reps', { exact: true })
        .click();
      await expect(page.locator('.current-exercise h3')).toHaveText(
        'Overhead reaches',
      );
      // The empty overlay must not intercept the rest of the application.
      await page
        .getByRole('button', { name: 'Pose guide', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
    await page
      .getByRole('button', { name: 'Exit fullscreen', exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement))
      .toBe(null);
    await page.getByRole('combobox', { name: 'Language / 語言' }).click();
    await expectExposedOptions(
      page,
      page.getByRole('combobox', { name: 'Language / 語言' }),
      2,
    );
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: 'Posture Monitor', exact: true })
      .click();
    await expect(page.locator('.studio-dropdown-layer')).toHaveCount(0);
  });
}

for (const savedLanguage of ['en', 'zh-Hant']) {
  test(`reduced-motion menus are reachable with saved ${savedLanguage}`, async ({
    page,
  }) => {
    // Real browser timing: tiny CSS durations previously left these popups
    // at their offscreen preparation coordinates despite being "visible".
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((language) => {
      localStorage.setItem('forma-studio-language', language);
    }, savedLanguage);
    await page.goto('/');
    const language = page.getByRole('combobox', { name: 'Language / 語言' });
    await language.click();
    await expectExposedOptions(page, language, 2);
    await page
      .locator('.studio-dropdown-layer')
      .getByTitle('EN', { exact: true })
      .click();
    const exercise = page.getByRole('combobox', { name: 'Choose exercise' });
    await exercise.fill('Overhead reaches');
    await expectExposedOptions(page, exercise, 1);
    await page
      .getByTitle('Overhead reaches · 4 slow reps', { exact: true })
      .click();
    await expect(page.locator('.current-exercise h3')).toHaveText(
      'Overhead reaches',
    );
    await exercise.click();
    await page
      .getByTitle('Hands-on-hips side knee lifts · Teacher review', {
        exact: true,
      })
      .click();
    await expect(page.locator('.current-exercise h3')).toHaveText(
      'Hands-on-hips side knee lifts',
    );
  });
}
