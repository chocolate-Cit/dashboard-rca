'use client';

import { CHECKPOINTS } from '@gip/api';
import { useEffect, useState, type ReactNode } from 'react';
import { CitLogo } from './cit-logo';

/*
 * ผังย่อในพิกัด viewBox 600×300 · ถนนหลักแนวนอน 2 เลน และถนนเชื่อมของป้อม 2, 4, 5 แนวตั้ง 2 เลน
 * รถวิ่งชิดซ้าย (ไทย): ไปทางตะวันออกใช้เลนบน ไปทางตะวันตกใช้เลนล่าง
 * ขึ้นเหนือใช้เลนซ้าย (x − 7) ลงใต้ใช้เลนขวา (x + 7)
 */
const MAIN_Y = 130;
const MAIN_HALF = 16;
const BRANCH_HALF = 14;
const LANE = 7;
const BRANCHES = [
  { n: 4, x: 230, dir: -1 }, // แยกขึ้นทิศเหนือ
  { n: 5, x: 340, dir: -1 },
  { n: 2, x: 420, dir: 1 }, // แยกลงทิศใต้
] as const;
const EDGE_N = MAIN_Y - MAIN_HALF;
const EDGE_S = MAIN_Y + MAIN_HALF;

type Car = { path: string; dur: number; begin: number; color: string; fade?: boolean };
/**
 * รถบนเลนเดียวกันใช้ความเร็วเท่ากันและเว้นระยะเท่ากัน (begin ห่างกัน dur / จำนวนคัน) จึงไม่ซ้อนกัน
 * รถบนถนนเชื่อมวิ่งระหว่างขอบถนนหลักกับปลายถนน และจางหายที่ขอบ จึงไม่ตัดกับรถบนถนนหลัก
 */
const CARS: Car[] = [
  ...[0, 1, 2].map((i) => ({
    path: `M -20 ${MAIN_Y - LANE} L 620 ${MAIN_Y - LANE}`,
    dur: 12,
    begin: -i * 4,
    color: ['#60a5fa', '#f8fafc', '#fbbf24'][i]!,
  })),
  ...[0, 1, 2].map((i) => ({
    path: `M 620 ${MAIN_Y + LANE} L -20 ${MAIN_Y + LANE}`,
    dur: 13,
    begin: -2 - (i * 13) / 3,
    color: ['#f8fafc', '#34d399', '#60a5fa'][i]!,
  })),
  ...BRANCHES.flatMap(({ x, dir }, k) => {
    const edge = dir < 0 ? EDGE_N - 2 : EDGE_S + 2;
    const far = dir < 0 ? -10 : 310;
    // ออกจากถนนหลัก (วิ่งห่างออกไป) และเข้าหาถนนหลัก คนละเลน
    const awayX = dir < 0 ? x - LANE : x + LANE;
    const towardX = dir < 0 ? x + LANE : x - LANE;
    return [
      {
        path: `M ${awayX} ${edge} L ${awayX} ${far}`,
        dur: 5.5,
        begin: -k * 1.7,
        color: '#f8fafc',
        fade: true,
      },
      {
        path: `M ${towardX} ${far} L ${towardX} ${edge}`,
        dur: 6,
        begin: -2.5 - k * 1.3,
        color: '#fbbf24',
        fade: true,
      },
    ];
  }),
];

/** ป้ายป้อมวางข้างถนน ไม่ทับเลนรถ: [x, y, ทิศข้อความ] */
const NODES: Record<number, [number, number, 'start' | 'end' | 'middle']> = {
  1: [70, EDGE_N - 20, 'middle'],
  2: [420 + BRANCH_HALF + 16, 236, 'start'],
  3: [540, EDGE_N - 20, 'middle'],
  4: [230 - BRANCH_HALF - 16, 62, 'end'],
  5: [340 + BRANCH_HALF + 16, 62, 'start'],
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

type Props = {
  appName: string;
  headline: [string, string];
  /** ไอคอนส่งเป็น element (เช่น <Wrench />) เพราะหน้า login เป็น server component */
  points: { icon: ReactNode; text: string }[];
};

/**
 * แผงแบรนด์ของหน้า Login: ผังย่อ 5 ป้อมที่มีชีวิต (รถวิ่งตามเลน ป้อมกะพริบ)
 * ใช้ร่วมกันทั้งสองเว็บ ชื่อป้อมมาจาก CHECKPOINTS ชุดเดียวกับ Dashboard
 * ผู้ใช้ที่ตั้งค่าลดการเคลื่อนไหวจะเห็นผังนิ่ง
 */
export function LoginPanel({ appName, headline, points }: Props) {
  const reduced = useReducedMotion();
  return (
    <div className="login-panel relative isolate flex h-full flex-col justify-between overflow-hidden p-10 text-[#c9d3e6] xl:p-14">
      {/* แสงพื้นหลังที่ลอยช้า ๆ + ตารางจาง ๆ */}
      <div className="login-glow login-glow-a" aria-hidden />
      <div className="login-glow login-glow-b" aria-hidden />
      <div className="login-grid absolute inset-0 -z-10" aria-hidden />

      <div className="login-rise flex items-center gap-2.5" style={{ animationDelay: '0ms' }}>
        <CitLogo tone="dark" className="h-8" />
        <span className="h-8 w-px bg-white/15" aria-hidden />
        <span className="leading-tight">
          <span className="block text-base font-semibold text-white">Go Inno Parking</span>
          <span className="block text-xs text-[#8b98b3]">{appName}</span>
        </span>
      </div>

      <div className="max-w-lg">
        <h2 className="text-3xl leading-snug font-semibold tracking-tight text-white xl:text-[2.6rem] xl:leading-[1.25]">
          <span className="login-rise block" style={{ animationDelay: '80ms' }}>
            {headline[0]}
          </span>
          <span className="login-rise block text-[#93c5fd]" style={{ animationDelay: '160ms' }}>
            {headline[1]}
          </span>
        </h2>
        <ul className="mt-8 flex flex-col gap-3 text-sm">
          {points.map(({ icon, text }, i) => (
            <li
              key={text}
              className="login-rise flex items-center gap-3"
              style={{ animationDelay: `${260 + i * 70}ms` }}
            >
              <span
                className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-white ring-1 ring-white/10 [&_svg]:size-4"
                aria-hidden
              >
                {icon}
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <figure className="login-rise" style={{ animationDelay: '480ms' }}>
        <svg
          viewBox="0 0 600 300"
          className="w-full max-w-xl"
          role="img"
          aria-label="ผังย่อ 5 ป้อมของลานจอด"
        >
          <defs>
            <filter id="login-car-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
          </defs>
          {/* ถนน: ผิวถนน → เส้นขอบ → เส้นแบ่งทิศสีเหลือง (ถนนเชื่อมวาดก่อนให้ถนนหลักทับรอยต่อ) */}
          {BRANCHES.map(({ n, x, dir }) => {
            const y1 = dir < 0 ? -10 : EDGE_S;
            const y2 = dir < 0 ? EDGE_N : 310;
            return (
              <g key={n}>
                <rect
                  x={x - BRANCH_HALF}
                  y={Math.min(y1, y2)}
                  width={BRANCH_HALF * 2}
                  height={Math.abs(y2 - y1)}
                  fill="#1b2742"
                />
                <line
                  x1={x - BRANCH_HALF}
                  y1={y1}
                  x2={x - BRANCH_HALF}
                  y2={y2}
                  stroke="rgb(255 255 255 / 0.35)"
                  strokeWidth="1"
                />
                <line
                  x1={x + BRANCH_HALF}
                  y1={y1}
                  x2={x + BRANCH_HALF}
                  y2={y2}
                  stroke="rgb(255 255 255 / 0.35)"
                  strokeWidth="1"
                />
                <line
                  x1={x}
                  y1={y1}
                  x2={x}
                  y2={y2}
                  stroke="#eab308"
                  strokeOpacity="0.75"
                  strokeWidth="1.2"
                  strokeDasharray="8 6"
                />
              </g>
            );
          })}
          <rect x="-20" y={EDGE_N} width="640" height={MAIN_HALF * 2} fill="#1b2742" />
          {[EDGE_N, EDGE_S].map((y) => (
            <line
              key={y}
              x1="-20"
              y1={y}
              x2="620"
              y2={y}
              stroke="rgb(255 255 255 / 0.35)"
              strokeWidth="1"
            />
          ))}
          {/* ปากทางเข้าถนนเชื่อม: เว้นเส้นขอบถนนหลัก */}
          {BRANCHES.map(({ n, x, dir }) => (
            <line
              key={n}
              x1={x - BRANCH_HALF + 0.5}
              x2={x + BRANCH_HALF - 0.5}
              y1={dir < 0 ? EDGE_N : EDGE_S}
              y2={dir < 0 ? EDGE_N : EDGE_S}
              stroke="#1b2742"
              strokeWidth="2"
            />
          ))}
          <line
            x1="-20"
            y1={MAIN_Y - 1.2}
            x2="620"
            y2={MAIN_Y - 1.2}
            stroke="#eab308"
            strokeOpacity="0.8"
            strokeWidth="1"
          />
          <line
            x1="-20"
            y1={MAIN_Y + 1.2}
            x2="620"
            y2={MAIN_Y + 1.2}
            stroke="#eab308"
            strokeOpacity="0.8"
            strokeWidth="1"
          />

          {/* รถ */}
          {!reduced &&
            CARS.map(({ path, dur, begin, color, fade }, i) => (
              <g key={i}>
                {fade && (
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    keyTimes="0;0.12;0.88;1"
                    dur={`${dur}s`}
                    begin={`${begin}s`}
                    repeatCount="indefinite"
                  />
                )}
                <animateMotion
                  path={path}
                  dur={`${dur}s`}
                  begin={`${begin}s`}
                  repeatCount="indefinite"
                  rotate="auto"
                />
                <rect
                  x="-7"
                  y="-3.5"
                  width="14"
                  height="7"
                  rx="2.5"
                  fill={color}
                  filter="url(#login-car-glow)"
                  opacity="0.6"
                />
                <rect x="-6" y="-3" width="12" height="6" rx="2" fill={color} />
                <rect
                  x="1.5"
                  y="-2.2"
                  width="2.5"
                  height="4.4"
                  rx="0.8"
                  fill="#0b1530"
                  opacity="0.55"
                />
              </g>
            ))}

          {/* ป้อม: หมุดข้างถนน + วงกะพริบ */}
          {CHECKPOINTS.map((c, i) => {
            const [x, y, anchor] = NODES[c.n]!;
            const lx = anchor === 'start' ? x + 15 : anchor === 'end' ? x - 15 : x;
            const ly = anchor === 'middle' ? y - 18 : y + 0.5;
            return (
              <g key={c.n}>
                {!reduced && (
                  <circle
                    cx={x}
                    cy={y}
                    r="10"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                    className="login-pulse"
                    style={{ animationDelay: `${i * 0.55}s` }}
                  />
                )}
                <circle cx={x} cy={y} r="9" fill="#2563eb" stroke="#0b1530" strokeWidth="3" />
                <text
                  x={x}
                  y={y + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9.5"
                  fontWeight="600"
                  fill="#fff"
                >
                  {c.n}
                </text>
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fontSize="11.5"
                  fill="#a7b2c8"
                >
                  {c.name.replace(/^ป้อม/, '')}
                </text>
              </g>
            );
          })}
        </svg>
        <figcaption className="mt-1 flex items-center gap-2 text-xs text-[#8b98b3]">
          <span className="relative flex size-2" aria-hidden>
            <span
              className={
                reduced ? undefined : 'absolute inset-0 animate-ping rounded-full bg-emerald-400/70'
              }
            />
            <span className="relative size-2 rounded-full bg-emerald-400" />
          </span>
          ผังย่อ 5 ป้อมของลานจอด
        </figcaption>
      </figure>
    </div>
  );
}
