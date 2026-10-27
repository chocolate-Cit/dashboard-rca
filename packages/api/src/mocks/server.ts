/**
 * Mock server ของ backend CIT (พอร์ต 4000)
 * ใช้ MSW handlers ชุดเดียวกับใน test ทั้งสองเว็บเรียกผ่าน route handler ของ Next.js
 * จึงเห็นข้อมูลชุดเดียวกัน (เช่น เปิดงานใน Service แล้วไปโผล่ใน Executive)
 *
 *   pnpm mock                          # เริ่ม server
 *   MOCK_DELAY_MS=800 pnpm mock        # จำลองเครือข่ายช้า
 *   MOCK_ERROR_RATE=0.2 pnpm mock      # จำลอง error 20% ของ GET
 *   MOCK_LIFF_INTERVAL_MS=0 pnpm mock  # ปิดการจำลองช่างอัปเดตจาก LIFF
 */
import { createServer } from '@mswjs/http-middleware';
import { getDb } from './db';
import { handlers, simulateLiffActivity } from './handlers';

const port = Number(process.env.MOCK_PORT ?? 4000);
const liffEvery = Number(process.env.MOCK_LIFF_INTERVAL_MS ?? 90_000);

const db = getDb();
createServer(...handlers).listen(port, () => {
  console.log(`[mock] Go Inno Parking API → http://localhost:${port}`);
  console.log(
    `[mock] ${db.sites.length} จุด, ${db.equipment.length} อุปกรณ์, ${db.incidents.length} งานซ่อม, ${db.inspections.length} ผลตรวจ`,
  );
  console.log('[mock] บัญชีทดสอบ: EXEC01 / ADMIN / TECH01  รหัสผ่าน password123');
});

if (liffEvery > 0) {
  setInterval(() => {
    const log = simulateLiffActivity();
    if (log) console.log(`[mock] LIFF: ${log.authorName} — ${log.message}`);
  }, liffEvery);
}
