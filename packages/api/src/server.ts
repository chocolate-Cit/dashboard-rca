/**
 * โค้ดฝั่ง server ของ Next.js (route handler / server component) ที่ใช้ร่วมกันทั้งสองเว็บ
 * - token อยู่ใน httpOnly cookie เท่านั้น (ไม่ส่งถึง JavaScript ฝั่ง browser)
 * - ชื่อ cookie แยกต่อเว็บ เพราะ cookie ไม่แยกตามพอร์ต (localhost:3000 กับ 3001 ใช้ร่วมกัน)
 * - ใช้แค่ Web Request/Response จึงไม่ผูกกับเวอร์ชันของ Next.js
 */
import { loginInputSchema, loginResponseSchema, userSchema, type Role, type User } from './schemas';

export type AppConfig = {
  /** ชื่อเว็บ ใช้ตั้งชื่อ cookie */
  id: 'executive' | 'service';
  allowedRoles: Role[];
};

const SESSION_MAX_AGE = 8 * 60 * 60;

export function apiMode(): 'mock' | 'live' {
  return process.env.API_MODE === 'live' ? 'live' : 'mock';
}

export function backendUrl(): string {
  const url = process.env.API_BASE_URL;
  if (apiMode() === 'live' && !url) throw new Error('API_MODE=live ต้องตั้ง API_BASE_URL');
  return (url ?? 'http://localhost:4000').replace(/\/$/, '');
}

export const cookieNames = (app: AppConfig) => ({
  token: `gip_${app.id}_session`,
  role: `gip_${app.id}_role`,
});

function cookie(name: string, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function clearCookies(app: AppConfig, headers: Headers) {
  const names = cookieNames(app);
  headers.append('Set-Cookie', cookie(names.token, '', 0));
  headers.append('Set-Cookie', cookie(names.role, '', 0));
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function json(body: unknown, status = 200, headers = new Headers()) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

async function backend(path: string, init: RequestInit = {}) {
  try {
    return await fetch(`${backendUrl()}${path}`, { ...init, cache: 'no-store' });
  } catch {
    return json(
      { message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง', code: 'BACKEND_DOWN' },
      502,
    );
  }
}

/** POST /api/auth/login */
export async function handleLogin(req: Request, app: AppConfig): Promise<Response> {
  const parsed = loginInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json({ message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ครบ' }, 400);
  }
  const res = await backend('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    return json(data ?? { message: 'เข้าสู่ระบบไม่สำเร็จ' }, res.status);
  }
  const login = loginResponseSchema.safeParse(data);
  if (!login.success) return json({ message: 'รูปแบบข้อมูลจากเซิร์ฟเวอร์ไม่ถูกต้อง' }, 502);

  const { token, user } = login.data;
  if (!app.allowedRoles.includes(user.role)) {
    // role ไม่ตรงกับเว็บนี้: ยกเลิก session ที่เพิ่งได้มาทันที
    await backend('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return json({ message: 'บัญชีนี้ไม่มีสิทธิ์เข้าเว็บนี้', code: 'WRONG_APP' }, 403);
  }
  const headers = new Headers();
  const names = cookieNames(app);
  headers.append('Set-Cookie', cookie(names.token, token, SESSION_MAX_AGE));
  headers.append('Set-Cookie', cookie(names.role, user.role, SESSION_MAX_AGE));
  return json({ user }, 200, headers);
}

/** POST /api/auth/logout (หรือ GET พร้อม ?next= เพื่อ redirect กลับหน้า login) */
export async function handleLogout(req: Request, app: AppConfig): Promise<Response> {
  const token = readCookie(req.headers.get('cookie'), cookieNames(app).token);
  if (token) {
    await backend('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  const headers = new Headers();
  clearCookies(app, headers);
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const next = url.searchParams.get('next') ?? '/login';
    // กัน open redirect: รับเฉพาะ path ภายในเว็บ
    const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/login';
    headers.set('Location', new URL(safe, url).toString());
    return new Response(null, { status: 303, headers });
  }
  return json({ ok: true }, 200, headers);
}

/** /api/proxy/* → backend พร้อมแนบ token จาก cookie */
export async function handleProxy(req: Request, app: AppConfig, path: string[]): Promise<Response> {
  const token = readCookie(req.headers.get('cookie'), cookieNames(app).token);
  if (!token)
    return json({ message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', code: 'UNAUTHORIZED' }, 401);

  const url = new URL(req.url);
  const target = `/${path.map(encodeURIComponent).join('/')}${url.search}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  const contentType = req.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;
  const mockError = req.headers.get('x-mock-error');
  if (mockError && apiMode() === 'mock') headers['x-mock-error'] = mockError;

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const res = await backend(target, {
    method: req.method,
    headers,
    body: hasBody ? await req.text() : undefined,
  });

  const out = new Headers({
    'Content-Type': res.headers.get('content-type') ?? 'application/json',
  });
  if (res.status === 401) clearCookies(app, out);
  return new Response(await res.text(), { status: res.status, headers: out });
}

export type SessionResult =
  | { status: 'ok'; user: User }
  | { status: 'none' | 'expired' | 'forbidden' | 'error' };

/** ตรวจ session ฝั่ง server component (เรียก /auth/me ด้วย token จริง ไม่เชื่อ cookie role) */
export async function getSession(
  cookieHeader: string | null,
  app: AppConfig,
): Promise<SessionResult> {
  const token = readCookie(cookieHeader, cookieNames(app).token);
  if (!token) return { status: 'none' };
  const res = await backend('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) return { status: 'expired' };
  if (!res.ok) return { status: 'error' };
  const user = userSchema.safeParse(await res.json().catch(() => null));
  if (!user.success) return { status: 'error' };
  if (!app.allowedRoles.includes(user.data.role)) return { status: 'forbidden' };
  return { status: 'ok', user: user.data };
}
