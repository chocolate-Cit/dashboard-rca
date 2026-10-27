import { defineConfig, devices } from '@playwright/test';

/**
 * E2E: เปิด mock server + ทั้งสองเว็บ แล้วทดสอบ flow หลัก
 *   pnpm e2e
 * ถ้ามี server รันอยู่แล้ว (pnpm mock / pnpm dev) จะใช้ตัวที่มีอยู่
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile.spec.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'pnpm --filter @gip/api mock-server',
      url: 'http://localhost:4000/sites',
      reuseExistingServer: true,
      env: { MOCK_DELAY_MS: '0', MOCK_LIFF_INTERVAL_MS: '0' },
      // /sites ตอบ 401 เมื่อไม่มี token ก็นับว่า server พร้อม
    },
    { command: 'pnpm --filter executive dev', url: 'http://localhost:3000/login', reuseExistingServer: true, timeout: 180_000 },
  ],
});
