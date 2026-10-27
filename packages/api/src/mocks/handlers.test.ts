import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getDb, resetDb } from './db';
import { handlers } from './handlers';

/** ทดสอบกติกาของ mock backend ที่ UI พึ่งพา (ใช้ handler ชุดเดียวกับ mock server) */
const server = setupServer(...handlers);
const API = 'http://api.test';

beforeAll(() => {
  process.env.MOCK_DELAY_MS = '0';
  server.listen({ onUnhandledRequest: 'error' });
});
afterAll(() => server.close());
beforeEach(() => resetDb());

async function login(code: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeCode: code, password: 'password123' }),
  });
  const body = (await res.json()) as { token: string };
  return (path: string, init: RequestInit = {}) =>
    fetch(`${API}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${body.token}`,
        ...init.headers,
      },
    });
}

describe('mock backend', () => {
  it('รหัสผิดได้ 401 พร้อมข้อความไทย', async () => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ employeeCode: 'ADMIN', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { message: string }).message).toBe(
      'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง',
    );
  });

  it('ไม่มี token ได้ 401 และ ช่างแก้ข้อมูลหลังบ้านไม่ได้ (403)', async () => {
    expect((await fetch(`${API}/incidents`)).status).toBe(401);
    const op = await login('TECH01');
    const res = await op('/problem-types', {
      method: 'POST',
      body: JSON.stringify({ name: 'x', equipmentType: null, active: true }),
    });
    expect(res.status).toBe(403);
  });

  it('เปิดงาน → ได้เลข INC และอุปกรณ์ขัดข้อง → มอบหมาย → ปิดงาน → อุปกรณ์ปกติ', async () => {
    const db = getDb();
    const op = await login('TECH01');
    const eq = db.equipment.find((e) => e.status === 'normal')!;
    const problem = db.problemTypes.find((p) => p.equipmentType === eq.type)!;

    const created = await op('/incidents', {
      method: 'POST',
      body: JSON.stringify({
        siteId: eq.siteId,
        equipmentId: eq.id,
        problemTypeId: problem.id,
        priority: 'high',
        description: 'ไม้กั้นค้าง',
        photosBefore: [],
      }),
    });
    expect(created.status).toBe(201);
    const inc = (await created.json()) as { id: string; code: string; status: string };
    expect(inc.code).toMatch(/^INC-\d{4}$/);
    expect(db.equipment.find((e) => e.id === eq.id)!.status).toBe('down');

    // ปิดก่อนมอบหมายไม่ได้
    const early = await op(`/incidents/${inc.id}/close`, {
      method: 'POST',
      body: JSON.stringify({ cause: 'สายหลวม', photosAfter: ['data:x'] }),
    });
    expect(early.status).toBe(400);

    const tech = db.users.find((u) => u.isTechnician)!;
    const assigned = await op(`/incidents/${inc.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeId: tech.id }),
    });
    expect(((await assigned.json()) as { status: string }).status).toBe('assigned');

    // ไม่มีรูปหลังซ่อมปิดไม่ได้
    const noPhoto = await op(`/incidents/${inc.id}/close`, {
      method: 'POST',
      body: JSON.stringify({ cause: 'สายหลวม', photosAfter: [] }),
    });
    expect(noPhoto.status).toBe(400);

    const closed = await op(`/incidents/${inc.id}/close`, {
      method: 'POST',
      body: JSON.stringify({ cause: 'สายหลวม', photosAfter: ['data:x'] }),
    });
    expect(((await closed.json()) as { status: string }).status).toBe('closed');
    const stillOpen = db.incidents.some(
      (i) => i.equipmentId === eq.id && !['closed', 'cancelled'].includes(i.status),
    );
    expect(db.equipment.find((e) => e.id === eq.id)!.status).toBe(stillOpen ? 'down' : 'normal');

    const detail = (await (await op(`/incidents/${inc.id}`)).json()) as {
      logs: { message: string }[];
    };
    expect(detail.logs.map((l) => l.message)).toEqual(
      expect.arrayContaining([expect.stringContaining('มอบหมายให้'), 'ปิดงาน: สายหลวม']),
    );
  });

  it('admin สร้างผู้ใช้ได้ และรหัสซ้ำได้ 409', async () => {
    const admin = await login('ADMIN');
    const body = {
      employeeCode: 'tech09',
      name: 'ช่างใหม่',
      role: 'operator',
      isTechnician: true,
      phone: '081-111-2222',
      password: 'password123',
    };
    const res = await admin('/users', { method: 'POST', body: JSON.stringify(body) });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { employeeCode: string }).employeeCode).toBe('TECH09');
    expect((await admin('/users', { method: 'POST', body: JSON.stringify(body) })).status).toBe(
      409,
    );
  });

  it('dashboard: ช่วงวันที่ผิดได้ 400, ยอดรับเงินแยกทางออกและ Kiosk 1–3', async () => {
    const ex = await login('EXEC01');
    expect((await ex('/dashboard/summary?from=2026-10-10&to=2026-10-01')).status).toBe(400);
    const today = getDb().today();
    const points = (await (
      await ex(`/dashboard/revenue-points?from=${today}&to=${today}`)
    ).json()) as {
      channel: string;
      exits: unknown[];
      kiosks: { name: string }[];
    };
    expect(points.channel).toBe('qr');
    expect(points.exits).toHaveLength(7);
    expect(points.kiosks.map((k) => k.name)).toEqual(['Kiosk 1', 'Kiosk 2', 'Kiosk 3']);
  });
});
