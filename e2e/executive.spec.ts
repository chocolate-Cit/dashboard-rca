import { expect, test } from '@playwright/test';
import { EXECUTIVE, loginOk } from './helpers';

test('Dashboard แสดงข้อมูลวันนี้ ไม่มีตัวเลือกช่วงเวลา', async ({ page }) => {
  await loginOk(page, EXECUTIVE, 'EXEC01', '/dashboard');
  await expect(page.getByRole('region', { name: /รายได้ ·/ }).getByText(/^฿[\d,]+$/)).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'ช่วงเวลา' })).toHaveCount(0);
});

test('Heatmap สลับมุมมอง เข้า / ออก', async ({ page }) => {
  await loginOk(page, EXECUTIVE, 'EXEC01', '/dashboard');
  const heat = page.getByRole('grid', { name: /Heatmap/ });
  await expect(heat.getByRole('rowheader')).toHaveCount(14);
  await page.getByRole('radiogroup', { name: 'มุมมอง Heatmap' }).getByRole('radio', { name: 'รถเข้า' }).click();
  await expect(heat.getByRole('rowheader')).toHaveCount(7);
});
