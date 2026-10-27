'use client';

import {
  ContactShadows,
  Environment,
  Html,
  Lightformer,
  OrbitControls,
  RoundedBox,
} from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { cn } from '@gip/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { SceneEnv } from './weather';
import {
  BAYS,
  branchRoads,
  BUILDINGS,
  CHECKPOINT_PLANS,
  BARRIER_X,
  LANE_WIDTH,
  laneDashHidden,
  laneFrame,
  plazaWidth,
  ROAD_WIDTH,
  ROADS,
  ROW_HOUSES,
  SPINE,
  southAt,
  tangentAt,
  type BuildingPlan,
  type CheckpointPlan,
  type StripPlan,
} from './site-plan';

export type GateTone = 'ok' | 'down';
export type GateModel = {
  id: string;
  code: string;
  direction: 'in' | 'out';
  /** เลขป้อม (จุดที่ 1–5) */
  cp: number;
  laneIndex: number;
  laneCount: number;
  /** รถต่อชั่วโมงจริงของชั่วโมงล่าสุด */
  rate: number;
  /** สีของช่องทาง: แดง = มีอุปกรณ์เสีย, เหลือง = มีอุปกรณ์ค้าง */
  tone: GateTone;
  /** ไม้กั้น: down = เสีย/ขาดการเชื่อมต่อ → ปิดช่องทาง */
  barrier: 'normal' | 'down';
  /** สถานะยก/ลงของไม้กั้นจาก API (ยกเมื่อมีการใช้งานจริง ลงเมื่อได้คำสั่งปิด) */
  armOpen: boolean;
  /** ตู้จ่ายสลิป (ทางเข้า) / ตู้ชำระเงิน (ทางออก) */
  kiosk: 'normal' | 'down';
  /** ช่างกำลังตรวจสอบ/ซ่อมหน้างาน (งานซ่อมสถานะ "กำลังดำเนินการ") → ปิดช่องทางชั่วคราว · เก็บเลขงาน */
  maintenance: string | null;
  issues: string[];
};

/** จุดที่กล้องโฟกัส: null = ภาพรวม, seq เปลี่ยนทุกครั้งที่กด (กดซ้ำจุดเดิมก็บินกลับไป) */
export type CameraFocus = { n: number | null; seq: number };
type SceneProps = {
  gates: GateModel[];
  active: boolean;
  focus: CameraFocus;
  env: SceneEnv;
  /** กดป้ายป้อมในภาพ 3D เพื่อซูมไปป้อมนั้น */
  onPick?: (n: number) => void;
};

/**
 * วัสดุที่เปลี่ยนตามกลางวัน/กลางคืน ใช้ร่วมกันทั้งฉาก
 * SkyLights ค่อย ๆ ไล่ค่าทุกเฟรม (ไม่สลับทันที)
 */
const MAT = {
  road: new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide }),
  ground: new THREE.MeshStandardMaterial({ roughness: 1 }),
  bay: new THREE.MeshStandardMaterial({ roughness: 0.95 }),
  /** กระจกอาคารสมัยใหม่: สะท้อนแสงจาก Environment */
  glass: new THREE.MeshPhysicalMaterial({
    color: '#1c2a40',
    metalness: 0.35,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.4,
  }),
  window: new THREE.MeshStandardMaterial({
    color: '#ffe7a8',
    emissive: '#ffd98a',
    transparent: true,
  }),
  lampHead: new THREE.MeshStandardMaterial({ color: '#fff3d1', emissive: '#ffd98a' }),
  glow: new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
  }),
};
/** ค่ากลางวัน [0] และกลางคืน [1] · โทนเทา/น้ำเงินเข้มเข้ากับธีม Dashboard */
const DN = {
  road: [new THREE.Color('#2c374b'), new THREE.Color('#1f2838')],
  ground: [new THREE.Color('#1a2334'), new THREE.Color('#111827')],
  bay: [new THREE.Color('#243047'), new THREE.Color('#1a2335')],
  bg: [new THREE.Color('#121a2b'), new THREE.Color('#0b1220')],
  hemiSky: [new THREE.Color('#c3d2ea'), new THREE.Color('#8ea3c8')],
  hemiGround: [new THREE.Color('#1c2638'), new THREE.Color('#121a2b')],
  sun: [new THREE.Color('#f2f5fb'), new THREE.Color('#9fb5ff')],
  sunPos: [new THREE.Vector3(-40, 90, 50), new THREE.Vector3(-40, 90, 50)],
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * กล้อง orthographic มุม isometric คงที่ (ไม่หมุน) · เลื่อนได้และซูมได้
 * กล้องอยู่ที่ target + ISO_OFFSET เสมอ ซูมด้วย camera.zoom
 */
const ISO_OFFSET = new THREE.Vector3(-0.3, 1.15, 1).normalize().multiplyScalar(160);
const OVERVIEW = { target: new THREE.Vector3(4, 0, 2), zoom: 7.6 };
const FOCUS_ZOOM = 24;
/** ซูมภาพรวมให้ผังพอดีความกว้างจอ (ค่า OVERVIEW.zoom ตั้งไว้สำหรับจอกว้าง ~1340px) */
const overviewZoom = (width: number) => OVERVIEW.zoom * Math.min(1, width / 1340);
/** กล้อง orthographic: ป้าย HTML ขยายตาม camera.zoom × ค่านี้ (ภาพรวม ≈ 0.65 เท่า) */
const LABEL_SCALE = 0.09;
const MAX_ZOOM = 60;

type OrthoControls = {
  target: THREE.Vector3;
  minZoom: number;
  update: () => void;
  addEventListener: (t: 'start', f: () => void) => void;
  removeEventListener: (t: 'start', f: () => void) => void;
};

/** พากล้องไปยังป้อมที่เลือก/กลับภาพรวมแบบนุ่มนวล แล้วคืนการควบคุมให้ผู้ใช้ */
function CameraRig({ focus }: { focus: CameraFocus }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const controls = useThree((s) => s.controls) as unknown as OrthoControls | null;
  const width = useThree((s) => s.size.width);
  const ovZoom = overviewZoom(width);
  const goal = useRef<{
    target: THREE.Vector3;
    zoom: number;
    rate?: number;
    /** มุมกล้องปลายทาง (ใส่เฉพาะตอนกลับภาพรวม = คืนมุม isometric) */
    offset?: THREE.Vector3;
  } | null>(null);
  const offset = useMemo(() => new THREE.Vector3(), []);

  useMemo(() => {
    if (focus.seq === 0) return;
    if (focus.n === null) {
      goal.current = { target: OVERVIEW.target.clone(), zoom: ovZoom, offset: ISO_OFFSET };
      return;
    }
    const plan = CHECKPOINT_PLANS.find((p) => p.n === focus.n);
    if (!plan) return;
    goal.current = { target: new THREE.Vector3(plan.center.x, 0, plan.center.y), zoom: FOCUS_ZOOM };
  }, [focus, ovZoom]);

  // ซูมออกได้สุดเท่าภาพรวมของจอนี้ (จอแคบ เช่น iPad แนวตั้ง ภาพรวมซูมออกมากกว่า)
  useEffect(() => {
    if (controls) controls.minZoom = ovZoom;
  }, [controls, ovZoom]);

  // ผู้ใช้เริ่มลาก/ซูมเมื่อไร หยุดพากล้องทันที
  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      goal.current = null;
    };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);

  // ตั้งค่าเริ่มต้นครั้งเดียว (ไม่ใส่เป็น prop: ข้อมูลอัปเดตทุก 6 วินาทีจะรีเซ็ตกล้อง)
  const init = useRef(false);
  useFrame((_, delta) => {
    if (!controls) return;
    if (!init.current) {
      init.current = true;
      // เปิดฉาก: เริ่มซูมออกเล็กน้อย แล้วค่อย ๆ เข้ามาที่ภาพรวม
      controls.target.copy(OVERVIEW.target);
      camera.zoom = ovZoom * 0.75;
      camera.position.copy(OVERVIEW.target).add(ISO_OFFSET);
      goal.current = { target: OVERVIEW.target.clone(), zoom: ovZoom, rate: 1.6 };
    }
    // ซูมออกจนสุดแต่เลื่อนออกนอกผัง → ค่อย ๆ จัดกลับมากลางภาพรวม
    if (
      !goal.current &&
      camera.zoom <= ovZoom * 1.01 &&
      controls.target.distanceTo(OVERVIEW.target) > 0.5
    ) {
      goal.current = { target: OVERVIEW.target.clone(), zoom: ovZoom };
    }
    const g = goal.current;
    if (g) {
      const k = 1 - Math.exp(-(g.rate ?? 4) * Math.min(delta, 0.05));
      // คงมุมที่ผู้ใช้หมุนไว้ (เลื่อนทั้งกล้องและจุดหมุนไปด้วยกัน) · กลับภาพรวมค่อยคืนมุม isometric
      offset.copy(camera.position).sub(controls.target);
      if (g.offset) offset.lerp(g.offset, k).setLength(ISO_OFFSET.length());
      controls.target.lerp(g.target, k);
      camera.position.copy(controls.target).add(offset);
      camera.zoom = lerp(camera.zoom, g.zoom, k);
      if (
        controls.target.distanceTo(g.target) < 0.05 &&
        Math.abs(camera.zoom - g.zoom) < 0.02 &&
        (!g.offset || offset.distanceTo(g.offset) < 0.1)
      ) {
        controls.target.copy(g.target);
        camera.zoom = g.zoom;
        goal.current = null;
      }
    }
    camera.updateProjectionMatrix();
    controls.update();
  });
  return null;
}

const TONE_COLOR: Record<GateTone, string> = { ok: '#22c55e', down: '#ef4444' };
const yawOf = (dx: number, dz: number) => Math.atan2(-dz, dx);

/* ---------- ช่องทางตามแบบติดตั้ง ---------- */
type Lane = { gate: GateModel; plan: CheckpointPlan; frame: ReturnType<typeof laneFrame> };
/**
 * ตำแหน่งในผังของช่องทาง: ป้อมที่ flip ให้ทางเข้าใช้ตำแหน่ง (ฝั่ง + ระยะไม้กั้น) ของทางออกเดิม และกลับกัน
 * ตู้/สีของอุปกรณ์ยังเป็นของทิศจริง
 */
const layoutDir = (plan: CheckpointPlan, dir: 'in' | 'out') =>
  plan.flip ? (dir === 'in' ? 'out' : 'in') : dir;
function useLanes(gates: GateModel[]) {
  return useMemo(() => {
    const lanes = new Map<string, Lane>();
    for (const g of gates) {
      const plan = CHECKPOINT_PLANS.find((p) => p.n === g.cp);
      if (!plan) continue;
      const same = gates.filter((x) => x.cp === g.cp);
      const ins = same.filter((x) => layoutDir(plan, x.direction) === 'in').length;
      const outs = same.length - ins;
      lanes.set(g.id, {
        gate: g,
        plan,
        frame: laneFrame(plan, layoutDir(plan, g.direction), g.laneIndex, ins, outs),
      });
    }
    return lanes;
  }, [gates]);
}

/* ---------- ไม้กั้น ---------- */
const ARM_UP = Math.PI / 2.1;

/** ลานด่านทุกป้อม + ขยับแขนไม้กั้นตามสถานะจริง (ยกเมื่อได้คำสั่งยก · ไม้กั้นเสีย = ปิด) */
function Gates({ gates }: { gates: GateModel[] }) {
  const lanes = useLanes(gates);
  const arms = useRef(new Map<string, THREE.Group>());
  const armAngle = useRef(new Map<string, number>());

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    for (const lane of lanes.values()) {
      const arm = arms.current.get(lane.gate.id);
      if (!arm) continue;
      const want = lane.gate.barrier !== 'down' && lane.gate.armOpen ? ARM_UP : 0;
      const cur = THREE.MathUtils.damp(armAngle.current.get(lane.gate.id) ?? 0, want, 5, dt);
      armAngle.current.set(lane.gate.id, cur);
      arm.rotation.x = lane.frame.postSide * cur;
    }
  });

  const plazas = useMemo(() => {
    const m = new Map<number, Lane[]>();
    for (const l of lanes.values()) m.set(l.plan.n, [...(m.get(l.plan.n) ?? []), l]);
    return [...m.values()];
  }, [lanes]);

  return (
    <>
      {plazas.map((ls) => (
        <Plaza
          key={ls[0]!.plan.n}
          lanes={ls}
          armRef={(id, el) => {
            if (el) arms.current.set(id, el);
          }}
        />
      ))}
    </>
  );
}

/* ---------- ลานด่านตามแบบติดตั้ง ---------- */
/** ความยาวป้อมบนเกาะกลาง (~4.8 ม.) */
const BOOTH_LEN = 2.4;
const DEVICE = {
  post: '#f4c430',
  arm: '#f1f3f7',
  stripe: '#ef4444',
  kiosk: '#2b3a5c',
  screen: '#8db4ff',
  loop: '#ef4444',
};

/** ขดลวด LOOP ฝังพื้น: กรอบเส้นประสีแดงก่อนถึงไม้กั้น */
function Loop({ x, z, w, d }: { x: number; z: number; w: number; d: number }) {
  const dashes: [number, number, number, number][] = [];
  for (let i = -w / 2; i < w / 2; i += 0.32) {
    dashes.push([x - d / 2, z + i + 0.1, 0.05, 0.18], [x + d / 2, z + i + 0.1, 0.05, 0.18]);
  }
  for (let i = -d / 2; i < d / 2; i += 0.32) {
    dashes.push([x + i + 0.1, z - w / 2, 0.18, 0.05], [x + i + 0.1, z + w / 2, 0.18, 0.05]);
  }
  return (
    <>
      {dashes.map(([px, pz, sx, sz], i) => (
        <mesh key={i} position={[px, 0.09, pz]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[sx, sz]} />
          <meshBasicMaterial color={DEVICE.loop} />
        </mesh>
      ))}
    </>
  );
}

function LaneDevices({ lane, armRef }: { lane: Lane; armRef: (el: THREE.Group | null) => void }) {
  const { frame: f, gate, plan } = lane;
  const s = plan.spec;
  const tone = TONE_COLOR[gate.tone];
  const zPost = f.z + f.postSide * (s.laneW / 2 - 0.12);
  const armLen = s.laneW - 0.3;
  const up = layoutDir(plan, gate.direction) === 'in' ? -1 : 1; // ทิศ "ก่อนถึงไม้กั้น" บนแกน x
  return (
    <group>
      {/* กรวยวางเฉพาะตอนไม้กั้นหลุดการเชื่อมต่อ/เสีย */}
      {gate.barrier === 'down' && <ClosedLane f={f} laneW={s.laneW} up={up} />}
      {/* ตู้ไม้กั้น + Radar sensor + ไฟสถานะ */}
      <mesh position={[f.barrierX, 0.45, zPost]} castShadow>
        <boxGeometry args={[0.28, 0.9, 0.28]} />
        <meshStandardMaterial color={DEVICE.post} roughness={0.5} />
      </mesh>
      <mesh position={[f.barrierX + up * 0.18, 0.75, zPost]}>
        <boxGeometry args={[0.08, 0.12, 0.16]} />
        <meshStandardMaterial color="#1c2230" />
      </mesh>
      <mesh position={[f.barrierX, 0.96, zPost]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={2.4} />
      </mesh>
      <group ref={armRef} position={[f.barrierX, 0.78, zPost]}>
        <mesh position={[0, 0, -f.postSide * (armLen / 2)]} castShadow>
          <boxGeometry args={[0.07, 0.07, armLen]} />
          <meshStandardMaterial color={DEVICE.arm} roughness={0.4} />
        </mesh>
        {Array.from({ length: Math.floor(armLen / 0.5) }, (_, k) => (
          <mesh key={k} position={[0, 0, -f.postSide * (0.35 + k * 0.5)]}>
            <boxGeometry args={[0.08, 0.08, 0.2]} />
            <meshStandardMaterial
              color={DEVICE.stripe}
              emissive={DEVICE.stripe}
              emissiveIntensity={0.4}
            />
          </mesh>
        ))}
      </group>

      {/* LOOP ก่อนไม้กั้น */}
      <Loop x={f.barrierX + up * 0.75} z={f.z} w={Math.min(s.laneW, LANE_WIDTH) * 0.62} d={0.9} />

      {/* ตู้จ่ายสลิป (ทางเข้า) / ตู้ชำระเงิน (ทางออก) */}
      <mesh position={[f.ticketX, 0.42, zPost]} castShadow>
        <boxGeometry args={[0.32, 0.84, 0.3]} />
        <meshStandardMaterial
          color={gate.direction === 'in' ? DEVICE.kiosk : '#3a2f5c'}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>
      <mesh
        position={[f.ticketX, 0.62, zPost - f.postSide * 0.155]}
        rotation={[0, f.postSide > 0 ? Math.PI : 0, 0]}
      >
        <planeGeometry args={[0.22, 0.16]} />
        <meshStandardMaterial
          color={DEVICE.screen}
          emissive={DEVICE.screen}
          emissiveIntensity={1.2}
        />
      </mesh>

      {/* กล้อง LPR + จอแสดงผล */}
      <group position={[f.barrierX + up * 0.45, 0, zPost]}>
        <mesh position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.3, 8]} />
          <meshStandardMaterial color="#9aa6ba" />
        </mesh>
        <mesh position={[up * 0.1, 1.28, -f.postSide * 0.08]}>
          <boxGeometry args={[0.24, 0.1, 0.1]} />
          <meshStandardMaterial color="#e6eaf2" />
        </mesh>
        <mesh position={[0, 1.05, -f.postSide * 0.05]}>
          <boxGeometry args={[0.04, 0.16, 0.26]} />
          <meshStandardMaterial color="#0b1220" emissive="#22c55e" emissiveIntensity={0.6} />
        </mesh>
      </group>
    </group>
  );
}

/** ลานด่านหนึ่งป้อม: พื้น เส้นจราจร เกาะกลาง ป้อม และอุปกรณ์ทุกช่องทาง */
function Plaza({
  lanes,
  armRef,
}: {
  lanes: Lane[];
  armRef: (id: string, el: THREE.Group | null) => void;
}) {
  const plan = lanes[0]!.plan;
  const s = plan.spec;
  const ins = lanes.filter((l) => layoutDir(plan, l.gate.direction) === 'in').length;
  const outs = lanes.length - ins;
  const W = plazaWidth(s, ins, outs);
  const L = BARRIER_X * 2 + 6;
  const islandZ = -W / 2 + s.shoulder + s.laneW * ins + s.island / 2;
  const islandW = s.islandVisual ?? s.island;
  const fwd = plan.outward.clone().negate();
  const tone: GateTone = lanes.some((l) => l.gate.tone === 'down') ? 'down' : 'ok';
  // ถนนเชื่อม: เส้นจราจรยาวตลอดจากถนนหลักถึงสุดทาง / ป้อมบนถนนหลัก: เฉพาะช่วงลานด่าน
  const x0 = plan.branch ? -(BARRIER_X + 3.5 + plan.reach) : -L / 2;
  const x1 = plan.branch ? plan.branch - ROAD_WIDTH / 2 : L / 2;
  const len = x1 - x0;
  const mid = (x0 + x1) / 2;
  const lines: number[] = [];
  for (let k = 1; k < ins; k++) lines.push(islandZ - s.island / 2 - s.laneW * k);
  for (let k = 1; k < outs; k++) lines.push(islandZ + s.island / 2 + s.laneW * k);
  return (
    <group position={[plan.center.x, 0, plan.center.y]} rotation={[0, yawOf(fwd.x, fwd.y), 0]}>
      {plan.branch && (
        <mesh position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[L, W]} />
          <primitive object={MAT.road} attach="material" />
        </mesh>
      )}
      {/* เส้นประกลางถนนเชื่อม นอกช่วงเกาะกลาง */}
      {plan.branch &&
        [
          [x0, -BARRIER_X - 0.6],
          [BARRIER_X + 0.6, x1],
        ].flatMap(([a, b2]) =>
          Array.from({ length: Math.max(0, Math.floor((b2! - a!) / 1.2)) }, (_, k) => (
            <mesh
              key={`c${a}${k}`}
              position={[a! + 0.6 + k * 1.2, 0.085, islandZ]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.6, 0.07]} />
              <meshBasicMaterial color="#6b7a94" />
            </mesh>
          )),
        )}
      {/* เส้นขอบช่องทาง */}
      {plan.branch &&
        [-W / 2 + s.shoulder, W / 2 - s.shoulder].map((z) => (
          <mesh key={z} position={[mid, 0.085, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[len, 0.06]} />
            <meshBasicMaterial color="#6b7a94" />
          </mesh>
        ))}
      {plan.branch &&
        lines.map((z) =>
          Array.from({ length: Math.floor(len / 1.2) }, (_, k) => (
            <mesh
              key={`${z}${k}`}
              position={[x0 + 0.6 + k * 1.2, 0.085, z]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.6, 0.05]} />
              <meshBasicMaterial color="#6b7a94" />
            </mesh>
          )),
        )}
      {/* เกาะกลาง + ป้อม */}
      <RoundedBox
        args={[BARRIER_X * 2 + 0.8, 0.16, islandW]}
        radius={0.05}
        position={[0, 0.08, islandZ]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#c9ced8" roughness={0.8} />
      </RoundedBox>
      <RoundedBox
        args={[BOOTH_LEN, 1.25, islandW * 0.72]}
        radius={0.06}
        position={[0, 0.78, islandZ]}
        castShadow
      >
        <meshStandardMaterial color="#1b2944" roughness={0.5} metalness={0.25} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, 0.95, islandZ + side * (islandW * 0.36 + 0.005)]}
          rotation={[0, side > 0 ? 0 : Math.PI, 0]}
        >
          <planeGeometry args={[BOOTH_LEN - 0.4, 0.45]} />
          <meshStandardMaterial
            color="#8db4ff"
            emissive="#8db4ff"
            emissiveIntensity={0.8}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
      <mesh position={[0, 1.45, islandZ]} castShadow>
        <boxGeometry args={[BOOTH_LEN + 0.4, 0.1, islandW * 0.95]} />
        <meshStandardMaterial color="#26385c" />
      </mesh>
      <mesh position={[0, 1.62, islandZ]}>
        <sphereGeometry args={[0.14, 20, 20]} />
        <meshStandardMaterial
          color={TONE_COLOR[tone]}
          emissive={TONE_COLOR[tone]}
          emissiveIntensity={2.4}
        />
      </mesh>
      {lanes.map((l) => (
        <LaneDevices key={l.gate.id} lane={l} armRef={(el) => armRef(l.gate.id, el)} />
      ))}
    </group>
  );
}

/** ป้ายของแต่ละป้อม: สีตามช่องทางที่แย่ที่สุด */
function CheckpointLabel({
  plan,
  gates,
  hidden,
  onPick,
}: {
  plan: CheckpointPlan;
  gates: GateModel[];
  hidden?: boolean;
  onPick?: (n: number) => void;
}) {
  const bad = gates.some((g) => g.tone !== 'ok');
  const rate = gates.reduce((a, g) => a + g.rate, 0);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ring.current) {
      const k = (t * 0.6) % 1;
      ring.current.scale.setScalar(1 + k * 1.2);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
    }
    // ลำแสงเตือนเหนือป้อมที่มีปัญหา: หายใจช้า ๆ มองเห็นได้จากมุมภาพรวม
  });
  const ins = gates.filter((g) => g.direction === 'in').length;
  const outs = gates.length - ins;
  const down = gates.filter((g) => g.tone !== 'ok').length;
  return (
    <group position={[plan.center.x, 0, plan.center.y]}>
      {bad && (
        <>
          <mesh ref={ring} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[3.4, 3.8, 64]} />
            <meshBasicMaterial
              color={TONE_COLOR.down}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}
      {!hidden && (
        <Html position={[0, 7.5, -1.5]} center distanceFactor={LABEL_SCALE} zIndexRange={[30, 0]}>
          <button
            type="button"
            onClick={() => onPick?.(plan.n)}
            title="กดเพื่อซูมไปป้อมนี้"
            className={`group cursor-pointer rounded-full border px-3 py-1.5 text-left text-[12px] hover:rounded-xl whitespace-nowrap shadow-pop backdrop-blur-md transition-[translate,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgb(0_0_0/0.6)] ${
              bad
                ? 'border-danger/50 bg-[#1f0d14]/85 text-danger-fg hover:border-danger'
                : 'border-white/15 bg-[#0b1220]/80 text-white hover:border-primary/70'
            }`}
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="relative flex size-2">
                {bad && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-danger opacity-75" />
                )}
                <span
                  className={`relative size-2 rounded-full ${bad ? 'bg-danger' : 'bg-success'}`}
                />
              </span>
              {plan.label}
            </span>
            {/* มินิมอล: แสดงแค่ชื่อ รายละเอียดขึ้นเมื่อชี้ */}
            <span className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-200 group-hover:grid-rows-[1fr] group-hover:opacity-100">
              <span className="min-h-0 overflow-hidden">
                <span className="num mt-0.5 block text-[11px] text-white/60">
                  ทางเข้า {ins} · ทางออก {outs} · {rate} คัน/ชม.
                </span>
                {down > 0 && <span className="block text-[11px]">เสีย {down} ช่องทาง</span>}
              </span>
            </span>
          </button>
        </Html>
      )}
    </group>
  );
}

/* ---------- ผังพื้น ---------- */
function Strip({ s, y = 0.03, material }: { s: StripPlan; y?: number; material?: THREE.Material }) {
  const d = s.b.clone().sub(s.a);
  const mid = s.a.clone().add(s.b).multiplyScalar(0.5);
  const at = s.a.clone().lerp(s.b, s.labelAt ?? 0.5);
  return (
    <>
      <group position={[mid.x, y, mid.y]} rotation={[0, yawOf(d.x, d.y), 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[d.length(), s.width]} />
          {material ? (
            <primitive object={material} attach="material" />
          ) : (
            <meshStandardMaterial color={s.color} roughness={0.9} />
          )}
        </mesh>
      </group>
      {s.label && (
        <Html
          position={[at.x, 0.5, at.y]}
          center
          distanceFactor={LABEL_SCALE * 0.85}
          zIndexRange={[10, 0]}
        >
          <span className="pointer-events-none rounded bg-bg/70 px-1.5 py-0.5 text-[13px] font-semibold whitespace-nowrap text-muted">
            {s.label}
          </span>
        </Html>
      )}
    </>
  );
}

/** ถนนหลักเป็นแถบโค้งตามแนว SPINE */
function Ribbon({
  width,
  y,
  color,
  offset = 0,
  material,
}: {
  width: number;
  y: number;
  color: string;
  offset?: number;
  material?: THREE.Material;
}) {
  const w = width;
  const geo = useMemo(() => {
    const pos: number[] = [];
    const idx: number[] = [];
    SPINE.forEach((p, i) => {
      const n = southAt(i);
      const width = w;
      const cx = p.x + n.x * offset;
      const cz = p.y + n.y * offset;
      pos.push(
        cx - (n.x * width) / 2,
        y,
        cz - (n.y * width) / 2,
        cx + (n.x * width) / 2,
        y,
        cz + (n.y * width) / 2,
      );
      if (i > 0) {
        const k = i * 2;
        idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [w, y, offset]);
  return (
    <mesh geometry={geo} receiveShadow>
      {material ? (
        <primitive object={material} attach="material" />
      ) : (
        <meshStandardMaterial color={color} roughness={0.95} side={THREE.DoubleSide} />
      )}
    </mesh>
  );
}

const NEON = ['#ff2d95', '#22d3ee', '#a855f7', '#f59e0b'];
/** ไฟผับ: กลางวันร้านปิด (ป้ายดับ) · กลางคืนเปิด (นีออนสว่าง) — SkyLights ปรับความสว่างตามเวลา */
const PUB_NEON = NEON.map(
  (c) =>
    new THREE.MeshStandardMaterial({
      color: '#2a2d35',
      emissive: c,
      emissiveIntensity: 0,
      toneMapped: false,
    }),
);
const PUB_DOOR = NEON.map(
  (c) => new THREE.MeshStandardMaterial({ color: '#1a1c22', emissive: c, emissiveIntensity: 0 }),
);
const PUB_WINDOW = new THREE.MeshStandardMaterial({
  color: '#1a1c22',
  emissive: '#6d28d9',
  emissiveIntensity: 0,
});

/** ผับ: ตึกเตี้ยสีดำ หน้าร้านหันเข้าถนนหลัก */
function Pub({ b, i }: { b: BuildingPlan; i: number }) {
  const n = i % NEON.length;
  const front = -b.d / 2 - 0.02; // ฝั่งเหนือ = ถนนหลัก
  const face = [0, Math.PI, 0] as const;
  return (
    <group position={[b.pos.x, 0, b.pos.y]} rotation={[0, b.yaw, 0]}>
      <RoundedBox
        args={[b.w, b.h, b.d]}
        radius={0.06}
        position={[0, b.h / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#121418" roughness={0.85} />
      </RoundedBox>
      <mesh position={[0, b.h + 0.05, 0]}>
        <boxGeometry args={[b.w + 0.1, 0.1, b.d + 0.1]} />
        <meshStandardMaterial color="#1f232b" roughness={0.6} />
      </mesh>
      <mesh position={[0, b.h - 0.12, front]} rotation={face} material={PUB_NEON[n]}>
        <planeGeometry args={[b.w * 0.96, 0.06]} />
      </mesh>
      <mesh position={[0, b.h * 0.68, front - 0.03]} rotation={face} material={PUB_NEON[n]}>
        <planeGeometry args={[Math.min(2.2, b.w * 0.45), 0.34]} />
      </mesh>
      <mesh position={[0, 0.42, front]} rotation={face} material={PUB_DOOR[n]}>
        <planeGeometry args={[0.55, 0.8]} />
      </mesh>
      {[-0.3, 0.3].map((t) => (
        <mesh key={t} position={[t * b.w, 0.42, front]} rotation={face} material={PUB_WINDOW}>
          <planeGeometry args={[0.9, 0.35]} />
        </mesh>
      ))}
    </group>
  );
}

function Building({ b }: { b: BuildingPlan }) {
  // อาคารสูงผนังทึบ: ฐาน + ตัวตึก + แถบหน้าต่างทุกชั้นรอบตึก + หลังคา
  const floors = Math.max(1, Math.floor((b.h - 0.6) / 1.4));
  const bodyH = b.h - 0.5;
  const bands = (len: number, depth: number, rot: number) =>
    Array.from({ length: floors }, (_, i) =>
      [1, -1].map((side) => (
        <mesh
          key={`${rot}${i}${side}`}
          position={
            rot === 0
              ? [0, 1.15 + i * 1.4, side * (depth / 2 + 0.01)]
              : [side * (depth / 2 + 0.01), 1.15 + i * 1.4, 0]
          }
          rotation={[0, rot + (side < 0 ? Math.PI : 0), 0]}
        >
          <planeGeometry args={[len * 0.9, 0.5]} />
          <primitive object={MAT.glass} attach="material" />
        </mesh>
      )),
    );
  return (
    <group position={[b.pos.x, 0, b.pos.y]} rotation={[0, b.yaw, 0]}>
      <RoundedBox
        args={[b.w + 0.2, 0.5, b.d + 0.2]}
        radius={0.08}
        position={[0, 0.25, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={b.color} roughness={0.6} metalness={0.05} />
      </RoundedBox>
      <RoundedBox
        args={[b.w, bodyH, b.d]}
        radius={0.1}
        position={[0, 0.5 + bodyH / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#3a4760" roughness={0.85} />
      </RoundedBox>
      {b.h > 2 && bands(b.w, b.d, 0)}
      {b.h > 2 && bands(b.d, b.w, Math.PI / 2)}
      {/* ไฟหน้าต่างตอนกลางคืน */}
      {b.h > 2 &&
        Array.from({ length: floors }, (_, i) => (
          <mesh key={`w${i}`} position={[0, 1.15 + i * 1.4, b.d / 2 + 0.02]}>
            <planeGeometry args={[b.w * 0.86, 0.3]} />
            <primitive object={MAT.window} attach="material" />
          </mesh>
        ))}
      <mesh position={[0, b.h + 0.06, 0]} castShadow>
        <boxGeometry args={[b.w + 0.12, 0.12, b.d + 0.12]} />
        <meshStandardMaterial color="#48566f" roughness={0.8} />
      </mesh>
      <mesh position={[b.w * 0.18, b.h + 0.3, -b.d * 0.12]} castShadow>
        <boxGeometry args={[b.w * 0.28, 0.36, b.d * 0.3]} />
        <meshStandardMaterial color="#56647e" roughness={0.8} />
      </mesh>
      {b.labelShow !== false && b.label && (
        <Html
          position={[0, b.h + 0.8, 0]}
          center
          distanceFactor={LABEL_SCALE * 0.85}
          zIndexRange={[10, 0]}
        >
          <span className="pointer-events-none rounded-md bg-[#0b1220]/85 px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap text-white shadow-pop ring-1 ring-white/15">
            {b.label}
          </span>
        </Html>
      )}
    </group>
  );
}

function Ground({ laneCounts }: { laneCounts: Map<number, number> }) {
  const dashes = useMemo(() => SPINE.map((p, i) => ({ p, i })).filter(({ i }) => i % 3 === 0), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[260, 170]} />
        <primitive object={MAT.ground} attach="material" />
      </mesh>
      {ROADS.map((r, i) => (
        <Strip key={i} s={r} />
      ))}
      {branchRoads(laneCounts).map((r, i) => (
        <Strip key={`b${i}`} s={r} y={0.046} material={MAT.road} />
      ))}
      {/* ถนนหลัก 2 เลน + เส้นขอบทางขาว */}
      <Ribbon width={ROAD_WIDTH + 0.24} y={0.045} color="#4a5a75" />
      <Ribbon width={ROAD_WIDTH} y={0.05} color="#4a5263" material={MAT.road} />
      {/* เส้นเหลืองคู่กลางถนน + เส้นประขาวแบ่งเลนในแต่ละทิศ */}
      {[-0.09, 0.09].map((o) => (
        <Ribbon key={o} width={0.07} y={0.065} color="#8a7a4e" offset={o} />
      ))}
      {dashes.map(({ p, i }) => {
        const t = tangentAt(i);
        const n = southAt(i);
        if (laneDashHidden(i)) return null;
        return [-LANE_WIDTH, LANE_WIDTH].map((o) => (
          <group
            key={`${i}${o}`}
            position={[p.x + n.x * o, 0.07, p.y + n.y * o]}
            rotation={[0, yawOf(t.x, t.y), 0]}
          >
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[1, 0.08]} />
              <meshBasicMaterial color="#6b7a94" />
            </mesh>
          </group>
        ));
      })}
      {/* ช่องจอด */}
      {BAYS.map((bay, i) => (
        <group key={i} position={[bay.pos.x, 0.06, bay.pos.y]} rotation={[0, bay.yaw, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[2.6, 1.4]} />
            <primitive object={MAT.bay} attach="material" />
          </mesh>
          {[-0.72, 0.72].map((z) => (
            <mesh key={z} position={[0, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.6, 0.06]} />
              <meshBasicMaterial color="#3a4b6a" />
            </mesh>
          ))}
        </group>
      ))}
      <StreetLights />
      {BUILDINGS.map((b, i) => (
        <Building key={i} b={b} />
      ))}
      {ROW_HOUSES.map((b, i) => (
        <Pub key={`pub${i}`} b={b} i={i} />
      ))}
    </group>
  );
}

export default function LotScene({ gates, active, focus, env, onPick }: SceneProps) {
  const laneCounts = useMemo(() => new Map(gates.map((g) => [g.cp, g.laneCount])), [gates]);
  const byCp = useMemo(() => {
    const m = new Map<number, GateModel[]>();
    for (const g of gates) m.set(g.cp, [...(m.get(g.cp) ?? []), g]);
    return m;
  }, [gates]);

  // ค่อย ๆ เฟดฉากขึ้นมาหลังวาดเฟรมแรกเสร็จ (ไม่ให้เห็นฉากกระพริบตอนโหลดโมเดล)
  const [shown, setShown] = useState(false);

  return (
    <div
      className={cn(
        'size-full transition-[opacity,scale,filter] duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
        shown ? 'scale-100 opacity-100 filter-none' : 'scale-[1.04] opacity-0 blur-sm',
      )}
    >
      <Canvas
        onCreated={() => requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))}
        orthographic
        dpr={[1, 2]}
        frameloop={active ? 'always' : 'never'}
        camera={{ position: [6 + 92, 106, 4 + 92], zoom: 7.2, near: -400, far: 800 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        aria-hidden
      >
        <SkyLights env={env} />
        {/* แสงสะท้อนบนกระจก/โลหะ (สร้างในเครื่อง ไม่โหลดไฟล์ HDR จากเน็ต) */}
        <Environment resolution={256} frames={1} environmentIntensity={0.3}>
          <Lightformer
            intensity={2.2}
            position={[0, 30, 0]}
            rotation-x={Math.PI / 2}
            scale={[80, 80, 1]}
          />
          <Lightformer
            intensity={1.2}
            color="#bcd4ff"
            position={[-40, 10, 0]}
            rotation-y={Math.PI / 2}
            scale={[60, 12, 1]}
          />
          <Lightformer
            intensity={0.8}
            color="#ffe2b8"
            position={[40, 8, 20]}
            rotation-y={-Math.PI / 2}
            scale={[50, 10, 1]}
          />
        </Environment>
        <Ground laneCounts={laneCounts} />
        {/* ambient occlusion แบบนุ่ม: เงาจาง ๆ ใต้ตึก/ป้อม (เรนเดอร์ครั้งเดียว) */}
        <ContactShadows
          position={[6, 0.075, 4]}
          scale={[280, 180]}
          far={14}
          blur={3}
          opacity={0.55}
          resolution={1024}
          frames={1}
          color="#05080f"
        />
        <Gates gates={gates} />
        {CHECKPOINT_PLANS.map((plan) => (
          <CheckpointLabel
            key={plan.n}
            plan={plan}
            gates={byCp.get(plan.n) ?? []}
            hidden={focus.n !== null}
            onPick={onPick}
          />
        ))}
        <CameraRig focus={focus} />
        {/* orthographic: ลากซ้ายหมุน · ลากขวาเลื่อน · ลูกกลิ้งซูม (ซูมออกได้สุดเท่าภาพรวม) */}
        <OrbitControls
          makeDefault
          minPolarAngle={0.15}
          maxPolarAngle={1.2}
          enablePan
          screenSpacePanning
          enableDamping
          zoomToCursor
          maxZoom={MAX_ZOOM}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        />
      </Canvas>
    </div>
  );
}

/** ช่องทางปิด: กรวยจราจรขวางปากช่องทาง + ป้ายกากบาทแดงเหนือเลน */
/** กรวย 2 ลูกขวางเลน แบ่งความกว้างเลนเป็น 4 ส่วน วางที่ 1/4 และ 3/4 (คร่อมกลางเลน อยู่ในเลนของตัวเองเสมอ) */
function coneOffsets(laneW: number) {
  return [-laneW / 4, laneW / 4];
}

function ClosedLane({ f, laneW, up }: { f: Lane['frame']; laneW: number; up: number }) {
  const x = f.ticketX + up * 2.6; // ออกมาหน้าป้อมพอให้ตัวป้อมไม่บังกรวยลูกที่ชิดเกาะ
  const span = Math.min(laneW, LANE_WIDTH) * 0.7;
  const sign = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    if (sign.current)
      sign.current.emissiveIntensity = 1.6 + Math.sin(state.clock.elapsedTime * 4) * 1;
  });
  return (
    <group>
      {/* กรวยวางขวางเลน · จำนวนและระยะห่างตามความกว้างเลนจริง ไม่ล้นไปเลนข้าง ๆ (ลานแคบ เช่น ป้อมจตุรทิศ) */}
      {coneOffsets(laneW).map((dz) => (
        <group key={dz} position={[x, 0, f.z + dz]}>
          <TrafficCone />
        </group>
      ))}
      <group
        position={[x + up * 0.4, 1.7, f.z]}
        rotation={[0, up > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
      >
        <mesh>
          <boxGeometry args={[0.7, 0.7, 0.04]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        {[Math.PI / 4, -Math.PI / 4].map((r) => (
          <mesh key={r} position={[0, 0, 0.03]} rotation={[0, 0, r]}>
            <boxGeometry args={[0.62, 0.1, 0.02]} />
            <meshStandardMaterial
              ref={r > 0 ? sign : undefined}
              color="#ef4444"
              emissive="#ef4444"
              emissiveIntensity={2}
            />
          </mesh>
        ))}
      </group>
      <mesh position={[x + up * 0.4, 0.68, f.z + span / 2 + 0.25]}>
        <cylinderGeometry args={[0.03, 0.03, 1.36, 8]} />
        <meshStandardMaterial color="#9aa6ba" />
      </mesh>
    </group>
  );
}

/* ---------- ท้องฟ้า แสง ไฟถนน ---------- */
/**
 * แสงและสีของฉาก: ค่อย ๆ ไล่จากกลางวันไปกลางคืน (และกลับ) ประมาณ 3–4 วินาที
 * t = 0 กลางวัน, 1 กลางคืน
 */
function SkyLights({ env }: { env: SceneEnv }) {
  const scene = useThree((s) => s.scene);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const t = useRef(env.night ? 1 : 0);
  const bg = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    const target = env.night ? 1 : 0;
    t.current = THREE.MathUtils.damp(t.current, target, 0.9, Math.min(delta, 0.1));
    if (Math.abs(t.current - target) < 0.001) t.current = target;
    const k = t.current;
    bg.lerpColors(DN.bg[0]!, DN.bg[1]!, k);
    scene.background = bg;
    scene.fog = null; // ปิดเอฟเฟกต์อากาศ
    if (hemi.current) {
      hemi.current.color.lerpColors(DN.hemiSky[0]!, DN.hemiSky[1]!, k);
      hemi.current.groundColor.lerpColors(DN.hemiGround[0]!, DN.hemiGround[1]!, k);
      hemi.current.intensity = lerp(1.6, 1.1, k);
    }
    if (ambient.current) ambient.current.intensity = lerp(0.55, 0.4, k);
    if (sun.current) {
      sun.current.color.lerpColors(DN.sun[0]!, DN.sun[1]!, k);
      sun.current.intensity = lerp(1.4, 0.5, k);
      sun.current.position.lerpVectors(DN.sunPos[0]!, DN.sunPos[1]!, k);
    }
    MAT.road.color.lerpColors(DN.road[0]!, DN.road[1]!, k);
    MAT.ground.color.lerpColors(DN.ground[0]!, DN.ground[1]!, k);
    MAT.bay.color.lerpColors(DN.bay[0]!, DN.bay[1]!, k);
    MAT.window.emissiveIntensity = lerp(0.15, 1.6, k);
    MAT.window.opacity = lerp(0.45, 0.9, k);
    MAT.lampHead.emissiveIntensity = lerp(0, 3, k);
    MAT.glow.opacity = lerp(0, 0.55, k);
    MAT.glow.visible = k > 0.01;
    // ผับเปิดเฉพาะกลางคืน
    for (const m of PUB_NEON) m.emissiveIntensity = lerp(0, 3, k);
    for (const m of PUB_DOOR) m.emissiveIntensity = lerp(0, 0.9, k);
    PUB_WINDOW.emissiveIntensity = lerp(0, 0.6, k);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#cfe3ff', '#4a5a46', 1.3]} />
      <ambientLight ref={ambient} intensity={0.6} />
      <directionalLight
        ref={sun}
        position={[-50, 90, 40]}
        intensity={3.2}
        color="#fff4dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-bias={-0.0005}
      />
    </>
  );
}

/** แสงฟุ้งจากกลางวงออกไปขอบ (ใช้กับวงแสงไฟถนนบนพื้น) */
let glowTexture: THREE.Texture | null = null;
function getGlowTexture() {
  if (glowTexture || typeof document === 'undefined') return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,190,110,1)');
  grad.addColorStop(0.45, 'rgba(255,160,70,0.45)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

function StreetLights() {
  useMemo(() => {
    MAT.glow.map = getGlowTexture();
  }, []);
  const posts = useMemo(
    () =>
      SPINE.map((p, i) => ({ p, i }))
        .filter(({ i }) => i % 9 === 4)
        .flatMap(({ p, i }) => {
          const n = southAt(i);
          return [-1, 1].map((side) => ({
            x: p.x + n.x * side * (ROAD_WIDTH / 2 + 0.35),
            z: p.y + n.y * side * (ROAD_WIDTH / 2 + 0.35),
            side,
            n,
          }));
        }),
    [],
  );
  return (
    <>
      {posts.map(({ x, z, side, n }, k) => (
        <group key={k} position={[x, 0, z]}>
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 3.2, 8]} />
            <meshStandardMaterial color="#4b5875" />
          </mesh>
          <mesh position={[-n.x * side * 0.45, 3.15, -n.y * side * 0.45]}>
            <boxGeometry args={[0.5, 0.1, 0.25]} />
            <primitive object={MAT.lampHead} attach="material" />
          </mesh>
          <mesh
            position={[-n.x * side * 0.6, 0.08, -n.y * side * 0.6]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[3.4, 3.4]} />
            <primitive object={MAT.glow} attach="material" />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** กรวยจราจร: ตัวกรวยทรงเรียวโค้ง สีส้มเงา แถบสะท้อนแสงขาว 2 แถบ ฐานสี่เหลี่ยมสีดำ */
const CONE_H = 0.46;
const coneBody = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.135, 0),
    new THREE.Vector2(0.125, 0.04),
    new THREE.Vector2(0.075, CONE_H * 0.62),
    new THREE.Vector2(0.03, CONE_H * 0.97),
    new THREE.Vector2(0.022, CONE_H),
    new THREE.Vector2(0, CONE_H),
  ],
  28,
);
const coneBand = (y: number, h: number) => {
  const r = (yy: number) => 0.135 - (0.105 * yy) / CONE_H + 0.004;
  return new THREE.CylinderGeometry(r(y + h), r(y), h, 28, 1, true);
};
const BAND_LOW = coneBand(0.13, 0.06);
const BAND_HIGH = coneBand(0.27, 0.05);
function TrafficCone() {
  return (
    <group>
      <RoundedBox
        args={[0.34, 0.035, 0.34]}
        radius={0.012}
        position={[0, 0.018, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#1f2328" roughness={0.8} />
      </RoundedBox>
      <mesh geometry={coneBody} position={[0, 0.035, 0]} castShadow>
        <meshPhysicalMaterial
          color="#ff6a13"
          roughness={0.35}
          clearcoat={0.6}
          clearcoatRoughness={0.3}
        />
      </mesh>
      <mesh geometry={BAND_LOW} position={[0, 0.035 + 0.13 + 0.03, 0]}>
        <meshStandardMaterial
          color="#f5f7fa"
          emissive="#ffffff"
          emissiveIntensity={0.25}
          roughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={BAND_HIGH} position={[0, 0.035 + 0.27 + 0.025, 0]}>
        <meshStandardMaterial
          color="#f5f7fa"
          emissive="#ffffff"
          emissiveIntensity={0.25}
          roughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
