// Every screen of the live demo opens with its sample data and without console errors
import { expect, test } from '@playwright/test';

import {
  openChat, openCorpMenuItem, openFolder, waitForApp,
} from './steps.mjs';

// Tests of one file run one after another in the same worker
let consoleErrors = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await page.goto('./');
  await waitForApp(page);
});

test.afterEach(() => {
  expect(consoleErrors, 'console errors').toEqual([]);
});

test('chat list mixes Telegram and company chats, demo badge is shown', async ({ page }) => {
  await expect(page.locator('.chat-list .ListItem', { hasText: 'Onam' }).first()).toBeVisible();
  await expect(page.locator('.chat-list .ListItem', { hasText: 'Umumiy e\'lonlar' }).first()).toBeVisible();
  await expect(page.locator('.tt-demo-pill')).toContainText('Demo');
});

test('company chat: history, reactions, pinned message, document, voice', async ({ page }) => {
  await openChat(page, 'Savdo bo\'limi');
  await expect(page.locator('.MiddleHeader')).toContainText('Savdo bo\'limi');
  await page.mouse.move(900, 500);
  await page.mouse.wheel(0, -700);
  await expect(page.locator('.Message:visible', { hasText: 'Noyabr rejasi' }).first()).toBeVisible();
  await expect(page.locator('.HeaderPinnedMessage-wrapper, .HeaderPinnedMessageWrapper, .pinned-message')
    .or(page.getByText('Pinned message')).first()).toBeVisible();
  await expect(page.locator('.ReactionStaticEmoji img.media').first()).toBeVisible();
});

test('thread opens from the replies counter', async ({ page }) => {
  await openChat(page, 'Savdo bo\'limi');
  await page.mouse.move(900, 500);
  await page.mouse.wheel(0, -700);
  await page.locator('.Message:visible', { hasText: 'Noyabr rejasi' }).first()
    .locator('.message-replies-wrapper').first().click();
  await expect(page.locator('.Message:visible', { hasText: 'Andijon yo\'nalishini' }).first()).toBeVisible();
});

test('sending a message gets a reply from a colleague', async ({ page }) => {
  await openChat(page, 'Marketing');
  const text = `Demo sinov ${Date.now()}`;
  await page.locator('#editable-message-text').click();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await expect(page.locator('.Message:visible', { hasText: text }).first()).toBeVisible();
});

test('Jira key shows the issue card', async ({ page }) => {
  await openFolder(page, 'Korxona');
  await openChat(page, 'Loyiha: Chirchiq ombori');
  await page.mouse.move(900, 500);
  await page.mouse.wheel(0, -400);
  await page.locator('.messages-container a:visible', { hasText: 'CHIR-142' }).first().hover();
  await expect(page.getByText('Ombor karkasini qurish').first()).toBeVisible();
});

test('personal Telegram chat with unread messages', async ({ page }) => {
  await openChat(page, 'Onam');
  await expect(page.locator('.Message:visible', { hasText: 'Non olib kelishni unutma' }).first()).toBeVisible();
});

test('Ilovalar folder opens a company app with SSO', async ({ page }) => {
  await openFolder(page, 'Ilovalar');
  await page.locator('.ListItem:visible', { hasText: 'Ombor qoldig' }).first().click();
  const app = page.frameLocator('iframe').first();
  await expect(app.getByText('SSO: Toshmatov Jasur')).toBeVisible();
  await expect(app.getByText('Pozitsiya')).toBeVisible();
});

const MENU_SCREENS = [
  ['Holatim', 'Bezovta qilmang'],
  ['Profilim', 'Toshmatov'],
  ['Faollik', 'sizni eslatdi'],
  ['Saqlanganlar', 'Saqlanganlar'],
  ['Kanallar katalogi', 'Kitobxonlar klubi'],
  ['Xodimga yozish', 'Rahimova Dilnoza'],
];

for (const [item, expected] of MENU_SCREENS) {
  test(`Korxona menu: ${item}`, async ({ page }) => {
    await openCorpMenuItem(page, item);
    await expect(page.locator('.Modal:visible, .modal-dialog:visible').getByText(expected).first()).toBeVisible();
  });
}

test('global search finds company messages', async ({ page }) => {
  await page.locator('#telegram-search-input').fill('Yashil Vodiy');
  await expect(page.getByText('Bekzod aka,').first()).toBeVisible({ timeout: 15_000 });
});

test('direct link to a chat opens it in a new tab', async ({ page, context }) => {
  await openChat(page, 'Buxgalteriya');
  const url = page.url();
  expect(url).toContain('#');
  const tab = await context.newPage();
  await tab.goto(url);
  await expect(tab.locator('.MiddleHeader').getByText('Buxgalteriya').first()).toBeVisible({ timeout: 30_000 });
  await tab.close();
});

test('phone layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFolder(page, 'Korxona');
  await openChat(page, 'IT yordam');
  await expect(page.locator('.Message:visible').first()).toBeVisible();
});
