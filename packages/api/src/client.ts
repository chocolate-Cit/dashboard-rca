import type { z } from 'zod';

/**
 * fetch wrapper ของฝั่ง browser
 * เรียกผ่าน route handler ของ Next.js (`/api/proxy/*`) ซึ่งแนบ token จาก httpOnly cookie ให้
 * UI จึงไม่เคยเห็น token และไม่ต้องรู้ว่าปลายทางเป็น mock หรือ backend จริง
 */
type ClientConfig = {
  baseUrl: string;
  headers: Record<string, string>;
  onUnauthorized: (() => void) | null;
};

const config: ClientConfig = { baseUrl: '/api/proxy', headers: {}, onUnauthorized: null };

export function configureClient(next: Partial<ClientConfig>) {
  Object.assign(config, next);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const statusMessages: Record<number, string> = {
  400: 'ข้อมูลไม่ถูกต้อง',
  401: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  403: 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้',
  404: 'ไม่พบข้อมูลที่ต้องการ',
  409: 'ข้อมูลซ้ำกับที่มีอยู่แล้ว',
  500: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง',
  502: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้',
};

export type Query = Record<string, string | number | boolean | string[] | null | undefined>;

export function toSearch(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
    } else params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export async function request<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  init: { method?: string; query?: Query; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}${path}${toSearch(init.query)}`, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...config.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'เชื่อมต่อเครือข่ายไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  }

  const text = await res.text();
  const data: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    if (res.status === 401) config.onUnauthorized?.();
    const body = data as { message?: string; code?: string } | null;
    throw new ApiError(
      res.status,
      body?.message ?? statusMessages[res.status] ?? statusMessages[500]!,
      body?.code,
    );
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error('[api] response ไม่ตรง schema', path, parsed.error.flatten());
    throw new ApiError(res.status, 'รูปแบบข้อมูลจากเซิร์ฟเวอร์ไม่ถูกต้อง', 'SCHEMA');
  }
  return parsed.data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
