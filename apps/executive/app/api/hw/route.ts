import { getSession } from '@gip/api/server';
import { app } from '@/lib/app';

/**
 * สถานะล่าสุดของ Hardware จริง (api-nexus: POST /api/frontend/hw/latest)
 * - เรียกจากฝั่ง server เท่านั้น: X-Api-Key ต้องไม่ออกไปถึงเบราว์เซอร์
 * - ตั้งค่าใน .env.local: CIT_HW_URL, CIT_HW_KEY · ไม่ได้ตั้ง = ใช้ข้อมูลจำลองตามเดิม
 * - ฝั่ง API cache ~5 วินาที แนะนำโพลทุก 10–20 วินาที
 */
type RawBoard = {
  hw_code: string;
  display_status: 'NORMAL' | 'ERROR' | 'OFFLINE' | 'NO_DATA';
  last_seen_at: string | null;
  hw_detail?: { sub_code: string; device_name: string; error_description: string }[];
  devices?: { sub_code: string; status: 'normal' | 'error' | 'unknown' }[];
};

export type HwBoard = {
  hwCode: string;
  displayStatus: RawBoard['display_status'];
  lastSeenAt: string | null;
  /** sub_code → ข้อความ error (เฉพาะตัวที่เสีย) */
  errors: Record<string, string>;
};
export type HwLive = {
  enabled: boolean;
  serverTime: string | null;
  boards: HwBoard[];
  /** ข้อมูลดิบจาก API (เฉพาะตอนพัฒนา) ไว้ดูใน Console ของเบราว์เซอร์ */
  raw?: unknown;
};

export async function GET(req: Request) {
  const s = await getSession(req.headers.get('cookie'), app);
  if (s.status !== 'ok') return Response.json({ message: 'ต้องเข้าสู่ระบบ' }, { status: 401 });

  const url = process.env.CIT_HW_URL;
  const key = process.env.CIT_HW_KEY;
  if (!url || !key)
    return Response.json({ enabled: false, serverTime: null, boards: [] } satisfies HwLive);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
      body: '{}',
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (!res.ok) {
      return Response.json({ message: `API Hardware ตอบ HTTP ${res.status}` }, { status: 502 });
    }
    const raw = (await res.json()) as { server_time?: string; data?: RawBoard[] };
    const boards: HwBoard[] = (raw.data ?? []).map((b) => ({
      hwCode: b.hw_code.toUpperCase(),
      displayStatus: b.display_status,
      lastSeenAt: b.last_seen_at,
      errors: Object.fromEntries(
        (b.hw_detail ?? []).map((d) => [
          d.sub_code.toUpperCase(),
          d.error_description || 'เกิด Error',
        ]),
      ),
    }));
    return Response.json({
      enabled: true,
      serverTime: raw.server_time ?? null,
      boards,
      ...(process.env.NODE_ENV !== 'production' ? { raw } : {}),
    } satisfies HwLive);
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'TimeoutError';
    return Response.json(
      { message: timeout ? 'API Hardware ไม่ตอบใน 4 วินาที' : 'เชื่อมต่อ API Hardware ไม่ได้' },
      { status: 504 },
    );
  }
}

export const dynamic = 'force-dynamic';
