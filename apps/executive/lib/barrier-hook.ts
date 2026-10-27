/**
 * สถานะไม้กั้นที่ตู้ควบคุมแจ้งกลับมาทาง webhook (POST /api/barrier/hook)
 * เก็บในหน่วยความจำของ server: สถานะล่าสุดต่อช่องทาง + เหตุการณ์ล่าสุด 30 รายการ (ไว้ตรวจสอบ)
 */
export type BarrierEvent = {
  site: string;
  /** null = อ่านสถานะจากข้อความไม่ได้ (เก็บ raw ไว้ดู) */
  armOpen: boolean | null;
  at: string;
  raw: unknown;
};

const g = globalThis as unknown as {
  __barrierHook?: { latest: Map<string, BarrierEvent>; events: BarrierEvent[] };
};
const store = (g.__barrierHook ??= {
  latest: new Map<string, BarrierEvent>(),
  events: [] as BarrierEvent[],
});

/** รหัส/ข้อความจากตู้ → ยก (true) / ลง (false) */
export function readArm(body: Record<string, unknown>): boolean | null {
  if (typeof body.armOpen === 'boolean') return body.armOpen;
  const code = Number(body.status_code ?? body.code);
  if (code === 1020) return true;
  if (code === 1010) return false;
  const text = String(body.state ?? body.status ?? body.command ?? body.event ?? '').toLowerCase();
  if (/open|up|raise|ยก/.test(text)) return true;
  if (/close|down|lower|ลง|ปิด/.test(text)) return false;
  return null;
}

export function recordBarrier(e: BarrierEvent) {
  if (e.armOpen !== null) store.latest.set(e.site, e);
  store.events.unshift(e);
  store.events.length = Math.min(store.events.length, 30);
}

export const barrierHookState = () => ({
  latest: Object.fromEntries(store.latest),
  events: store.events,
});
