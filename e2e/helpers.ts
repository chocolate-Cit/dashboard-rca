import { expect, type Page } from '@playwright/test';

export const EXECUTIVE = 'http://localhost:3000';

export async function login(page: Page, base: string, code: string, password = 'password123') {
  await page.goto(`${base}/login`);
  await page.getByLabel('รหัสพนักงาน').fill(code);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
}

export async function loginOk(page: Page, base: string, code: string, home: string) {
  await login(page, base, code);
  await expect(page).toHaveURL(new RegExp(`${home}`));
}

/** PNG 1×1 สำหรับทดสอบแนบรูป */
export const tinyPng = {
  name: 'after.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
};
