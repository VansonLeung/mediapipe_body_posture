import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-desktop',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results/electron',
  workers: 1,
  timeout: 90000,
  use: { screenshot: 'only-on-failure' },
});
