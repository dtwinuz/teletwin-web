// README screenshots of the live demo: builds `dist-demo/` (unless `--no-build` or `DEMO_URL` is given), serves it
// under /demo/teletwin-web/, walks the main screens and writes 1440x900 JPEGs (q78) plus one 390x844 phone shot
// to docs/screenshots/.
// Usage: npm run site:screenshots            (from the repo root)
//        DEMO_URL=http://localhost:1234/ node demo/site-screenshots.mjs   (against `npm run dev:demo`)
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { BASE, startServer } from './serve.mjs';
import {
  openCorpMenuItem, openChat, openFolder, waitForApp,
} from './steps.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
const PORT = 4322;
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const QUALITY = 78;

const SHOTS = [
  {
    name: 'overview',
    run: async (page) => {
      await openChat(page, 'Savdo bo\'limi');
      await page.mouse.move(900, 500);
      await page.mouse.wheel(0, -700);
      await page.waitForTimeout(1200);
    },
  },
  {
    name: 'corp-folder',
    run: async (page) => {
      await openFolder(page, 'Korxona');
      await openChat(page, 'Umumiy e\'lonlar');
    },
  },
  {
    name: 'thread',
    run: async (page) => {
      await openChat(page, 'Savdo bo\'limi');
      await page.mouse.move(900, 500);
      await page.mouse.wheel(0, -700);
      await page.waitForTimeout(800);
      await page.locator('.Message:visible', { hasText: 'Noyabr rejasi' }).first()
        .locator('.message-replies-wrapper').first().click();
      await page.waitForTimeout(1500);
    },
  },
  {
    name: 'jira-card',
    run: async (page) => {
      await openFolder(page, 'Korxona');
      await openChat(page, 'Loyiha: Chirchiq ombori');
      await page.mouse.move(900, 500);
      await page.mouse.wheel(0, -400);
      await page.waitForTimeout(800);
      await page.locator('.messages-container a:visible', { hasText: 'CHIR-142' }).first().hover();
      await page.waitForTimeout(1500);
    },
  },
  {
    name: 'personal-chat',
    run: async (page) => {
      await openChat(page, 'Onam');
    },
  },
  {
    name: 'apps',
    run: async (page) => {
      await openFolder(page, 'Ilovalar');
      await page.locator('.ListItem:visible', { hasText: 'Ombor qoldig' }).first().click();
      await page.waitForTimeout(2000);
    },
  },
  {
    name: 'status',
    run: async (page) => {
      await openChat(page, 'Savdo bo\'limi');
      await openCorpMenuItem(page, 'Holatim');
    },
  },
  {
    name: 'activity',
    run: async (page) => {
      await openCorpMenuItem(page, 'Faollik');
    },
  },
  {
    name: 'saved',
    run: async (page) => {
      await openCorpMenuItem(page, 'Saqlanganlar');
    },
  },
  {
    name: 'directory',
    run: async (page) => {
      await openCorpMenuItem(page, 'Kanallar katalogi');
    },
  },
  {
    name: 'direct-picker',
    run: async (page) => {
      await openCorpMenuItem(page, 'Xodimga yozish');
    },
  },
  {
    name: 'search',
    run: async (page) => {
      await page.locator('#telegram-search-input').fill('Yashil Vodiy');
      await page.waitForTimeout(2000);
    },
  },
];

async function shoot(browser, baseUrl, name, viewport, run) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'uz-UZ', timezoneId: 'Asia/Tashkent' });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await waitForApp(page);
  try {
    await run(page);
  } catch (err) {
    console.warn(`! ${name}: ${err.message.split('\n')[0]}`);
  }
  await page.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: QUALITY });
  console.log(`✓ ${name}.jpg`);
  await context.close();
}

async function main() {
  let baseUrl = process.env.DEMO_URL;
  let server;
  if (!baseUrl) {
    if (!process.argv.includes('--no-build') || !existsSync(`${ROOT}dist-demo/index.html`)) {
      execSync('npm run build:demo', { cwd: ROOT, stdio: 'inherit' });
    }
    server = await startServer(PORT);
    baseUrl = `http://localhost:${PORT}${BASE}`;
  }
  mkdirSync(OUT, { recursive: true });

  const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length).split(',');
  const browser = await chromium.launch();
  for (const shot of SHOTS) {
    if (only && !only.includes(shot.name)) continue;
    await shoot(browser, baseUrl, shot.name, DESKTOP, shot.run);
  }
  if (!only || only.includes('phone')) {
    await shoot(browser, baseUrl, 'phone', PHONE, async (page) => {
      await openFolder(page, 'Korxona');
    });
  }
  await browser.close();
  server?.close();
}

await main();
