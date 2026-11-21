import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /live-smoke/,
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
      testIgnore: /live-smoke/,
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 14'] },
      testIgnore: /live-smoke/,
    },
    {
      name: 'live-smoke',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /live-smoke/,
    },
  ],
  webServer: {
    command: `pnpm --filter @trade/web exec vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
