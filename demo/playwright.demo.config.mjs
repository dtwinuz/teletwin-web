// Smoke test of the live demo build. Run from the repo root after `npm run build:demo`:
//   npx --prefix demo playwright test -c demo/playwright.demo.config.mjs
// (file names end in `.pw.mjs`, so the repo's vitest run never picks them up)
import { defineConfig } from '@playwright/test';

const PORT = 4323;

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.pw\.mjs$/,
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}/demo/teletwin-web/`,
    viewport: { width: 1440, height: 900 },
    locale: 'uz-UZ',
    timezoneId: 'Asia/Tashkent',
  },
  webServer: {
    command: `node serve.mjs ${PORT}`,
    cwd: '.',
    url: `http://localhost:${PORT}/demo/teletwin-web/`,
    reuseExistingServer: true,
  },
});
