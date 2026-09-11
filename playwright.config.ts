import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:5175',
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: true,
  },
  projects: [{ name: 'chromium' }],
});
