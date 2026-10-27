// แคปหน้าจอสำหรับตรวจดีไซน์
// node scripts/shot.mjs <baseUrl> <user> <path1,path2,...> <outDir>
import { chromium } from '@playwright/test';

const [base, user, paths, out] = process.argv.slice(2);
const browser = await chromium.launch();
for (const [name, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
  ['tablet', { width: 820, height: 1180 }],
]) {
  const ctx = await browser.newContext({ viewport, locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const page = await ctx.newPage();
  await page.goto(`${base}/login`);
  await page.fill('input[name=employeeCode]', user);
  await page.fill('input[name=password]', 'password123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  for (const path of paths.split(',')) {
    await page.goto(`${base}${path}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) console.log(`OVERFLOW ${name} ${path}: ${overflow}px`);
    const slug = path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root';
    await page.screenshot({ path: `${out}/${slug}-${name}.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close();
