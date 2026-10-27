import { delay, http, HttpResponse, type DefaultBodyType, type StrictRequest } from 'msw';
import {
  activeStatuses,
  checklistTemplateInputSchema,
  dateRangeSchema,
  equipmentInputSchema,
  incidentCloseSchema,
  incidentCreateSchema,
  incidentPatchSchema,
  isoDate,
  KIOSK_ZONE_ID,
  loginInputSchema,
  problemTypeInputSchema,
  siteInputSchema,
  slaSettingSchema,
  technicianPhoneError,
  userInputSchema,
  type DateRange,
  type Incident,
  type Priority,
  type Role,
  type User,
} from '../schemas';
import { eachDay, minutesBetween, slaDueAt, slaSortRank, slaState, toSiteDate } from '../calc';
import { priorityLabel, statusLabel } from '../labels';
import { getDb } from './db';
import { z } from 'zod';

/**
 * MSW handlers จำลอง backend CIT
 * path ขึ้นต้นด้วย `*` จึงใช้ได้ทั้ง mock server (http://localhost:4000/...)
 * และใน test ที่เรียกผ่าน `/api/proxy/...`
 */
const SESSION_TTL_MS = 8 * 3_600_000;

type Req = StrictRequest<DefaultBodyType>;

const env = (key: string) => (typeof process !== 'undefined' ? process.env[key] : undefined);

/** จำลองเครือข่ายช้าและ error: MOCK_DELAY_MS, MOCK_ERROR_RATE (0–1) หรือ header x-mock-error */
async function simulate(request: Req) {
  const base = Number(env('MOCK_DELAY_MS') ?? 0);
  if (base > 0) await delay(base + Math.random() * base);
  const forced = request.headers.get('x-mock-error');
  if (forced) return fail(Number(forced) || 500, 'จำลองข้อผิดพลาดของเซิร์ฟเวอร์');
  const rate = Number(env('MOCK_ERROR_RATE') ?? 0);
  if (request.method === 'GET' && rate > 0 && Math.random() < rate) {
    return fail(500, 'ระบบขัดข้องชั่วคราว (จำลอง)');
  }
  return null;
}

function fail(status: number, message: string, code?: string) {
  return HttpResponse.json({ message, code }, { status });
}

function authUser(request: Req): User | null {
  const db = getDb();
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const session = db.sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    db.sessions.delete(token);
    return null;
  }
  const user = db.users.find((u) => u.id === session.userId && u.active);
  return user ?? null;
}

type Handler = (ctx: {
  request: Req;
  params: Record<string, string>;
  user: User;
  url: URL;
}) => Response | Promise<Response>;

/** ห่อ handler: จำลอง delay/error → ตรวจ token → ตรวจ role */
function guarded(roles: Role[] | 'any', fn: Handler) {
  return async ({
    request,
    params,
  }: {
    request: Req;
    params: Record<string, string | readonly string[] | undefined>;
  }) => {
    const simulated = await simulate(request);
    if (simulated) return simulated;
    const user = authUser(request);
    if (!user) return fail(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'UNAUTHORIZED');
    if (roles !== 'any' && !roles.includes(user.role)) {
      return fail(403, 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้', 'FORBIDDEN');
    }
    return fn({
      request,
      params: params as Record<string, string>,
      user,
      url: new URL(request.url),
    });
  };
}

const ALL: Role[] = ['executive', 'admin', 'operator'];
const SERVICE: Role[] = ['admin', 'operator'];
const ADMIN: Role[] = ['admin'];

async function body<T>(request: Req, schema: z.ZodType<T>) {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: fail(400, first?.message ?? 'ข้อมูลไม่ถูกต้อง', 'VALIDATION'),
    } as const;
  }
  return { ok: true, data: parsed.data } as const;
}

function rangeOf(url: URL): DateRange | Response {
  const parsed = dateRangeSchema.safeParse({
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
  });
  if (!parsed.success || parsed.data.from > parsed.data.to) {
    return fail(400, 'ช่วงวันที่ไม่ถูกต้อง', 'RANGE');
  }
  return parsed.data;
}

const list = (url: URL, key: string) => url.searchParams.get(key)?.split(',').filter(Boolean) ?? [];

function sortIncidents(items: Incident[], now: Date) {
  return [...items].sort((a, b) => {
    const ra = slaSortRank(slaState(a, now));
    const rb = slaSortRank(slaState(b, now));
    if (ra !== rb) return ra - rb;
    if (ra <= 2) return a.slaDueAt.localeCompare(b.slaDueAt);
    return b.openedAt.localeCompare(a.openedAt);
  });
}

function setEquipmentStatus(equipmentId: string) {
  const db = getDb();
  const eq = db.equipment.find((e) => e.id === equipmentId);
  if (!eq) return;
  const stillOpen = db.incidents.some(
    (i) => i.equipmentId === equipmentId && activeStatuses.includes(i.status),
  );
  if (stillOpen) {
    eq.status = 'down';
    eq.statusNote ??= 'ตรวจสัญญาณไม่พบ (ไม่มี heartbeat)';
  } else {
    eq.status = 'normal';
    eq.statusNote = null;
    eq.lastHeartbeatAt = new Date().toISOString();
  }
}

export const handlers = [
  // ---------- Auth ----------
  http.post('*/auth/login', async ({ request }) => {
    const simulated = await simulate(request);
    if (simulated) return simulated;
    const parsed = await body(request, loginInputSchema);
    if (!parsed.ok) return parsed.error;
    const db = getDb();
    const code = parsed.data.employeeCode.trim().toUpperCase();
    const user = db.users.find((u) => u.employeeCode.toUpperCase() === code);
    if (!user || db.passwords.get(user.id) !== parsed.data.password) {
      return fail(401, 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง', 'INVALID_CREDENTIALS');
    }
    if (!user.active) return fail(403, 'บัญชีนี้ถูกปิดใช้งาน ติดต่อผู้ดูแลระบบ', 'INACTIVE');
    const token = crypto.randomUUID();
    db.sessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
    return HttpResponse.json({ token, user });
  }),

  http.post('*/auth/logout', ({ request }) => {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (token) getDb().sessions.delete(token);
    return HttpResponse.json({ ok: true });
  }),

  http.get(
    '*/auth/me',
    guarded('any', ({ user }) => HttpResponse.json(user)),
  ),

  // ---------- Executive dashboard ----------
  http.get(
    '*/dashboard/summary',
    guarded(ALL, ({ url }) => {
      const range = rangeOf(url);
      if (range instanceof Response) return range;
      return HttpResponse.json(getDb().summary(range));
    }),
  ),

  http.get(
    '*/dashboard/revenue-trend',
    guarded(ALL, ({ url }) => {
      const range = rangeOf(url);
      if (range instanceof Response) return range;
      const byDate = new Map<string, number>(eachDay(range).map((d) => [d, 0]));
      for (const r of getDb().rows(range))
        byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.revenue);
      return HttpResponse.json([...byDate].map(([date, revenue]) => ({ date, revenue })));
    }),
  ),

  http.get(
    '*/dashboard/traffic-heatmap',
    guarded(ALL, ({ url }) => {
      const range = rangeOf(url);
      if (range instanceof Response) return range;
      const cells = new Map<
        string,
        { siteId: string; hour: number; carsIn: number; carsOut: number }
      >();
      for (const r of getDb().rows(range)) {
        const key = `${r.siteId}:${r.hour}`;
        const cell = cells.get(key) ?? { siteId: r.siteId, hour: r.hour, carsIn: 0, carsOut: 0 };
        cell.carsIn += r.carsIn;
        cell.carsOut += r.carsOut;
        cells.set(key, cell);
      }
      return HttpResponse.json({ days: eachDay(range).length, cells: [...cells.values()] });
    }),
  ),

  // ยอดรับเงินแยกจุดรับเงิน: ทางออกแต่ละช่อง ~65%, Kiosk Payment 1–3 ~35% (สัดส่วนสมมติของ mock)
  http.get(
    '*/dashboard/revenue-points',
    guarded(ALL, ({ url }) => {
      const range = rangeOf(url);
      if (range instanceof Response) return range;
      const db = getDb();
      const EXIT_SHARE = 0.65;
      const KIOSK_W = [0.31, 0.27, 0.23, 0.19];
      const bySite = new Map<string, { amount: number; count: number }>();
      let kioskAmount = 0;
      let kioskCount = 0;
      for (const r of db.rows(range)) {
        if (!r.revenue) continue;
        const cur = bySite.get(r.siteId) ?? { amount: 0, count: 0 };
        cur.amount += Math.round(r.revenue * EXIT_SHARE);
        cur.count += Math.round(r.carsOut * EXIT_SHARE);
        bySite.set(r.siteId, cur);
        kioskAmount += r.revenue - Math.round(r.revenue * EXIT_SHARE);
        kioskCount += r.carsOut - Math.round(r.carsOut * EXIT_SHARE);
      }
      const exits = db.sites
        .filter((s) => s.active && s.direction === 'out')
        .map((s) => ({
          siteId: s.id,
          code: s.code,
          name: s.name,
          group: s.group,
          ...(bySite.get(s.id) ?? { amount: 0, count: 0 }),
        }));
      const kiosks = db.equipment
        .filter((e) => e.type === 'kiosk')
        .map((e, i) => ({
          id: e.id,
          name: e.name,
          amount: Math.round(kioskAmount * (KIOSK_W[i] ?? 0.1)),
          count: Math.round(kioskCount * (KIOSK_W[i] ?? 0.1)),
        }));
      return HttpResponse.json({ channel: 'qr', exits, kiosks });
    }),
  ),

  http.get(
    '*/equipment/status',
    guarded(ALL, () => {
      const db = getDb();
      // Kiosk Payment แยกเป็นกลุ่มของตัวเอง (ไม่สังกัดป้อม)
      const kioskItems = db.equipment.filter((e) => e.siteId === KIOSK_ZONE_ID);
      const kc = (s: string) => kioskItems.filter((e) => e.status === s).length;
      const kioskRow = kioskItems.length
        ? [
            {
              site: {
                id: KIOSK_ZONE_ID,
                code: 'KIOSK',
                name: 'Kiosk Payment',
                direction: 'out' as const,
                group: 'Kiosk Payment',
                active: true,
              },
              normal: kc('normal'),
              stuck: kc('stuck'),
              down: kc('down'),
              items: kioskItems,
            },
          ]
        : [];
      return HttpResponse.json([
        ...db.sites
          .filter((s) => s.active)
          .map((site) => {
            const items = db.equipment.filter((e) => e.siteId === site.id);
            const count = (s: string) => items.filter((e) => e.status === s).length;
            return {
              site,
              normal: count('normal'),
              stuck: count('stuck'),
              down: count('down'),
              items,
            };
          }),
        ...kioskRow,
      ]);
    }),
  ),

  // ---------- Incidents ----------
  http.get(
    '*/incidents',
    guarded(ALL, ({ url }) => {
      const db = getDb();
      const now = new Date();
      const q = url.searchParams.get('q')?.trim().toLowerCase();
      const statuses = list(url, 'status');
      const prios = list(url, 'priority');
      const siteId = url.searchParams.get('siteId');
      const assigneeId = url.searchParams.get('assigneeId');
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const limit = Number(url.searchParams.get('limit') ?? 0);

      let items = db.incidents.filter((inc) => {
        if (statuses.length && !statuses.includes(inc.status)) return false;
        if (prios.length && !prios.includes(inc.priority)) return false;
        if (siteId && inc.siteId !== siteId) return false;
        if (
          assigneeId === 'none'
            ? inc.assigneeId !== null
            : assigneeId && inc.assigneeId !== assigneeId
        )
          return false;
        const day = toSiteDate(new Date(inc.openedAt));
        if (from && day < from) return false;
        if (to && day > to) return false;
        if (q) {
          const eq = db.equipment.find((e) => e.id === inc.equipmentId);
          const site = db.sites.find((s) => s.id === inc.siteId);
          const hay =
            `${inc.code} ${inc.description} ${eq?.name ?? ''} ${site?.name ?? ''} ${site?.code ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      items = sortIncidents(items, now);
      if (limit > 0) items = items.slice(0, limit);
      return HttpResponse.json(items);
    }),
  ),

  http.get(
    '*/incidents/:id',
    guarded(ALL, ({ params }) => {
      const db = getDb();
      const inc = db.incidents.find((i) => i.id === params.id || i.code === params.id);
      if (!inc) return fail(404, 'ไม่พบงานแจ้งซ่อมนี้');
      const logs = db.logs
        .filter((l) => l.incidentId === inc.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return HttpResponse.json({ ...inc, logs });
    }),
  ),

  http.post(
    '*/incidents',
    guarded(SERVICE, async ({ request, user }) => {
      const parsed = await body(request, incidentCreateSchema);
      if (!parsed.ok) return parsed.error;
      const db = getDb();
      const input = parsed.data;
      const eq = db.equipment.find((e) => e.id === input.equipmentId);
      if (!eq || eq.siteId !== input.siteId) return fail(400, 'อุปกรณ์ไม่ตรงกับจุดที่เลือก');
      if (!db.problemTypes.some((p) => p.id === input.problemTypeId && p.active)) {
        return fail(400, 'ประเภทปัญหาไม่ถูกต้อง');
      }
      const openedAt = new Date().toISOString();
      const inc: Incident = {
        id: db.id('inc'),
        code: db.nextIncidentCode(),
        siteId: input.siteId,
        equipmentId: input.equipmentId,
        problemTypeId: input.problemTypeId,
        description: input.description,
        priority: input.priority,
        status: 'open',
        assigneeId: null,
        cause: null,
        parts: null,
        photosBefore: input.photosBefore,
        photosAfter: [],
        openedAt,
        respondedAt: null,
        resolvedAt: null,
        slaDueAt: slaDueAt(openedAt, input.priority, db.slaSettings),
        inspectionId: input.inspectionId ?? null,
      };
      db.incidents.push(inc);
      eq.status = 'down';
      eq.statusNote = `แจ้งซ่อม ${inc.code}`;
      const problem = db.problemTypes.find((p) => p.id === input.problemTypeId)!;
      db.pushLog(inc.id, user, `เปิดงาน: ${problem.name}`, 'web', Date.now());
      if (inc.inspectionId) {
        const insp = db.inspections.find((i) => i.id === inc.inspectionId);
        insp?.incidentIds.push(inc.id);
      }
      return HttpResponse.json(inc, { status: 201 });
    }),
  ),

  http.patch(
    '*/incidents/:id',
    guarded(SERVICE, async ({ request, params, user }) => {
      const parsed = await body(request, incidentPatchSchema);
      if (!parsed.ok) return parsed.error;
      const db = getDb();
      const inc = db.incidents.find((i) => i.id === params.id);
      if (!inc) return fail(404, 'ไม่พบงานแจ้งซ่อมนี้');
      if (inc.status === 'closed' || inc.status === 'cancelled') {
        return fail(409, 'งานนี้ปิดแล้ว แก้ไขไม่ได้', 'CLOSED');
      }
      const patch = parsed.data;
      if (patch.status === 'closed') {
        return fail(400, 'ปิดงานผ่านปุ่ม "ปิดงาน" เพื่อบันทึกสาเหตุและรูปหลังซ่อม');
      }
      const now = Date.now();
      if (patch.assigneeId !== undefined && patch.assigneeId !== inc.assigneeId) {
        const tech = patch.assigneeId ? db.users.find((u) => u.id === patch.assigneeId) : null;
        if (patch.assigneeId && (!tech || !tech.isTechnician || !tech.active)) {
          return fail(400, 'ผู้รับผิดชอบต้องเป็นช่างที่เปิดใช้งานอยู่');
        }
        inc.assigneeId = patch.assigneeId;
        db.pushLog(inc.id, user, tech ? `มอบหมายให้ ${tech.name}` : 'ยกเลิกการมอบหมาย', 'web', now);
        if (tech && inc.status === 'open' && !patch.status) inc.status = 'assigned';
      }
      if (patch.priority && patch.priority !== inc.priority) {
        db.pushLog(
          inc.id,
          user,
          `เปลี่ยนความเร่งด่วน ${priorityLabel[inc.priority]} → ${priorityLabel[patch.priority]}`,
          'web',
          now,
        );
        inc.priority = patch.priority;
        inc.slaDueAt = slaDueAt(inc.openedAt, inc.priority, db.slaSettings);
      }
      if (patch.status && patch.status !== inc.status) {
        if (patch.status !== 'open' && patch.status !== 'cancelled' && !inc.assigneeId) {
          return fail(400, 'มอบหมายช่างก่อนเปลี่ยนสถานะนี้');
        }
        db.pushLog(
          inc.id,
          user,
          `เปลี่ยนสถานะ ${statusLabel[inc.status]} → ${statusLabel[patch.status]}`,
          'web',
          now,
        );
        inc.status = patch.status;
        if (patch.status === 'in_progress' && !inc.respondedAt)
          inc.respondedAt = new Date(now).toISOString();
      }
      if (patch.cause !== undefined) inc.cause = patch.cause;
      if (patch.parts !== undefined) inc.parts = patch.parts;
      setEquipmentStatus(inc.equipmentId);
      return HttpResponse.json(inc);
    }),
  ),

  http.post(
    '*/incidents/:id/close',
    guarded(SERVICE, async ({ request, params, user }) => {
      const parsed = await body(request, incidentCloseSchema);
      if (!parsed.ok) return parsed.error;
      const db = getDb();
      const inc = db.incidents.find((i) => i.id === params.id);
      if (!inc) return fail(404, 'ไม่พบงานแจ้งซ่อมนี้');
      if (inc.status === 'closed' || inc.status === 'cancelled')
        return fail(409, 'งานนี้ปิดไปแล้ว');
      if (!inc.assigneeId) return fail(400, 'มอบหมายช่างก่อนปิดงาน');
      const now = new Date().toISOString();
      inc.status = 'closed';
      inc.cause = parsed.data.cause;
      inc.parts = parsed.data.parts || null;
      inc.photosAfter = [...inc.photosAfter, ...parsed.data.photosAfter];
      inc.resolvedAt = now;
      inc.respondedAt ??= now;
      db.pushLog(inc.id, user, `ปิดงาน: ${inc.cause}`, 'web', Date.now());
      setEquipmentStatus(inc.equipmentId);
      return HttpResponse.json(inc);
    }),
  ),

  http.post(
    '*/incidents/:id/logs',
    guarded(SERVICE, async ({ request, params, user }) => {
      const parsed = await body(
        request,
        z.object({ message: z.string().trim().min(1, 'พิมพ์ข้อความก่อนบันทึก').max(1000) }),
      );
      if (!parsed.ok) return parsed.error;
      const db = getDb();
      const inc = db.incidents.find((i) => i.id === params.id);
      if (!inc) return fail(404, 'ไม่พบงานแจ้งซ่อมนี้');
      db.pushLog(inc.id, user, parsed.data.message, 'web', Date.now());
      return HttpResponse.json(db.logs[db.logs.length - 1], { status: 201 });
    }),
  ),

  http.post(
    '*/incidents/:id/photos',
    guarded(SERVICE, async ({ request, params, user }) => {
      const parsed = await body(
        request,
        z.object({ kind: z.enum(['before', 'after']), photos: z.array(z.string()).min(1).max(6) }),
      );
      if (!parsed.ok) return parsed.error;
      const db = getDb();
      const inc = db.incidents.find((i) => i.id === params.id);
      if (!inc) return fail(404, 'ไม่พบงานแจ้งซ่อมนี้');
      const target = parsed.data.kind === 'before' ? inc.photosBefore : inc.photosAfter;
      if (target.length + parsed.data.photos.length > 12)
        return fail(400, 'แนบรูปได้ไม่เกิน 12 รูปต่อประเภท');
      target.push(...parsed.data.photos);
      db.pushLog(
        inc.id,
        user,
        `แนบรูป${parsed.data.kind === 'before' ? 'ก่อนซ่อม' : 'หลังซ่อม'} ${parsed.data.photos.length} รูป`,
        'web',
        Date.now(),
      );
      return HttpResponse.json(inc);
    }),
  ),

  // ---------- Inspections ----------
  http.get(
    '*/inspections',
    guarded(SERVICE, ({ url }) => {
      const date = url.searchParams.get('date') ?? getDb().today();
      if (!isoDate.safeParse(date).success) return fail(400, 'วันที่ไม่ถูกต้อง');
      return HttpResponse.json(getDb().inspections.filter((i) => i.date === date));
    }),
  ),
  http.get(
    '*/inspections/:id',
    guarded(SERVICE, ({ params }) => {
      const insp = getDb().inspections.find((i) => i.id === params.id);
      return insp ? HttpResponse.json(insp) : fail(404, 'ไม่พบผลตรวจนี้');
    }),
  ),

  // ---------- KPI ----------
  http.get(
    '*/kpi/technicians',
    guarded(SERVICE, ({ url }) => {
      const range = rangeOf(url);
      if (range instanceof Response) return range;
      const db = getDb();
      const inRange = db.incidents.filter((i) => {
        const d = toSiteDate(new Date(i.openedAt));
        return d >= range.from && d <= range.to && i.status !== 'cancelled';
      });
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
      return HttpResponse.json(
        db.users
          .filter((u) => u.isTechnician)
          .map((user) => {
            const mine = inRange.filter((i) => i.assigneeId === user.id);
            const closed = mine.filter((i) => i.status === 'closed' && i.resolvedAt);
            const met = closed.filter((i) => i.resolvedAt! <= i.slaDueAt);
            return {
              user,
              total: mine.length,
              closed: closed.length,
              open: mine.filter((i) => activeStatuses.includes(i.status)).length,
              avgResponseMinutes: avg(
                mine
                  .filter((i) => i.respondedAt)
                  .map((i) => minutesBetween(i.openedAt, i.respondedAt!)),
              ),
              avgResolveMinutes: avg(closed.map((i) => minutesBetween(i.openedAt, i.resolvedAt!))),
              slaMet: met.length,
              slaMeasured: closed.length,
            };
          }),
      );
    }),
  ),

  http.get(
    '*/kpi/sla',
    guarded(SERVICE, ({ url }) => {
      const range = rangeOf(url);
      if (range instanceof Response) return range;
      const db = getDb();
      const closed = db.incidents.filter((i) => {
        if (i.status !== 'closed' || !i.resolvedAt) return false;
        const d = toSiteDate(new Date(i.resolvedAt));
        return d >= range.from && d <= range.to;
      });
      const prios: Priority[] = ['critical', 'high', 'medium', 'low'];
      const byPriority = prios.map((priority) => {
        const xs = closed.filter((i) => i.priority === priority);
        return {
          priority,
          measured: xs.length,
          met: xs.filter((i) => i.resolvedAt! <= i.slaDueAt).length,
        };
      });
      const trend = eachDay(range).map((date) => {
        const xs = closed.filter((i) => toSiteDate(new Date(i.resolvedAt!)) === date);
        return {
          date,
          measured: xs.length,
          met: xs.filter((i) => i.resolvedAt! <= i.slaDueAt).length,
        };
      });
      return HttpResponse.json({ byPriority, trend });
    }),
  ),

  // ---------- Master data ----------
  http.get(
    '*/users',
    guarded(SERVICE, () => HttpResponse.json(getDb().users)),
  ),
  http.post(
    '*/users',
    guarded(ADMIN, async ({ request }) => {
      const parsed = await body(request, userInputSchema.required({ password: true }));
      if (!parsed.ok) return parsed.error;
      const phoneError = technicianPhoneError(parsed.data);
      if (phoneError) return fail(400, phoneError);
      const db = getDb();
      const code = parsed.data.employeeCode.toUpperCase();
      if (db.users.some((u) => u.employeeCode.toUpperCase() === code)) {
        return fail(409, `รหัสพนักงาน ${code} มีอยู่แล้ว`, 'DUPLICATE');
      }
      const user: User = {
        id: db.id('usr'),
        employeeCode: code,
        name: parsed.data.name,
        role: parsed.data.role,
        isTechnician: parsed.data.isTechnician,
        position: parsed.data.position || null,
        phone: parsed.data.phone || null,
        active: true,
      };
      db.users.push(user);
      db.passwords.set(user.id, parsed.data.password);
      return HttpResponse.json(user, { status: 201 });
    }),
  ),
  http.patch(
    '*/users/:id',
    guarded(ADMIN, async ({ request, params, user: me }) => {
      const parsed = await body(
        request,
        userInputSchema
          .omit({ password: true })
          .partial()
          .extend({ active: z.boolean().optional() }),
      );
      if (!parsed.ok) return parsed.error;
      const db = getDb();
      const target = db.users.find((u) => u.id === params.id);
      if (!target) return fail(404, 'ไม่พบผู้ใช้นี้');
      const phoneError = technicianPhoneError({ ...target, ...parsed.data });
      if (phoneError) return fail(400, phoneError);
      if (
        target.id === me.id &&
        (parsed.data.active === false || (parsed.data.role && parsed.data.role !== 'admin'))
      ) {
        return fail(400, 'ไม่สามารถปิดใช้งานหรือลดสิทธิ์บัญชีของตัวเองได้');
      }
      if (parsed.data.employeeCode) {
        const code = parsed.data.employeeCode.toUpperCase();
        if (db.users.some((u) => u.id !== target.id && u.employeeCode.toUpperCase() === code)) {
          return fail(409, `รหัสพนักงาน ${code} มีอยู่แล้ว`, 'DUPLICATE');
        }
        parsed.data.employeeCode = code;
      }
      Object.assign(target, parsed.data);
      if (target.active === false) {
        for (const [token, s] of db.sessions) if (s.userId === target.id) db.sessions.delete(token);
      }
      return HttpResponse.json(target);
    }),
  ),
  http.post(
    '*/users/:id/reset-password',
    guarded(ADMIN, ({ params }) => {
      const db = getDb();
      const target = db.users.find((u) => u.id === params.id);
      if (!target) return fail(404, 'ไม่พบผู้ใช้นี้');
      const temporaryPassword = `Gip-${Math.random().toString(36).slice(2, 8)}`;
      db.passwords.set(target.id, temporaryPassword);
      return HttpResponse.json({ temporaryPassword });
    }),
  ),

  http.get(
    '*/sites',
    guarded(ALL, () => HttpResponse.json(getDb().sites)),
  ),
  http.post(
    '*/sites',
    guarded(ADMIN, async ({ request }) => {
      const parsed = await body(request, siteInputSchema);
      if (!parsed.ok) return parsed.error;
      const db = getDb();
      const code = parsed.data.code.toUpperCase();
      if (db.sites.some((s) => s.code === code)) return fail(409, `รหัสจุด ${code} มีอยู่แล้ว`);
      const site = { ...parsed.data, code, id: db.id('site') };
      db.sites.push(site);
      return HttpResponse.json(site, { status: 201 });
    }),
  ),
  http.patch(
    '*/sites/:id',
    guarded(ADMIN, async ({ request, params }) => {
      const parsed = await body(request, siteInputSchema.partial());
      if (!parsed.ok) return parsed.error;
      const site = getDb().sites.find((s) => s.id === params.id);
      if (!site) return fail(404, 'ไม่พบจุดติดตั้งนี้');
      Object.assign(site, parsed.data);
      return HttpResponse.json(site);
    }),
  ),

  http.get(
    '*/equipment',
    guarded(ALL, () => HttpResponse.json(getDb().equipment)),
  ),
  http.post(
    '*/equipment',
    guarded(ADMIN, async ({ request }) => {
      const parsed = await body(request, equipmentInputSchema);
      if (!parsed.ok) return parsed.error;
      const db = getDb();
      if (
        parsed.data.siteId !== KIOSK_ZONE_ID &&
        !db.sites.some((s) => s.id === parsed.data.siteId)
      )
        return fail(400, 'ไม่พบจุดติดตั้งที่เลือก');
      const eq = {
        ...parsed.data,
        id: db.id('eq'),
        status: 'normal' as const,
        lastHeartbeatAt: new Date().toISOString(),
        statusNote: null,
      };
      db.equipment.push(eq);
      return HttpResponse.json(eq, { status: 201 });
    }),
  ),
  http.patch(
    '*/equipment/:id',
    guarded(ADMIN, async ({ request, params }) => {
      const parsed = await body(request, equipmentInputSchema.partial());
      if (!parsed.ok) return parsed.error;
      const eq = getDb().equipment.find((e) => e.id === params.id);
      if (!eq) return fail(404, 'ไม่พบอุปกรณ์นี้');
      Object.assign(eq, parsed.data);
      return HttpResponse.json(eq);
    }),
  ),
  http.delete(
    '*/equipment/:id',
    guarded(ADMIN, ({ params }) => {
      const db = getDb();
      const idx = db.equipment.findIndex((e) => e.id === params.id);
      if (idx < 0) return fail(404, 'ไม่พบอุปกรณ์นี้');
      if (db.incidents.some((i) => i.equipmentId === params.id)) {
        return fail(409, 'อุปกรณ์นี้มีประวัติงานซ่อม ลบไม่ได้', 'IN_USE');
      }
      db.equipment.splice(idx, 1);
      return HttpResponse.json({ ok: true });
    }),
  ),

  http.get(
    '*/checklist-templates',
    guarded(SERVICE, () => HttpResponse.json(getDb().checklists)),
  ),
  http.post(
    '*/checklist-templates',
    guarded(ADMIN, async ({ request }) => {
      const parsed = await body(request, checklistTemplateInputSchema);
      if (!parsed.ok) return parsed.error;
      const db = getDb();
      if (db.checklists.some((c) => c.equipmentType === parsed.data.equipmentType)) {
        return fail(409, 'อุปกรณ์ประเภทนี้มีเทมเพลตอยู่แล้ว แก้ไขเทมเพลตเดิมแทน');
      }
      const tpl = {
        ...parsed.data,
        id: db.id('cl'),
        items: parsed.data.items.map((i) => ({ ...i, id: i.id || db.id('ci') })),
      };
      db.checklists.push(tpl);
      return HttpResponse.json(tpl, { status: 201 });
    }),
  ),
  http.patch(
    '*/checklist-templates/:id',
    guarded(ADMIN, async ({ request, params }) => {
      const parsed = await body(request, checklistTemplateInputSchema.partial());
      if (!parsed.ok) return parsed.error;
      const db = getDb();
      const tpl = db.checklists.find((c) => c.id === params.id);
      if (!tpl) return fail(404, 'ไม่พบเทมเพลตนี้');
      Object.assign(tpl, {
        ...parsed.data,
        ...(parsed.data.items && {
          items: parsed.data.items.map((i) => ({ ...i, id: i.id || db.id('ci') })),
        }),
      });
      return HttpResponse.json(tpl);
    }),
  ),
  http.delete(
    '*/checklist-templates/:id',
    guarded(ADMIN, ({ params }) => {
      const db = getDb();
      const idx = db.checklists.findIndex((c) => c.id === params.id);
      if (idx < 0) return fail(404, 'ไม่พบเทมเพลตนี้');
      db.checklists.splice(idx, 1);
      return HttpResponse.json({ ok: true });
    }),
  ),

  http.get(
    '*/problem-types',
    guarded(ALL, () => HttpResponse.json(getDb().problemTypes)),
  ),
  http.post(
    '*/problem-types',
    guarded(ADMIN, async ({ request }) => {
      const parsed = await body(request, problemTypeInputSchema);
      if (!parsed.ok) return parsed.error;
      const db = getDb();
      if (db.problemTypes.some((p) => p.name === parsed.data.name))
        return fail(409, 'มีประเภทปัญหานี้อยู่แล้ว');
      const pt = { ...parsed.data, id: db.id('pt') };
      db.problemTypes.push(pt);
      return HttpResponse.json(pt, { status: 201 });
    }),
  ),
  http.patch(
    '*/problem-types/:id',
    guarded(ADMIN, async ({ request, params }) => {
      const parsed = await body(request, problemTypeInputSchema.partial());
      if (!parsed.ok) return parsed.error;
      const pt = getDb().problemTypes.find((p) => p.id === params.id);
      if (!pt) return fail(404, 'ไม่พบประเภทปัญหานี้');
      Object.assign(pt, parsed.data);
      return HttpResponse.json(pt);
    }),
  ),

  http.delete(
    '*/problem-types/:id',
    guarded(ADMIN, ({ params }) => {
      const db = getDb();
      const idx = db.problemTypes.findIndex((p) => p.id === params.id);
      if (idx < 0) return fail(404, 'ไม่พบประเภทปัญหานี้');
      const used = db.incidents.filter((i) => i.problemTypeId === params.id).length;
      if (used) {
        return fail(
          409,
          `มีงานซ่อม ${used} งานใช้ประเภทนี้อยู่ ลบไม่ได้ ให้ปิดใช้งานแทน`,
          'IN_USE',
        );
      }
      db.problemTypes.splice(idx, 1);
      return HttpResponse.json({ ok: true });
    }),
  ),

  http.get(
    '*/sla-settings',
    guarded(SERVICE, () => HttpResponse.json(getDb().slaSettings)),
  ),
  http.put(
    '*/sla-settings',
    guarded(ADMIN, async ({ request }) => {
      const parsed = await body(
        request,
        z.array(slaSettingSchema).length(4, 'ต้องตั้งค่าครบ 4 ระดับ'),
      );
      if (!parsed.ok) return parsed.error;
      const bad = parsed.data.find((s) => s.responseMinutes > s.resolveMinutes);
      if (bad)
        return fail(400, `ระดับ${priorityLabel[bad.priority]}: เวลาตอบสนองต้องไม่เกินเวลาแก้ไข`);
      getDb().slaSettings = parsed.data;
      return HttpResponse.json(parsed.data);
    }),
  ),

  // ---------- เครื่องมือของ mock ----------
  http.post('*/__mock/liff-tick', () => {
    const log = simulateLiffActivity();
    return HttpResponse.json({ ok: true, log });
  }),
];

/**
 * จำลองช่างอัปเดตงานจาก LINE LIFF
 * เลือกงานที่มีผู้รับผิดชอบแล้ว 1 งาน เพิ่ม log (source: liff) และเลื่อนสถานะไปข้างหน้า
 */
export function simulateLiffActivity() {
  const db = getDb();
  const candidates = db.incidents.filter(
    (i) => i.assigneeId && ['assigned', 'in_progress'].includes(i.status),
  );
  if (!candidates.length) return null;
  const inc = candidates[Math.floor(Math.random() * candidates.length)]!;
  const tech = db.users.find((u) => u.id === inc.assigneeId)!;
  const now = Date.now();
  if (inc.status === 'assigned') {
    inc.status = 'in_progress';
    inc.respondedAt ??= new Date(now).toISOString();
    db.pushLog(inc.id, tech, 'รับงานแล้ว กำลังเดินทางไปหน้างาน', 'liff', now);
  } else {
    const msgs = [
      'ถึงหน้างานแล้ว กำลังตรวจสอบอาการ',
      'เปลี่ยนสายสัญญาณแล้ว กำลังทดสอบ',
      'ทดสอบรถผ่าน 3 คัน ยังสังเกตอาการต่อ',
    ];
    db.pushLog(inc.id, tech, msgs[Math.floor(Math.random() * msgs.length)]!, 'liff', now);
  }
  return db.logs[db.logs.length - 1];
}
