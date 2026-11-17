// UI steps shared by the screenshot script and the smoke test
export async function waitForApp(page) {
  await page.locator('.chat-list .ListItem').first().waitFor({ timeout: 30000 });
  // Corp chats arrive after the corp snapshot; give avatars and counters a moment
  await page.locator('.chat-list .ListItem', { hasText: 'Savdo bo\'limi' }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
}

export async function openFolder(page, title) {
  await page.locator('.TabList').getByText(title).first().click();
  await page.waitForTimeout(700);
}

export async function openChat(page, title) {
  await page.locator('.chat-list .ListItem:visible', { hasText: title }).first().click();
  await page.locator('.MiddleHeader').getByText(title).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1800);
}

export async function openCorpMenuItem(page, item) {
  await page.locator('.LeftMainHeader button').first().click();
  await page.waitForTimeout(500);
  await page.locator('.MenuItem:visible', { hasText: 'Korxona' }).first().hover();
  await page.waitForTimeout(600);
  await page.locator('.MenuItem:visible', { hasText: item }).last().click();
  await page.waitForTimeout(1500);
}
