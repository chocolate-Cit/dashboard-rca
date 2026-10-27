/**
 * ต่อ API ยอดรถ/รายได้ของ Backend จากฝั่ง server (token ไม่ออกไปที่เบราว์เซอร์)
 * - WebSocket: เปิดการเชื่อมต่อ → ส่ง {type:'auth', token} → ได้ auth_ok แล้ว server ส่ง snapshot เต็มชุดทุกครั้งที่ข้อมูลเปลี่ยน
 * - ระหว่าง WebSocket หลุด ดึง REST GET /api/dashboard ทุก 30 วินาทีเป็นสำรอง
 * - รองรับ snapshot v2 (คู่มือ API v2) และรูปแบบเดิม (v1) แปลงเป็น ParkingData ชุดเดียว
 * - ตั้งค่าใน .env.local: CIT_PARKING_WS_URL, CIT_PARKING_WS_TOKEN, CIT_PARKING_REST_URL (ไม่ใส่ = เดาจาก WS URL)
 */
export type ParkingData = {
  asOf: string;
  carsIn: number;
  carsOut: number;
  /** รายได้สุทธิหลังหักส่วนลดแล้ว (ห้ามหัก discount ซ้ำ) */
  revenue: number;
  discount: number;
  carsInside: number;
  /** null = เทียบไม่ได้ (เมื่อวานเป็น 0 หรือ API ไม่มี) */
  vsYesterdayPct: number | null;
  yesterdaySameTime: number | null;
  yesterdayDate: string | null;
  /** รายได้รายวัน 30 วัน จบที่เมื่อวาน */
  trend: { from: string; to: string; days: { date: string; revenue: number }[] } | null;
  hourly: {
    currentHour: number;
    lanes: { direction: 'in' | 'out'; id: string; label: string; counts: number[] }[];
  } | null;
  /** เวลาที่ระบบซิงก์ส่งข้อมูลจากลานสำเร็จล่าสุด */
  syncLastOk: string | null;
};

type Feed = {
  data: ParkingData | null;
  receivedAt: number | null;
  connected: boolean;
  error: string | null;
  started: boolean;
};

// เก็บบน globalThis: dev hot-reload ไม่สร้างการเชื่อมต่อซ้ำ
const g = globalThis as unknown as { __parkingFeed2?: Feed };
const feed: Feed = (g.__parkingFeed2 ??= {
  data: null,
  receivedAt: null,
  connected: false,
  error: null,
  started: false,
});

export const parkingFeedEnabled = () =>
  !!(process.env.CIT_PARKING_WS_URL && process.env.CIT_PARKING_WS_TOKEN);

/* eslint-disable @typescript-eslint/no-explicit-any -- ข้อมูลดิบจาก Backend อ่านแบบป้องกัน */
const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const numOrNull = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** snapshot ดิบ (v2 หรือ v1) → ParkingData · อ่านไม่ได้ = null */
export function normalizeSnapshot(d: any): ParkingData | null {
  if (!d || typeof d !== 'object') return null;
  if (d.cars && d.revenue) {
    // v2
    const r = d.revenue;
    return {
      asOf: String(d.as_of ?? new Date().toISOString()),
      carsIn: num(d.cars.in_today),
      carsOut: num(d.cars.out_today),
      revenue: num(r.today),
      discount: num(r.discount_today),
      carsInside: num(d.cars.parked),
      vsYesterdayPct: numOrNull(r.vs_yesterday_pct),
      yesterdaySameTime: numOrNull(r.yesterday_same_time),
      yesterdayDate: typeof r.yesterday_date === 'string' ? r.yesterday_date : null,
      trend: Array.isArray(d.trend?.days)
        ? {
            from: String(d.trend.from),
            to: String(d.trend.to),
            days: d.trend.days.map((x: any) => ({ date: String(x.date), revenue: num(x.revenue) })),
          }
        : null,
      hourly: Array.isArray(d.hourly?.lanes)
        ? {
            currentHour: num(d.hourly.current_hour),
            lanes: d.hourly.lanes.map((l: any) => ({
              direction: l.direction === 'out' ? 'out' : 'in',
              id: String(l.id),
              label: String(l.label ?? l.id),
              counts: Array.from({ length: 24 }, (_, h) => num(l.counts?.[h])),
            })),
          }
        : null,
      syncLastOk: typeof d.sync?.last_ok === 'string' ? d.sync.last_ok : null,
    };
  }
  if (d.revenue_today) {
    // v1 (รูปแบบเดิม)
    return {
      asOf: String(d.generated_at ?? new Date().toISOString()),
      carsIn: num(d.in_today),
      carsOut: num(d.out_today),
      revenue: num(d.revenue_today.total?.revenue),
      discount: num(d.revenue_today.total?.discount),
      carsInside: num(d.parked?.total),
      vsYesterdayPct: null,
      yesterdaySameTime: null,
      yesterdayDate: null,
      trend: null,
      hourly: null,
      syncLastOk: typeof d.sync?.last_ok === 'string' ? d.sync.last_ok : null,
    };
  }
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function accept(raw: unknown) {
  const data = normalizeSnapshot(raw);
  if (!data) return;
  feed.data = data;
  feed.receivedAt = Date.now();
}

const restUrl = () =>
  process.env.CIT_PARKING_REST_URL ||
  process.env.CIT_PARKING_WS_URL!.replace(/^ws/, 'http').replace(/\/ws\/?$/, '/api/dashboard');

/** REST สำรอง: ทำงานเฉพาะตอน WebSocket ไม่ได้ต่ออยู่ */
async function pollRest() {
  if (feed.connected) return;
  try {
    const res = await fetch(restUrl(), {
      headers: { Authorization: `Bearer ${process.env.CIT_PARKING_WS_TOKEN}` },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { ok: _ok, ...data } = (await res.json()) as Record<string, unknown>;
    accept(data);
  } catch (e) {
    feed.error ??= `ดึงข้อมูลสำรอง (REST) ไม่ได้: ${(e as Error).message}`;
  }
}

function connect(retry = 0) {
  const ws = new WebSocket(process.env.CIT_PARKING_WS_URL!);
  let ok = false;

  ws.onopen = () =>
    ws.send(JSON.stringify({ type: 'auth', token: process.env.CIT_PARKING_WS_TOKEN }));
  ws.onmessage = (e) => {
    try {
      const m = JSON.parse(String(e.data)) as { type: string; data?: unknown };
      if (m.type === 'auth_ok') {
        ok = true;
        feed.connected = true;
        feed.error = null;
      } else if (m.type === 'snapshot') {
        accept(m.data);
      }
    } catch {
      // ข้อความที่อ่านไม่ได้: ข้าม
    }
  };
  ws.onerror = () => {
    feed.error = 'เชื่อมต่อ WebSocket ยอดรถไม่ได้';
  };
  ws.onclose = (e) => {
    feed.connected = false;
    if (e.code === 4401 || e.code === 4400) {
      // token ผิด: ไม่ต้องลองถี่ แต่ยังลองใหม่ทุก 30 วินาทีเผื่อแก้ค่าแล้ว
      feed.error = `Backend ปฏิเสธการยืนยันตัวตน (${e.reason || e.code})`;
    }
    const wait = Math.min(30_000, 1000 * 2 ** (ok ? 0 : retry)) + Math.random() * 500;
    setTimeout(() => connect(ok ? 0 : retry + 1), wait);
  };
}

/** ข้อมูลล่าสุด (เริ่มต่อครั้งแรกเมื่อมีคนเรียก) */
export function parkingFeed() {
  if (!feed.started && parkingFeedEnabled()) {
    feed.started = true;
    connect();
    // โหลดครั้งแรกจาก REST ด้วย เผื่อ WebSocket ต่อช้า แล้วสำรองทุก 30 วินาที
    setTimeout(pollRest, 3_000);
    setInterval(pollRest, 30_000);
  }
  return feed;
}
