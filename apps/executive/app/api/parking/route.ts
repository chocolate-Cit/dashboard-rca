import { getSession } from '@gip/api/server';
import { app } from '@/lib/app';
import { parkingFeed, parkingFeedEnabled, type ParkingData } from '@/lib/parking-feed';

/** ข้อมูลถือว่าเก่าเมื่อซิงก์จากลานสำเร็จครั้งล่าสุดนานเกินนี้ (รอบซิงก์ปกติ ~1 นาที) */
const STALE_MS = 3 * 60_000;

export type ParkingLive = {
  enabled: boolean;
  /** null = ยังไม่เคยได้ snapshot */
  data: ParkingData | null;
  stale: boolean;
  error: string | null;
};

export async function GET(req: Request) {
  const s = await getSession(req.headers.get('cookie'), app);
  if (s.status !== 'ok') return Response.json({ message: 'ต้องเข้าสู่ระบบ' }, { status: 401 });
  if (!parkingFeedEnabled()) {
    return Response.json({
      enabled: false,
      data: null,
      stale: false,
      error: null,
    } satisfies ParkingLive);
  }
  const f = parkingFeed();
  // ตัดสินความสดจาก sync.last_ok ตามคู่มือ (ไม่มี = ใช้เวลาที่ได้ข้อความล่าสุด)
  const freshAt = f.data?.syncLastOk ? Date.parse(f.data.syncLastOk) : f.receivedAt;
  return Response.json({
    enabled: true,
    data: f.data,
    stale: !freshAt || Date.now() - freshAt > STALE_MS,
    error: f.error,
  } satisfies ParkingLive);
}

export const dynamic = 'force-dynamic';
