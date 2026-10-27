import { expect, test } from '@playwright/test';
import { EXECUTIVE, loginOk } from './helpers';

/** จอมือถือ: ไม่มีการเลื่อนแนวนอนทั้งหน้า, Heatmap เลื่อนในกล่องของตัวเอง, เมนูเป็น drawer */
const noPageScroll = async (page: import('@playwright/test').Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

test('Executive บนมือถือ', async ({ page }) => {
  await loginOk(page, EXECUTIVE, 'EXEC01', '/dashboard');
  await page.waitForLoadState('networkidle');
  await noPageScroll(page);
  const scroller = page.getByRole('region', { name: /เลื่อนแนวนอนได้/ });
  expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
});
