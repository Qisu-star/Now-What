import { defineConfig } from '@playwright/test'

const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    // 本地复用系统 Edge；CI 里用 Playwright 自带的 Chromium
    channel: isCI ? undefined : 'msedge',
    headless: true,
    viewport: { width: 1440, height: 900 }
  },
  webServer: {
    command: `${process.execPath} apps/api/src/server.ts --serve-web`,
    url: 'http://127.0.0.1:3100/api/v1/health',
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: '3100',
      DATABASE_URL: 'e2e/.tmp/e2e.db',
      UPLOAD_DIR: 'e2e/.tmp/uploads'
    }
  }
})
