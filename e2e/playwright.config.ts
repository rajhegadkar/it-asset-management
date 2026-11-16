import { defineConfig, devices } from '@playwright/test';

/**
 * UI test suite for the ITAM web app.
 * Every spec runs on three screen sizes: desktop (1440x900), tablet (iPad Mini) and phone (Pixel 7).
 * Run:  npm --prefix e2e test         (all devices)
 *       npm --prefix e2e run test:phone
 */
const PORT = process.env.E2E_PORT || '5099';
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  // The specs share one seeded database and build on each other's data, so run them in order.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...devices['iPad Mini'], browserName: 'chromium' } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'node scripts/start-test-server.mjs',
        url: `${baseURL}/api/v1/health`,
        timeout: 240_000,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
      },
});
