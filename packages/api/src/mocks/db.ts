import { CHECKPOINTS as CP_LIST, checkpointLabel } from '../checkpoints';
import {
  addDays,
  DEFAULT_SLA,
  eachDay,
  previousRange,
  slaDueAt,
  toSiteDate,
  toSiteHour,
} from '../calc';
import type {
  ChecklistTemplate,
  DateRange,
  Equipment,
  EquipmentType,
  Incident,
  IncidentLog,
  IncidentStatus,
  Inspection,
  ParkingHourly,
  PaymentChannel,
  Priority,
  ProblemType,
  Site,
  SlaSetting,
  User,
} from '../schemas';
import { KIOSK_ZONE_ID } from '../schemas';
import { equipmentTypeLabel } from '../labels';
import { samplePhoto } from './photos';
import { hash, mulberry32, noise, pick, weighted, type Rng } from './random';

/**
 * ฐานข้อมูลจำลองในหน่วยความจำ
 * - seed เหมือนเดิมทุกครั้ง (ใช้ PRNG ที่กำหนดผลได้) แต่อิงจากวันที่ปัจจุบัน
 * - แก้ไขได้ระหว่างใช้งาน ข้อมูลหายเมื่อรีสตาร์ต mock server
 */
export type MockDb = ReturnType<typeof createDb>;

const HISTORY_DAYS = 90;
const INSPECTION_DAYS = 30;
export const MOCK_PASSWORD = 'password123';

/** ป้อมตามผังจริงของลาน: [เลขจุด, ชื่อป้อม, จำนวนทางเข้า, จำนวนทางออก, สัดส่วนปริมาณรถ] */
const CP_NAME = (n: number) => CP_LIST.find((c) => c.n === n)!.name;
const CHECKPOINTS: [number, string, number, number, number][] = [
  [1, CP_NAME(1), 2, 2, 1],
  [2, CP_NAME(2), 2, 2, 0.85],
  [3, CP_NAME(3), 1, 1, 0.45],
  [4, CP_NAME(4), 1, 1, 0.55],
  [5, CP_NAME(5), 1, 1, 0.4],
];
const SITE_SEED: Omit<Site, 'id'>[] = CHECKPOINTS.flatMap(([n, name, ins, outs]) => [
  ...Array.from({ length: ins }, (_, i) => ({
    code: `CP${n}-IN${i + 1}`,
    name: `${name} ทางเข้า ${i + 1}`,
    direction: 'in' as const,
    group: checkpointLabel(n),
    active: true,
  })),
  ...Array.from({ length: outs }, (_, i) => ({
    code: `CP${n}-OUT${i + 1}`,
    name: `${name} ทางออก ${i + 1}`,
    direction: 'out' as const,
    group: checkpointLabel(n),
    active: true,
  })),
]);
const SITE_SCALE: Record<string, number> = Object.fromEntries(
  CHECKPOINTS.map(([n, , , , s]) => [`CP${n}`, s]),
);

const USER_SEED: (Omit<User, 'id' | 'position' | 'phone'> &
  Partial<Pick<User, 'position' | 'phone'>>)[] = [
  {
    employeeCode: 'EXEC01',
    name: 'วรพล ศรีสุข',
    role: 'executive',
    isTechnician: false,
    active: true,
  },
  {
    employeeCode: 'EXEC02',
    name: 'กมลชนก อินทร์แก้ว',
    role: 'executive',
    isTechnician: false,
    active: true,
  },
  {
    employeeCode: 'ADMIN',
    name: 'ธนากร มีชัย',
    role: 'admin',
    isTechnician: false,
    active: true,
    position: 'ผู้ดูแลระบบ CIT',
  },
  {
    employeeCode: 'ADMIN02',
    name: 'สุนิสา วงศ์ใหญ่',
    role: 'admin',
    isTechnician: false,
    active: true,
    position: 'หัวหน้ากะ',
  },
  {
    employeeCode: 'TECH01',
    name: 'สมชาย ใจกล้า',
    role: 'operator',
    isTechnician: true,
    active: true,
    position: 'ช่างเทคนิค',
    phone: '081-234-5671',
  },
  {
    employeeCode: 'TECH02',
    name: 'อนุชา แสงทอง',
    role: 'operator',
    isTechnician: true,
    active: true,
    position: 'ช่างเทคนิค',
    phone: '081-234-5672',
  },
  {
    employeeCode: 'TECH03',
    name: 'ณัฐวุฒิ บุญมา',
    role: 'operator',
    isTechnician: true,
    active: true,
    position: 'ช่างเทคนิค',
    phone: '081-234-5673',
  },
  {
    employeeCode: 'TECH04',
    name: 'จิราพร คำดี',
    role: 'operator',
    isTechnician: true,
    active: true,
    position: 'ช่างเทคนิค',
    phone: '081-234-5674',
  },
  {
    employeeCode: 'TECH05',
    name: 'ประเสริฐ ดวงจันทร์',
    role: 'operator',
    isTechnician: true,
    active: true,
    position: 'ช่างเทคนิค',
    phone: '081-234-5675',
  },
  {
    employeeCode: 'TECH99',
    name: 'ทดสอบ ปิดใช้งาน',
    role: 'operator',
    isTechnician: true,
    active: false,
    position: 'ช่างเทคนิค',
    phone: '081-234-5699',
  },
];

const PROBLEM_SEED: Omit<ProblemType, 'id'>[] = [
  { name: 'ไม้กั้นไม่ยก', equipmentType: 'barrier', active: true },
  { name: 'ไม้กั้นหัก/ชำรุด', equipmentType: 'barrier', active: true },
  { name: 'สลิปติด/ไม่จ่ายสลิป', equipmentType: 'ticket', active: true },
  { name: 'กระดาษสลิปหมด', equipmentType: 'ticket', active: true },
  { name: 'อ่านป้ายทะเบียนไม่ได้', equipmentType: 'lpr', active: true },
  { name: 'กล้องภาพมัว/ไม่มีสัญญาณ', equipmentType: 'lpr', active: true },
  { name: 'รับชำระไม่ได้', equipmentType: 'payment', active: true },
  { name: 'เครื่องอ่าน QR ขัดข้อง', equipmentType: 'payment', active: true },
  { name: 'ตรวจจับรถไม่ได้', equipmentType: 'loop', active: true },
  { name: 'โทรออกไม่ได้/ไม่มีเสียง', equipmentType: 'intercom', active: true },
  { name: 'Kiosk รับชำระไม่ได้', equipmentType: 'kiosk', active: true },
  { name: 'บอร์ดไม่ส่งสัญญาณ (Offline)', equipmentType: 'esp', active: true },
  { name: 'บอร์ดควบคุมไม่ตอบสนอง', equipmentType: 'controller', active: true },
  { name: 'คอมพิวเตอร์ค้าง/ดับ', equipmentType: 'computer', active: true },
  { name: 'กล้องจับใบหน้าไม่มีภาพ', equipmentType: 'face', active: true },
  { name: 'อ่าน QR ไม่ได้', equipmentType: 'qr', active: true },
  { name: 'เซ็นเซอร์ไม่สัมผัสไม่ตอบสนอง', equipmentType: 'notouch', active: true },
  { name: 'เรดาร์ตรวจจับรถไม่ได้', equipmentType: 'radar', active: true },
  { name: 'อื่น ๆ', equipmentType: null, active: true },
];

const CHECKLIST_SEED: Record<EquipmentType, string[]> = {
  // อุปกรณ์ภายในตู้: ไม่มีรายการตรวจประจำวัน (ระบบตรวจสถานะผ่านบอร์ด ESP เอง)
  esp: [],
  controller: [],
  computer: [],
  face: [],
  qr: [],
  notouch: [],
  radar: [],
  barrier: [
    'ไม้กั้นยก-ลงได้ปกติ',
    'เซนเซอร์กันกระแทกทำงาน',
    'ไม่มีเสียงผิดปกติ',
    'สภาพไม้กั้นไม่แตกร้าว',
  ],
  ticket: ['พิมพ์สลิปได้ปกติ', 'กระดาษสลิปคงเหลือเพียงพอ', 'ปุ่มกดและหน้าจอทำงาน'],
  lpr: ['ภาพชัด ไม่มีฝุ่นเกาะเลนส์', 'ไฟส่องสว่างกลางคืนทำงาน'],
  payment: ['พิมพ์ใบเสร็จได้', 'หน้าจอทำงานปกติ'],
  kiosk: ['สแกน QR พร้อมเพย์ได้', 'พิมพ์ใบเสร็จได้', 'หน้าจอสัมผัสตอบสนองปกติ'],
  loop: ['ตรวจจับรถได้ปกติ'],
  intercom: ['โทรออกห้องควบคุมได้', 'เสียงชัดเจน'],
};

const IN_PROFILE = [
  0.04, 0.03, 0.02, 0.02, 0.04, 0.12, 0.38, 0.82, 1, 0.74, 0.5, 0.48, 0.55, 0.5, 0.42, 0.4, 0.44,
  0.5, 0.48, 0.4, 0.3, 0.2, 0.1, 0.06,
];
const OUT_PROFILE = [
  0.06, 0.04, 0.02, 0.02, 0.02, 0.04, 0.08, 0.16, 0.24, 0.3, 0.36, 0.44, 0.58, 0.5, 0.44, 0.46,
  0.62, 0.92, 1, 0.78, 0.56, 0.4, 0.22, 0.1,
];

const LOG_MESSAGES = {
  liff: [
    'รับงานแล้ว กำลังเดินทางไปหน้างาน',
    'ถึงหน้างานแล้ว กำลังตรวจสอบอาการ',
    'พบว่าสายสัญญาณหลวม ขันใหม่แล้ว ทดสอบอยู่',
    'ต้องเปลี่ยนอะไหล่ แจ้งเบิกแล้ว',
    'ทดสอบรถผ่าน 5 คัน ใช้งานได้ปกติ',
    'รีสตาร์ตระบบแล้ว รอสังเกตอาการ 30 นาที',
  ],
  web: [
    'โทรแจ้งช่างแล้ว',
    'ลูกค้าแจ้งซ้ำ เร่งดำเนินการ',
    'ประสานจัดซื้อเรื่องอะไหล่แล้ว',
    'ให้ รปภ. ช่วยยกไม้กั้นด้วยมือชั่วคราว',
  ],
};
const CAUSES = [
  'มอเตอร์ไม้กั้นร้อนเกิน',
  'สายสัญญาณหลวม',
  'เซนเซอร์สกปรก',
  'สลิปติดในช่องจ่าย',
  'ไฟกระชาก ระบบค้าง',
  'อะไหล่เสื่อมตามอายุ',
];
const PARTS = [
  '',
  '',
  'สายแลน 2 เมตร',
  'เซนเซอร์ลูปใหม่ 1 ชุด',
  'ลูกยางไม้กั้น',
  'บอร์ดควบคุม 1 แผ่น',
];

export function createDb(now: Date = new Date()) {
  const rng = mulberry32(20261015);
  let seq = 0;
  const id = (prefix: string) => `${prefix}_${(++seq).toString(36)}`;
  const today = toSiteDate(now);

  const sites: Site[] = SITE_SEED.map((s) => ({ ...s, id: id('site') }));
  const users: User[] = USER_SEED.map((u) => ({
    position: null,
    phone: null,
    ...u,
    id: id('usr'),
  }));
  const passwords = new Map<string, string>(users.map((u) => [u.id, MOCK_PASSWORD]));
  const problemTypes: ProblemType[] = PROBLEM_SEED.map((p) => ({ ...p, id: id('pt') }));
  let slaSettings: SlaSetting[] = DEFAULT_SLA.map((s) => ({ ...s }));

  const equipment: Equipment[] = [];
  // บอร์ด ESP ตาม API Hardware: ทางเข้า ESP-001–007, ทางออก ESP-008–014, Kiosk ESP-015–017
  // (ลำดับจับคู่กับช่องทางเป็นสมมติฐาน รอ Backend ยืนยัน)
  const esp = (n: number) => `ESP-${String(n).padStart(3, '0')}`;
  const boardOf = new Map<string, string>();
  sites.filter((s) => s.direction === 'in').forEach((s, i) => boardOf.set(s.id, esp(i + 1)));
  sites.filter((s) => s.direction === 'out').forEach((s, i) => boardOf.set(s.id, esp(i + 8)));
  const addBoard = (siteId: string, hwCode: string, suffix: string, mainType: EquipmentType) => {
    // Kiosk Payment ใช้แค่เครื่องพิมพ์กับเครื่องอ่าน QR
    const layout = hardwareLayout(hwCode, mainType).filter(
      ([type]) => mainType !== 'kiosk' || type === 'kiosk' || type === 'qr',
    );
    for (const [type, subCode, name] of layout) {
      equipment.push({
        id: id('eq'),
        siteId,
        type,
        name: type === 'kiosk' ? suffix : `${name} ${suffix}`,
        status: 'normal',
        lastHeartbeatAt: now.toISOString(),
        statusNote: null,
        hwCode,
        subCode,
      });
    }
  };
  for (const site of sites) {
    addBoard(
      site.id,
      boardOf.get(site.id)!,
      site.code,
      site.direction === 'in' ? 'ticket' : 'payment',
    );
  }
  // Kiosk Payment 1–3: ตู้ชำระเงินแยกจากป้อม (ไม่สังกัดช่องทางใด)
  for (let k = 1; k <= 3; k++) addBoard(KIOSK_ZONE_ID, esp(14 + k), `Kiosk ${k}`, 'kiosk');

  const checklists: ChecklistTemplate[] = (Object.keys(CHECKLIST_SEED) as EquipmentType[]).map(
    (type) => ({
      id: id('cl'),
      equipmentType: type,
      name: `ตรวจเช็กประจำวัน — ${equipmentTypeLabel[type]}`,
      items: CHECKLIST_SEED[type].map((label) => ({ id: id('ci'), label })),
    }),
  );

  const technicians = () => users.filter((u) => u.isTechnician && u.active);
  const operators = users.filter((u) => u.role !== 'executive' && !u.isTechnician);

  // ---------- งานแจ้งซ่อม ----------
  const incidents: Incident[] = [];
  const logs: IncidentLog[] = [];
  const nowMs = now.getTime();

  function pushLog(
    incidentId: string,
    author: User,
    message: string,
    source: 'web' | 'liff',
    at: number,
  ) {
    logs.push({
      id: id('log'),
      incidentId,
      authorId: author.id,
      authorName: author.name,
      message,
      source,
      createdAt: new Date(at).toISOString(),
    });
  }

  function seedIncident(r: Rng, openedMs: number, status: IncidentStatus) {
    const eq = pick(
      r,
      equipment.filter((e) => e.siteId !== KIOSK_ZONE_ID),
    );
    const candidates = problemTypes.filter(
      (p) => p.equipmentType === eq.type || p.equipmentType === null,
    );
    const problem = pick(r, candidates);
    const priority = weighted<Priority>(r, [
      ['low', 2],
      ['medium', 4],
      ['high', 3],
      ['critical', 1],
    ]);
    const openedAt = new Date(openedMs).toISOString();
    const due = slaDueAt(openedAt, priority, slaSettings);
    const sla = slaSettings.find((s) => s.priority === priority)!;
    const tech = status === 'open' ? null : pick(r, technicians());
    const opener = pick(r, operators);
    const incId = id('inc');
    const respondedMs = tech ? openedMs + sla.responseMinutes * 60_000 * (0.3 + r() * 1.1) : null;
    let resolvedMs: number | null = null;
    if (status === 'closed') {
      // ~82% ทัน SLA
      const factor = r() < 0.82 ? 0.25 + r() * 0.7 : 1.05 + r() * 0.8;
      resolvedMs = Math.min(openedMs + sla.resolveMinutes * 60_000 * factor, nowMs - 60_000);
    }
    const inc: Incident = {
      id: incId,
      code: '',
      siteId: eq.siteId,
      equipmentId: eq.id,
      problemTypeId: problem.id,
      description: `${problem.name} ที่ ${eq.name}${r() < 0.5 ? ' ผู้ใช้บริการแจ้งที่ป้อม' : ' พบจากกล้องวงจรปิด'}`,
      priority,
      status,
      assigneeId: tech?.id ?? null,
      cause: status === 'closed' ? pick(r, CAUSES) : null,
      parts: status === 'closed' ? pick(r, PARTS) || null : null,
      photosBefore: r() < 0.7 ? [samplePhoto(`${eq.name} ก่อนซ่อม`, Math.floor(r() * 100))] : [],
      photosAfter:
        status === 'closed' ? [samplePhoto(`${eq.name} หลังซ่อม`, Math.floor(r() * 100))] : [],
      openedAt,
      respondedAt: respondedMs && respondedMs < nowMs ? new Date(respondedMs).toISOString() : null,
      resolvedAt: resolvedMs ? new Date(resolvedMs).toISOString() : null,
      slaDueAt: due,
      inspectionId: null,
    };
    incidents.push(inc);

    pushLog(incId, opener, `เปิดงาน: ${problem.name}`, 'web', openedMs);
    if (tech) pushLog(incId, opener, `มอบหมายให้ ${tech.name}`, 'web', openedMs + 4 * 60_000);
    if (tech && respondedMs && respondedMs < nowMs) {
      pushLog(incId, tech, LOG_MESSAGES.liff[0]!, 'liff', respondedMs);
      const end = resolvedMs ?? nowMs;
      const extra = Math.floor(r() * 3);
      for (let i = 0; i < extra; i++) {
        const at = respondedMs + ((end - respondedMs) * (i + 1)) / (extra + 2);
        const fromTech = r() < 0.7;
        pushLog(
          incId,
          fromTech ? tech : opener,
          pick(r, fromTech ? LOG_MESSAGES.liff.slice(1) : LOG_MESSAGES.web),
          fromTech ? 'liff' : 'web',
          at,
        );
      }
    }
    if (status === 'waiting_parts')
      pushLog(incId, tech!, 'ต้องเปลี่ยนอะไหล่ แจ้งเบิกแล้ว', 'liff', nowMs - 40 * 60_000);
    if (resolvedMs) pushLog(incId, opener, `ปิดงาน: ${inc.cause}`, 'web', resolvedMs);
    if (status === 'cancelled')
      pushLog(incId, opener, 'ยกเลิก: แจ้งซ้ำกับงานเดิม', 'web', openedMs + 20 * 60_000);
    return inc;
  }

  // งานที่ปิดแล้วกระจายตลอด 90 วัน
  for (let i = 0; i < 50; i++) {
    const daysAgo = 2 + rng() * (HISTORY_DAYS - 3);
    const hour = 6 + rng() * 16;
    seedIncident(
      rng,
      nowMs - daysAgo * 86_400_000 - hour * 3_600_000 * 0.1,
      weighted(rng, [
        ['closed', 12],
        ['cancelled', 1],
      ]),
    );
  }
  // งานล่าสุด: บางงานเกิน SLA บางงานใกล้เกิน
  const recent: [IncidentStatus, number][] = [
    ['open', 0.3],
    ['open', 2.5],
    ['assigned', 1.2],
    ['assigned', 6],
    ['in_progress', 3.5],
    ['in_progress', 9],
    ['in_progress', 20],
    ['waiting_parts', 30],
    ['closed', 26],
    ['closed', 5],
    ['closed', 40],
  ];
  for (const [status, hoursAgo] of recent) seedIncident(rng, nowMs - hoursAgo * 3_600_000, status);

  incidents.sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  incidents.forEach((inc, i) => (inc.code = formatCode(i + 1)));
  let incidentSeq = incidents.length;
  for (const inc of incidents) {
    if (inc.status !== 'closed' && inc.status !== 'cancelled') {
      const eq = equipment.find((e) => e.id === inc.equipmentId);
      if (eq) {
        eq.status = 'down';
        eq.lastHeartbeatAt = inc.openedAt;
        eq.statusNote = 'ตรวจสัญญาณไม่พบ (ไม่มี heartbeat)';
      }
    }
  }

  // อุปกรณ์ที่ทำงานค้าง (ยังมีสัญญาณ) ตัวอย่าง 2 เครื่อง
  const stuckSeed: [EquipmentType, string][] = [
    ['barrier', 'ไม้กั้นยกค้าง 25 นาที'],
    ['ticket', 'เครื่องค้าง ไม่ตอบสนองปุ่มกดรับสลิป 12 นาที'],
  ];
  for (const [type, note] of stuckSeed) {
    const eq = equipment.find(
      (e) => e.type === type && e.status === 'normal' && !e.siteId.endsWith('_2'),
    );
    if (eq) {
      eq.status = 'stuck';
      eq.statusNote = note;
    }
  }

  // ---------- ตรวจเช็กประจำวัน ----------
  const inspections: Inspection[] = [];
  const currentHour = toSiteHour(now);
  for (let d = INSPECTION_DAYS - 1; d >= 0; d--) {
    const date = addDays(today, -d);
    for (const eq of equipment) {
      const key = `${date}:${eq.id}`;
      // วันนี้: ตรวจไล่ไปตามเวลา (เริ่ม 7 โมง) จุดหลัง ๆ ยังไม่ตรวจ
      const siteIndex = sites.findIndex((s) => s.id === eq.siteId);
      if (
        d === 0 &&
        (currentHour < 7 || siteIndex > Math.min(sites.length - 1, (currentHour - 7) * 2))
      )
        continue;
      if (d > 0 && noise(`skip:${key}`) < 0.03) continue;
      const tpl = checklists.find((c) => c.equipmentType === eq.type)!;
      if (tpl.items.length === 0) continue;
      const inspector = technicians()[hash(key) % technicians().length]!;
      const results = tpl.items.map((item, i) => {
        const pass = noise(`pass:${key}:${i}`) > 0.035;
        return {
          itemId: item.id,
          label: item.label,
          pass,
          note: pass ? null : 'พบความผิดปกติ ต้องตรวจซ้ำ',
          photo:
            pass && noise(`photo:${key}:${i}`) > 0.15
              ? null
              : samplePhoto(`${eq.name}: ${item.label}`, hash(key) % 97),
        };
      });
      const hour = 7 + Math.floor(siteIndex * 0.3) + noise(`h:${key}`) * 1.5;
      inspections.push({
        id: id('insp'),
        siteId: eq.siteId,
        equipmentId: eq.id,
        inspectorId: inspector.id,
        inspectorName: inspector.name,
        date,
        inspectedAt: new Date(
          `${date}T${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}:00+07:00`,
        ).toISOString(),
        results,
        incidentIds: [],
      });
    }
  }

  // ---------- ข้อมูลลานจอด (คำนวณสด ไม่เก็บ) ----------
  const historyStart = addDays(today, -(HISTORY_DAYS - 1));

  function hourly(date: string, site: Site, hour: number): ParkingHourly {
    const empty: ParkingHourly = {
      date,
      siteId: site.id,
      hour,
      carsIn: 0,
      carsOut: 0,
      revenue: 0,
      byChannel: { cash: 0, credit: 0, ewallet: 0, qr: 0 },
    };
    // ใช้วันปัจจุบันตามนาฬิกาจริง (ไม่ใช่วันที่เปิด mock) ข้ามเที่ยงคืนแล้วตัวเลขวันใหม่ยังวิ่งต่อ
    const liveToday = toSiteDate(new Date());
    if (date < historyStart || date > liveToday) return empty;
    let fraction = 1;
    if (date === liveToday) {
      const h = toSiteHour(new Date());
      if (hour > h) return empty;
      if (hour === h) fraction = new Date().getMinutes() / 60;
    }
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.62 : weekday === 5 ? 1.08 : 1;
    const dayIndex = (Date.parse(date) - Date.parse(historyStart)) / 86_400_000;
    const growth = 0.92 + (dayIndex / HISTORY_DAYS) * 0.14;
    const scale = (SITE_SCALE[site.code.split('-')[0]!] ?? 0.5) * 0.62;
    const key = `${date}:${site.code}:${hour}`;
    const jitter = 0.82 + noise(key) * 0.36;
    const base = 132 * scale * weekend * growth * jitter * fraction;
    const profile = site.direction === 'in' ? IN_PROFILE[hour]! : OUT_PROFILE[hour]!;
    const cars = Math.round(base * profile);
    if (site.direction === 'in') return { ...empty, carsIn: cars };

    const fee = 48 + noise(`fee:${key}`) * 34 + (hour >= 17 && hour <= 20 ? 12 : 0);
    const revenue = Math.round(cars * fee);
    // ชำระผ่าน QR พร้อมเพย์อย่างเดียว
    const byChannel: Record<PaymentChannel, number> = {
      cash: 0,
      credit: 0,
      ewallet: 0,
      qr: revenue,
    };
    return { ...empty, carsOut: cars, revenue, byChannel };
  }

  function rows(range: DateRange): ParkingHourly[] {
    const out: ParkingHourly[] = [];
    for (const date of eachDay(range)) {
      for (const site of sites) {
        if (!site.active) continue;
        for (let h = 0; h < 24; h++) out.push(hourly(date, site, h));
      }
    }
    return out;
  }

  /** cutoff: ตัดวันสุดท้ายของช่วงที่ชั่วโมงนี้ (ใช้เทียบ "วันนี้ถึงตอนนี้" กับช่วงเวลาเดียวกันของช่วงก่อน) */
  function totals(range: DateRange, cutoff?: { hour: number; fraction: number }) {
    let revenue = 0;
    let carsIn = 0;
    let carsOut = 0;
    for (const raw of rows(range)) {
      let r = raw;
      if (cutoff && raw.date === range.to) {
        if (raw.hour > cutoff.hour) continue;
        if (raw.hour === cutoff.hour) {
          const f = cutoff.fraction;
          r = {
            ...raw,
            revenue: raw.revenue * f,
            carsIn: Math.round(raw.carsIn * f),
            carsOut: Math.round(raw.carsOut * f),
          };
        }
      }
      revenue += r.revenue;
      carsIn += r.carsIn;
      carsOut += r.carsOut;
    }
    return { revenue, carsIn, carsOut };
  }

  return {
    now: () => new Date(),
    today: () => toSiteDate(new Date()),
    sites,
    users,
    passwords,
    equipment,
    problemTypes,
    checklists,
    incidents,
    logs,
    inspections,
    sessions: new Map<string, { userId: string; expiresAt: number }>(),
    get slaSettings() {
      return slaSettings;
    },
    set slaSettings(next: SlaSetting[]) {
      slaSettings = next;
    },
    id,
    nextIncidentCode: () => formatCode(++incidentSeq),
    pushLog,
    rows,

    summary(range: DateRange) {
      /** รถค้างข้ามคืน (mock): ~4% ของรถเข้าเมื่อวาน ยังจอดอยู่ + วันนี้เข้า − ออก */
      const carsInside = () => {
        const today = toSiteDate(new Date());
        const y = totals({ from: addDays(today, -1), to: addDays(today, -1) });
        const t = totals({ from: today, to: today });
        const carry = Math.round(y.carsIn * 0.04) + Math.max(0, y.carsIn - y.carsOut);
        return Math.max(0, carry + t.carsIn - t.carsOut);
      };
      const prev = previousRange(range);
      const cur = totals(range);
      // ช่วงที่รวมวันนี้ยังไม่จบวัน: เทียบกับช่วงก่อนถึงเวลาเดียวกัน ไม่ใช่ทั้งวัน
      const now = new Date();
      const cutoff =
        range.to === toSiteDate(now)
          ? { hour: toSiteHour(now), fraction: now.getMinutes() / 60 }
          : undefined;
      const before = totals(prev, cutoff);
      return {
        revenue: cur.revenue,
        previousRevenue: before.revenue,
        carsIn: cur.carsIn,
        carsOut: cur.carsOut,
        carsInside: carsInside(),
        previousFrom: prev.from,
        previousTo: prev.to,
      };
    },
  };
}

function formatCode(n: number) {
  return `INC-${String(n).padStart(4, '0')}`;
}

/** อุปกรณ์ 15 ตัวต่อบอร์ด ตามรายการ devices ของ API Hardware */
function hardwareLayout(hwCode: string, printer: EquipmentType): [EquipmentType, string, string][] {
  return [
    ['esp', hwCode, 'บอร์ดควบคุม ESP'],
    ['barrier', 'BARRIER_GATE_01', 'ไม้กั้นรถ'],
    ['computer', 'COMPUTER_01', 'คอมพิวเตอร์'],
    ['controller', 'CONTROL_BOARD_01', 'บอร์ดควบคุม'],
    ['face', 'FACE_CAMERA_01', 'กล้องจับใบหน้า'],
    ['intercom', 'INTERCOM_01', 'อินเตอร์คอม'],
    ['loop', 'LOOP_DETECTOR_01', 'ลูปดีเทคเตอร์'],
    ['lpr', 'LPR_01', 'กล้องอ่านป้ายทะเบียน 1'],
    ['lpr', 'LPR_02', 'กล้องอ่านป้ายทะเบียน 2'],
    ['lpr', 'LPR_03', 'กล้องอ่านป้ายทะเบียน 3'],
    ['lpr', 'LPR_04', 'กล้องอ่านป้ายทะเบียน 4'],
    ['notouch', 'NO_TOUCH_01', 'เซ็นเซอร์ไม่สัมผัส'],
    [printer, 'PRINTER_01', printer === 'kiosk' ? 'เครื่องพิมพ์ Kiosk' : 'เครื่องพิมพ์บัตร'],
    ['qr', 'QR_READER_01', 'เครื่องอ่าน QR'],
    ['radar', 'RADAR_01', 'เรดาร์'],
  ];
}

let shared: MockDb | null = null;
/** ฐานข้อมูลตัวเดียวที่ handler ทุกตัวใช้ร่วมกัน */
export function getDb(): MockDb {
  shared ??= createDb();
  return shared;
}
export function resetDb(now?: Date) {
  shared = createDb(now);
  return shared;
}
