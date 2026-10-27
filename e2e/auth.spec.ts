import { expect, test } from '@playwright/test';
import { EXECUTIVE, login, loginOk } from './helpers';

test.describe('Login และสิทธิ์', () => {
  test('ยังไม่ login ถูกส่งไปหน้า login', async ({ page }) => {
    await page.goto(`${EXECUTIVE}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('รหัสผิดแสดงข้อความผิดพลาด', async ({ page }) => {
    await login(page, EXECUTIVE, 'EXEC01', 'wrong-password');
    await expect(page.getByRole('alert').filter({ hasText: 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง' })).toBeVisible();
  });

  test('ช่องว่างแสดงข้อความ validate', async ({ page }) => {
    await page.goto(`${EXECUTIVE}/login`);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
    await expect(page.getByText('กรอกรหัสพนักงาน')).toBeVisible();
    await expect(page.getByText('กรอกรหัสผ่าน')).toBeVisible();
  });

  test('executive และ admin เข้าเว็บผู้บริหารได้', async ({ page }) => {
    await loginOk(page, EXECUTIVE, 'EXEC01', '/dashboard');
    await expect(page.getByRole('heading', { name: 'แนวโน้มรายได้รายวัน' })).toBeVisible();
    await page.context().clearCookies();
    await loginOk(page, EXECUTIVE, 'ADMIN', '/dashboard');
  });
});
