import { checkpointLabel } from '@gip/api';
import * as THREE from 'three';

/**
 * ผังลานจอดจากแบบ (ภาพผังรวม 5 ป้อม)
 * พิกัดอ้างอิงเป็นพิกเซลของภาพผัง แล้วแปลงเป็นหน่วยของฉาก: 8 px = 1 หน่วย
 * x = ทิศตะวันออก, z = ทิศใต้ (ภาพผัง: บน = เหนือ)
 * เป็นภาพจำลองเชิงผัง ไม่ใช่สัดส่วนจริง (รถขยายใหญ่ให้มองเห็นได้)
 */
const PX = 8;
const ORIGIN: [number, number] = [760, 320];
export const P = (px: number, py: number) =>
  new THREE.Vector2((px - ORIGIN[0]) / PX, (py - ORIGIN[1]) / PX);

/* ---------- ถนนภายในหลัก (โค้งยาวตะวันตก → ตะวันออก) ---------- */
const SPINE_PX: [number, number][] = [
  [180, 238],
  [250, 249],
  [318, 261],
  [380, 272],
  [480, 293],
  [600, 316],
  [700, 330],
  [770, 337],
  [870, 342],
  [1000, 333],
  [1100, 318],
  [1185, 300],
  [1290, 263],
  [1420, 214],
];
const curve = new THREE.CatmullRomCurve3(
  SPINE_PX.map(([x, y]) => {
    const p = P(x, y);
    return new THREE.Vector3(p.x, 0, p.y);
  }),
  false,
  'centripetal',
);
const SPINE_LEN = curve.getLength();
export const SPINE_STEP = 1;
/** จุดบนถนนหลักทุก ~1 หน่วย */
export const SPINE = curve
  .getSpacedPoints(Math.round(SPINE_LEN / SPINE_STEP))
  .map((v) => new THREE.Vector2(v.x, v.z));
/** ถนนหลัก 4 เลน (ไป 2 กลับ 2) กว้างเลนละ 2.2 หน่วย · ช่องจอด/ตึก/ผับวางห่างจากขอบถนนตามความกว้างนี้ */
export const LANE_WIDTH = 2.2;
export const MAIN_LANES = 4;
export const ROAD_WIDTH = LANE_WIDTH * MAIN_LANES;

export function tangentAt(i: number) {
  const a = SPINE[Math.max(0, i - 1)]!;
  const b = SPINE[Math.min(SPINE.length - 1, i + 1)]!;
  return b.clone().sub(a).normalize();
}
/** ด้านใต้ของถนน ณ จุด i (ขวามือเมื่อวิ่งไปทางตะวันออก) */
export function southAt(i: number) {
  const t = tangentAt(i);
  return new THREE.Vector2(-t.y, t.x);
}
export function nearestSpine(p: THREE.Vector2) {
  let best = 0;
  let bd = Infinity;
  SPINE.forEach((s, i) => {
    const d = s.distanceToSquared(p);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

/** จุดบนเลนซ้ายของทิศที่กำลังวิ่ง ระหว่าง index a → b */

/* ---------- ป้อม ---------- */
export type CheckpointPlan = {
  n: number;
  label: string;
  /** ตำแหน่งกลางกลุ่มด่าน */
  center: THREE.Vector2;
  /** ทิศจากลานออกสู่ถนนภายนอก */
  outward: THREE.Vector2;
  spineIdx: number;
  /** ระยะถนนนอกด่านที่รถวิ่งเข้า/ออก */
  reach: number;
  /** ขนาดจริงตามแบบติดตั้ง (หน่วยฉาก = 2 ม.) */
  spec: PlazaSpec;
  /** ป้อมบนถนนเชื่อม: ระยะจากกลางป้อมถึงกลางถนนหลัก */
  branch?: number;
  /** สลับตำแหน่งทางเข้า/ออก (ฝั่งเลน + ระยะไม้กั้น) ให้ตรงกับหน้างานจริง */
  flip?: boolean;
};

/** ขนาดลานด่านตามแบบ: กว้างเลน, เกาะกลาง, ไหล่ทาง (หน่วยฉาก) */
export type PlazaSpec = {
  laneW: number;
  island: number;
  shoulder: number;
  islandVisual?: number;
};
const M = 0.5; // 1 เมตร = 0.5 หน่วยฉาก
const spec = (laneW: number, island: number, shoulder: number): PlazaSpec => ({
  laneW: laneW * M,
  island: island * M,
  shoulder: shoulder * M,
});
/** ระยะจากกลางเกาะถึงแนวไม้กั้น (ไม้กั้นเข้า/ออกอยู่คนละปลายเกาะ) */
export const BARRIER_X = 4;
/** ตู้จ่ายสลิป/ตู้ชำระเงินอยู่ก่อนไม้กั้น 5 ม. ตามแบบ */
export const TICKET_GAP = 5 * M;

/** ป้อมบนถนนเชื่อมที่แยกตั้งฉากจากถนนหลัก: วางตรงแนวถนนเชื่อม */
function onBranch(
  n: number,
  label: string,
  at: [number, number],
  side: 1 | -1,
  distance: number,
  reach: number,
  s: PlazaSpec,
  flip = false,
): CheckpointPlan {
  const i = nearestSpine(P(...at));
  const outward = southAt(i).multiplyScalar(side);
  return {
    n,
    label,
    center: SPINE[i]!.clone().addScaledVector(outward, distance),
    outward,
    spineIdx: i,
    reach,
    spec: s,
    branch: distance,
    flip,
  };
}

/** ป้อมที่ตั้งคร่อมถนนหลัก: ทิศออก = ตามแนวถนน (end = 'east' | 'west' ปลายถนนที่ออกไป) */
/**
 * ป้อมบนถนนหลัก: ใช้ผิวถนนหลักเป็นลานด่าน ช่องทางแบ่งเท่ากันเต็มความกว้างถนน
 * เกาะกลางวางบนเส้นกึ่งกลางถนน (ไม่กินความกว้างเลน) จึงตรงกับเลนของถนนพอดี
 */
function fitRoad(s: PlazaSpec, lanes: number): PlazaSpec {
  // เลนในด่านกว้างไม่เกินเลนมาตรฐาน: ด่านที่มีเลนน้อยกว่าเลนถนน (เช่น ศูนย์วิจัย 1 เข้า 1 ออก)
  // ใช้เลนขนาดปกติชิดเกาะกลาง ที่เหลือเป็นไหล่ทาง → ไม้กั้นยาวพอดีเลน ไม่ยาวคร่อมครึ่งถนน
  const laneW = Math.min(ROAD_WIDTH / lanes, LANE_WIDTH);
  return {
    laneW,
    island: 0,
    shoulder: (ROAD_WIDTH - laneW * lanes) / 2,
    islandVisual: Math.max(s.island, 0.5),
  };
}

function onSpine(
  n: number,
  label: string,
  at: [number, number],
  end: 'east' | 'west',
  reach: number,
  s: PlazaSpec,
): CheckpointPlan {
  const i = nearestSpine(P(...at));
  const t = tangentAt(i);
  const outward = end === 'east' ? t : t.clone().negate();
  const inside = end === 'east' ? Math.max(0, i - 7) : Math.min(SPINE.length - 1, i + 7);
  return { n, label, center: SPINE[i]!.clone(), outward, spineIdx: inside, reach, spec: s };
}

export const CHECKPOINT_PLANS: CheckpointPlan[] = [
  onSpine(1, checkpointLabel(1), [312, 258], 'west', 12, fitRoad(spec(2.9, 1.63, 0.9), 4)),
  onBranch(2, checkpointLabel(2), [968, 335], 1, 11, 12, spec(2.9, 1.63, 0.9)),
  onSpine(3, checkpointLabel(3), [1180, 302], 'east', 14, fitRoad(spec(3.5, 1.6, 1), 2)),
  onBranch(4, checkpointLabel(4), [765, 337], -1, 11, 6, spec(3.8, 1.24, 1), true),
  onBranch(5, checkpointLabel(5), [867, 342], -1, 11, 6, spec(3.35, 1.24, 1), true),
];

/** ความกว้างรวมของลานด่าน (ไหล่ทาง + เลนทั้งหมด + เกาะ) */
export function plazaWidth(s: PlazaSpec, ins: number, outs: number) {
  return s.shoulder * 2 + s.laneW * (ins + outs) + s.island;
}

/**
 * เรขาคณิตของช่องทางตามแบบติดตั้ง
 * แกน local ของลาน: +x = ทิศวิ่งเข้าลาน, +z = ขวามือของทิศนั้น
 * ทางเข้าอยู่ซ้าย (−z) ทางออกอยู่ขวา (+z) เกาะกลางคั่น · index 0 = เลนที่ติดเกาะ
 */
export function laneFrame(
  plan: CheckpointPlan,
  dir: 'in' | 'out',
  index: number,
  ins: number,
  outs: number,
) {
  const s = plan.spec;
  const left0 = -plazaWidth(s, ins, outs) / 2 + s.shoulder;
  const islandL = left0 + s.laneW * ins;
  const islandR = islandL + s.island;
  const z = dir === 'in' ? islandL - s.laneW * (index + 0.5) : islandR + s.laneW * (index + 0.5);
  // ไม้กั้นทางเข้าอยู่ปลายเกาะด้านใน, ทางออกอยู่ปลายเกาะด้านนอก
  const bx = dir === 'in' ? BARRIER_X : -BARRIER_X;
  const tx = dir === 'in' ? bx - TICKET_GAP : bx + TICKET_GAP;
  return {
    z,
    /** ด้านที่ตู้ไม้กั้นตั้ง: ฝั่งเกาะ (ทางเข้า = +z, ทางออก = −z) */
    postSide: dir === 'in' ? 1 : -1,
    barrierX: bx,
    ticketX: tx,
  };
}

/* ---------- ช่องจอด ---------- */
export type BayPlan = {
  pos: THREE.Vector2;
  spineIdx: number;
  yaw: number;
};
const BAY_GAP = 1.45;
/** กลางช่องจอดห่างจากกลางถนน = ครึ่งถนน + ครึ่งความลึกช่อง (1.3) + 0.2 */
const BAY_OFFSET = ROAD_WIDTH / 2 + 1.5;

function bayRow(fromPx: number, toPx: number, side: 1 | -1, offset: number): BayPlan[] {
  const a = nearestSpine(P(fromPx, 300));
  const b = nearestSpine(P(toPx, 340));
  const bays: BayPlan[] = [];
  // เว้นช่องจอดหน้าถนนเชื่อมของป้อม: ครึ่งความกว้างถนนเชื่อม + ครึ่งช่องจอด + เผื่อ 0.4
  const near = (i: number) =>
    CHECKPOINT_PLANS.some((c) => {
      if (!c.branch || Math.sign(c.outward.y) !== side) return false;
      const half = Math.max(ROAD_WIDTH, plazaWidth(c.spec, 1, 1)) / 2;
      return SPINE[i]!.distanceTo(SPINE[c.spineIdx]!) < half + BAY_GAP / 2 + 0.4;
    });
  for (let s = a * SPINE_STEP; s <= b * SPINE_STEP; s += BAY_GAP) {
    const i = Math.round(s / SPINE_STEP);
    if (near(i)) continue;
    const n = southAt(i).multiplyScalar(side);
    const base = SPINE[i]!;
    const pos = base.clone().addScaledVector(n, offset);
    // หน้ารถหันเข้าช่อง (ออกจากถนน)
    bays.push({ pos, spineIdx: i, yaw: Math.atan2(-n.y, n.x) });
  }
  return bays;
}

export const BAYS: BayPlan[] = [
  ...bayRow(445, 1150, 1, BAY_OFFSET), // แถวยาวฝั่งใต้ หน้าอาคารแถว → หน้า BCA Place
  ...bayRow(445, 772, -1, BAY_OFFSET), // ฝั่งเหนือ หน้าอาคาร B–D
  ...bayRow(856, 1150, -1, BAY_OFFSET), // ฝั่งเหนือ หน้าอาคาร E–G (หน้า IT Bldg ไม่มีที่จอด)
];

/* ---------- อาคาร ---------- */
export type BuildingPlan = {
  label: string;
  pos: THREE.Vector2;
  w: number;
  d: number;
  h: number;
  yaw: number;
  color: string;
  labelShow?: boolean;
  kind?: 'pub';
};
const spineYawNear = (px: number, py: number) => {
  const t = tangentAt(nearestSpine(P(px, py)));
  return Math.atan2(-t.y, t.x);
};
/** อาคารริมถนนฝั่งเหนือ: วางถัดจากแถวช่องจอด (ระยะ 4.9 จากกลางถนน) */
const NORTH_SETBACK = ROAD_WIDTH / 2 + 3.2;
const north = (
  label: string,
  px: number,
  py: number,
  w: number,
  d: number,
  h: number,
  color = '#c9b98d',
): BuildingPlan => {
  const i = nearestSpine(P(px, py));
  const depth = d / PX;
  const pos = SPINE[i]!.clone().addScaledVector(southAt(i), -(NORTH_SETBACK + depth / 2));
  const t = tangentAt(i);
  return { label, pos, w: w / PX, d: depth, h, yaw: Math.atan2(-t.y, t.x), color };
};
const b = (
  label: string,
  px: number,
  py: number,
  w: number,
  d: number,
  h: number,
  color = '#c9b98d',
  yaw?: number,
): BuildingPlan => ({
  label,
  pos: P(px, py),
  w: w / PX,
  d: d / PX,
  h,
  yaw: yaw ?? spineYawNear(px, py),
  color,
});
const GOLD = '#b9a774';
const BROWN = '#8a4b4b';
/**
 * ตัดความกว้างอาคารฝั่งเหนือไม่ให้ทับถนนเชื่อมของป้อม 4 และ 5 (ซึ่งแยกขึ้นทิศเหนือผ่านแนวอาคาร)
 * วัดตามแนวยาวของอาคาร: ถ้าถนนอยู่ในช่วงอาคาร ให้หดขอบด้านนั้นออกจากถนน + เว้นระยะ
 */
const ROAD_CLEAR = 0.8;
function clearOfBranches(bp: BuildingPlan): BuildingPlan {
  const t = new THREE.Vector2(Math.cos(bp.yaw), -Math.sin(bp.yaw));
  let lo = -bp.w / 2;
  let hi = bp.w / 2;
  for (const c of CHECKPOINT_PLANS) {
    if (!c.branch || c.outward.dot(southAt(c.spineIdx)) > 0) continue; // เฉพาะถนนเชื่อมที่แยกขึ้นทิศเหนือ
    const half = Math.max(ROAD_WIDTH, plazaWidth(c.spec, 1, 1)) / 2 + ROAD_CLEAR;
    const at = SPINE[c.spineIdx]!.clone().sub(bp.pos).dot(t);
    if (at + half <= lo || at - half >= hi) continue;
    if (at >= (lo + hi) / 2) hi = Math.min(hi, at - half);
    else lo = Math.max(lo, at + half);
  }
  if (lo === -bp.w / 2 && hi === bp.w / 2) return bp;
  const w = Math.max(1.5, hi - lo);
  return { ...bp, w, pos: bp.pos.clone().addScaledVector(t, (lo + hi) / 2) };
}

/** ความสูงตามจริง: อาคารฐานเหลือง (GOLD) สูงหลายชั้น · IT Bldg (ฐานเขียว) สูงที่สุด */
const SHOW_LABELS = new Set(['Control Room', 'Office Main']);
export const BUILDINGS: BuildingPlan[] = [
  north('Bldg. A', 268, 222, 90, 38, 7, GOLD),
  north('Control Room', 468, 262, 92, 42, 7.8, GOLD),
  north('Bldg. C', 560, 283, 78, 36, 7, GOLD),
  north('Bldg. D', 690, 312, 112, 34, 7.8, GOLD),
  north('IT Bldg', 815, 326, 64, 24, 10.5, '#7f9c88'),
  north('Bldg. E', 915, 322, 56, 28, 7, GOLD),
  north('Bldg. F', 1022, 318, 92, 28, 7, GOLD),
  north('Bldg. G', 1112, 303, 80, 30, 7.8, GOLD),
]
  .map(clearOfBranches)
  .concat([
    b('Office Main', 895, 420, 38, 62, 4, BROWN, 0),
    b('BCA Place', 1090, 412, 170, 64, 2.2, BROWN, 0.2),
  ])
  // แสดงป้ายชื่อเฉพาะอาคารที่ใช้อ้างอิงตำแหน่ง
  .map((bp) => ({ ...bp, labelShow: SHOW_LABELS.has(bp.label) }));

/** อาคารแถวแนวใต้ของลานจอด: ร้านผับ (ตึกดำ ป้ายไฟนีออน) */
export const ROW_HOUSES: BuildingPlan[] = (
  [
    [372, 304, 60],
    [470, 318, 70],
    [570, 338, 70],
    [670, 352, 66],
    [760, 360, 46],
    [830, 366, 62],
  ] as const
).map(([x, y, w]) => {
  // วางชิดแถวช่องจอดฝั่งใต้: ขอบช่องจอด (กลางถนน + BAY_OFFSET + ครึ่งความลึก 1.3) + เว้น 0.35
  const i = nearestSpine(P(x, y));
  const depth = 12 / PX;
  const pos = SPINE[i]!.clone().addScaledVector(southAt(i), BAY_OFFSET + 1.3 + 0.35 + depth / 2);
  const t = tangentAt(i);
  return {
    label: '',
    pos,
    w: w / PX,
    d: depth,
    h: 1.6,
    yaw: Math.atan2(-t.y, t.x),
    color: BROWN,
    labelShow: false,
    kind: 'pub' as const,
  };
});

/* ---------- ถนนแถบตรง (ใช้กับถนนเชื่อมของป้อม) ---------- */
export type StripPlan = {
  label?: string;
  a: THREE.Vector2;
  b: THREE.Vector2;
  width: number;
  color: string;
  labelAt?: number;
};
/** ถนนภายนอก: ไม่แสดง (เหลือเฉพาะถนนในโครงการ) */
export const ROADS: StripPlan[] = [];

/** ถนนเชื่อมของป้อมที่แยกจากถนนหลัก (กว้างพอทุกช่องทางของป้อม) */
export function branchRoads(laneCounts: Map<number, number>): StripPlan[] {
  return CHECKPOINT_PLANS.filter((c) => c.n === 2 || c.n === 4 || c.n === 5).map((c) => {
    const lanes = laneCounts.get(c.n) ?? 2;
    // เริ่มที่ขอบถนนหลัก ไม่ทับเส้นจราจรของถนนหลัก
    const start = SPINE[c.spineIdx]!.clone().addScaledVector(c.outward, ROAD_WIDTH / 2);
    const end = c.center.clone().addScaledVector(c.outward, BARRIER_X + 2 + c.reach + 1.5);
    return {
      a: start,
      b: end,
      width: Math.max(ROAD_WIDTH, plazaWidth(c.spec, lanes / 2, lanes / 2)),
      color: '#26324d',
    };
  });
}

/** เส้นประแบ่งเลนของถนนหลักที่ต้องซ่อน: ช่วงด่านที่ช่องทางกว้างกว่าเลนถนน (ช่องทางเดียวกินหลายเลน) */
const HIDE_ZONES: number[] = []; // แสดงเส้นประตลอดถนนหลัก รวมช่วงด่าน
export function laneDashHidden(i: number) {
  return HIDE_ZONES.some((c) => Math.abs(c - i) <= BARRIER_X + 2);
}
