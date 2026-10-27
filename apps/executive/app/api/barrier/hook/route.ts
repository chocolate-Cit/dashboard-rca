import { getSession } from '@gip/api/server';
import { app } from '@/lib/app';
import { barrierHookState, readArm, recordBarrier } from '@/lib/barrier-hook';

/**
 * Webhook ให้ตู้ควบคุมไม้กั้นแจ้งสถานะกลับ
 *
 * POST /api/barrier/hook   (ไม่ต้องล็อกอิน · ใช้รหัสลับแทน)
 *   Header  X-Hook-Key: <CIT_BARRIER_HOOK_KEY>   หรือ  ?key=<CIT_BARRIER_HOOK_KEY>
 *   Body    JSON เช่น {"site":"CP4-IN1","status_code":1020}
 *           รองรับ status_code 1020 = ยก / 1010 = ลง, state/status: "open" | "close" | "up" | "down", armOpen: true/false
 *           ไม่ส่ง site = ใช้ CIT_BARRIER_SITE
 *
 * GET /api/barrier/hook    (ต้องล็อกอิน) สถานะล่าสุด + เหตุการณ์ 30 รายการล่าสุด ไว้ตรวจว่าตู้ยิงมาจริง
 */
export async function POST(req: Request) {
  const secret = process.env.CIT_BARRIER_HOOK_KEY;
  if (!secret)
    return Response.json(
      { ok: false, message: 'ยังไม่ได้ตั้งค่า CIT_BARRIER_HOOK_KEY' },
      { status: 503 },
    );
  const key = req.headers.get('x-hook-key') ?? new URL(req.url).searchParams.get('key');
  if (key !== secret)
    return Response.json({ ok: false, message: 'รหัส hook ไม่ถูกต้อง' }, { status: 401 });

  const text = await req.text();
  let body: Record<string, unknown>;
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { state: text };
  }
  const site = String(body.site ?? body.lane ?? process.env.CIT_BARRIER_SITE ?? 'unknown');
  const armOpen = readArm(body);
  const event = { site, armOpen, at: new Date().toISOString(), raw: body };
  recordBarrier(event);
  console.log(
    '[barrier hook]',
    site,
    armOpen === null ? 'อ่านสถานะไม่ได้' : armOpen ? 'ยก' : 'ลง',
    text.slice(0, 300),
  );

  return Response.json({ ok: true, site, armOpen });
}

export async function GET(req: Request) {
  const s = await getSession(req.headers.get('cookie'), app);
  if (s.status !== 'ok') return Response.json({ message: 'ต้องเข้าสู่ระบบ' }, { status: 401 });
  return Response.json(barrierHookState());
}

export const dynamic = 'force-dynamic';
