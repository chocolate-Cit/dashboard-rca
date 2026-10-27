import { getSession } from '@gip/api/server';
import { app } from '@/lib/app';

/**
 * ทดสอบสั่งไม้กั้นจริงผ่าน API ตู้ควบคุมของ CIT (ตัวทดสอบ 1 ตู้)
 * - เรียกจากฝั่ง server เท่านั้น: เบราว์เซอร์เรียก IP ในวงแลนตรง ๆ ไม่ได้ และ SESSIONID ต้องไม่ออกไปถึงเบราว์เซอร์
 * - ตั้งค่าใน .env.local: CIT_BARRIER_URL, CIT_BARRIER_SESSION, CIT_BARRIER_SITE (รหัสช่องทางบนผัง เช่น CP4-IN1)
 * - ไม่ได้ตั้ง CIT_BARRIER_URL = ปิดฟีเจอร์ (ปุ่มทดสอบไม่แสดง)
 *
 * ตอบกลับของตู้: สั่งยก (open_plus) สำเร็จ = status_code 1020, สั่งปิด (close) สำเร็จ = 1010
 * หรือ { status: 'success', message: 'Command sent (Fast return)' }
 */
const COMMANDS = {
  open: { command: 'open_plus', ok: 1020 },
  close: { command: 'close', ok: 1010 },
} as const;

function config() {
  const url = process.env.CIT_BARRIER_URL;
  return url
    ? {
        url,
        session: process.env.CIT_BARRIER_SESSION ?? '',
        site: process.env.CIT_BARRIER_SITE ?? 'CP4-IN1',
      }
    : null;
}

async function authorized(req: Request) {
  const s = await getSession(req.headers.get('cookie'), app);
  return s.status === 'ok';
}

export async function GET(req: Request) {
  if (!(await authorized(req)))
    return Response.json({ message: 'ต้องเข้าสู่ระบบ' }, { status: 401 });
  const c = config();
  return Response.json({ enabled: !!c, site: c?.site ?? null });
}

export async function POST(req: Request) {
  if (!(await authorized(req)))
    return Response.json({ message: 'ต้องเข้าสู่ระบบ' }, { status: 401 });
  const c = config();
  if (!c) return Response.json({ message: 'ยังไม่ได้ตั้งค่า CIT_BARRIER_URL' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action === 'open' || body?.action === 'close' ? body.action : null;
  if (!action)
    return Response.json({ message: 'action ต้องเป็น open หรือ close' }, { status: 400 });

  const cmd = COMMANDS[action];
  try {
    const res = await fetch(c.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(c.session ? { Cookie: `SESSIONID=${c.session}` } : {}),
      },
      body: JSON.stringify({ command: cmd.command }),
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    const raw = (await res.json().catch(() => null)) as {
      status_code?: number;
      status?: string;
      message?: string;
    } | null;
    const ok = res.ok && (raw?.status_code === cmd.ok || raw?.status === 'success');
    if (!ok) {
      return Response.json(
        {
          message: `ตู้ตอบกลับไม่สำเร็จ (HTTP ${res.status}${raw?.status_code ? ` · status_code ${raw.status_code}` : ''})`,
          raw,
        },
        { status: 502 },
      );
    }
    return Response.json({ site: c.site, raw });
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'TimeoutError';
    return Response.json(
      {
        message: timeout
          ? 'ตู้ไม่ตอบใน 6 วินาที ตรวจว่าเครื่องนี้อยู่วงแลนเดียวกับตู้'
          : 'เชื่อมต่อตู้ไม่ได้ ตรวจ IP และเครือข่าย',
      },
      { status: 504 },
    );
  }
}

export const dynamic = 'force-dynamic';
