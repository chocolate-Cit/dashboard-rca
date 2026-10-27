'use client';

import { useEffect, useRef, type RefObject } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  formatBaht,
  formatBahtCompact,
  formatDate,
  formatDayMonth,
  formatWeekday,
} from '../lib/format';

type Point = { date: string; value: number };

type Props = {
  data: Point[];
  label: string;
  height?: number;
  valueFormatter?: (v: number) => string;
  axisFormatter?: (v: number) => string;
  /** ข้อมูลห่าง ๆ (เช่น % รายวันที่บางวันไม่มีงาน) ใช้เส้นตรง + จุด เพื่อไม่ให้เส้นโค้งสร้างค่าที่ไม่มีจริง */
  sparse?: boolean;
  domain?: [number, number];
  /** วาดเส้นจากซ้ายไปขวาครั้งแรกที่แสดง (พื้นใต้เส้นเผยตามไปด้วย) */
  draw?: boolean;
};

function ChartTooltip({
  active,
  payload,
  label,
  name,
  fmt,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  name: string;
  fmt: (v: number) => string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-pop">
      <p className="text-xs text-muted">
        {formatWeekday(label)} {formatDate(label)}
      </p>
      <p className="num mt-0.5 font-semibold">
        {name} {fmt(payload[0]!.value)}
      </p>
    </div>
  );
}

/**
 * แนวโน้มรายวัน: area สีเดียว (--primary) เส้น 2px แกน Y เป็นบาท
 * มีข้อความสรุปสำหรับ screen reader แทนการอ่านกราฟ
 */
/**
 * วาดเส้นกราฟจากซ้ายไปขวาครั้งเดียว: เส้นใช้ stroke-dash ตามความยาวจริงของ path
 * ส่วนพื้นใต้เส้นใช้ clip-path เผยจากซ้ายพร้อมกัน · รอ Recharts วาด path เสร็จก่อน (ResponsiveContainer วัดขนาดแบบ async)
 */
function useDrawOnce(box: RefObject<HTMLDivElement | null>, enabled: boolean | undefined) {
  const done = useRef(false);
  useEffect(() => {
    if (!enabled || done.current) return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let io: IntersectionObserver | undefined;
    const started = performance.now();
    const run = () => {
      const curve = box.current?.querySelector<SVGPathElement>('.recharts-area-curve');
      const fill = box.current?.querySelector<SVGPathElement>('.recharts-area-area');
      if (!curve || !fill) {
        // รอได้นานสุด ~5 วินาที (ตอนเปิดหน้าโมเดล 3 มิติโหลดหนัก เฟรมแรก ๆ อาจช้า)
        if (performance.now() - started < 5000) raf = requestAnimationFrame(run);
        return;
      }
      done.current = true;
      // ซ่อนเส้นไว้ก่อน แล้วค่อยวาดเมื่อกราฟเลื่อนเข้ามาในจอ (ไม่วาดตอนหน้ายังโหลดโมเดล 3 มิติอยู่)
      const len = curve.getTotalLength();
      curve.style.strokeDasharray = `${len}`;
      curve.style.strokeDashoffset = `${len}`;
      fill.style.clipPath = 'inset(0 100% 0 0)';
      io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io?.disconnect();
          const opts: KeyframeAnimationOptions = {
            duration: 1600,
            delay: 200,
            easing: 'cubic-bezier(0.45, 0, 0.2, 1)',
            fill: 'forwards',
          };
          const a = curve.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], opts);
          const f = fill.animate(
            [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }],
            opts,
          );
          a.onfinish = () => {
            curve.style.strokeDasharray = '';
            curve.style.strokeDashoffset = '';
            a.cancel();
          };
          f.onfinish = () => {
            fill.style.clipPath = '';
            f.cancel();
          };
        },
        { threshold: 0.5 },
      );
      io.observe(box.current!);
    };
    raf = requestAnimationFrame(run);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [box, enabled]);
}

export function AreaTrend({
  data,
  label,
  height = 260,
  valueFormatter = formatBaht,
  axisFormatter = formatBahtCompact,
  sparse,
  domain,
  draw,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  useDrawOnce(box, draw && data.length > 1);
  const total = data.reduce((a, p) => a + p.value, 0);
  const peak = data.reduce<Point | null>((m, p) => (!m || p.value > m.value ? p : m), null);
  const summary = peak
    ? `${label} ${data.length} วัน${valueFormatter === formatBaht ? ` รวม ${valueFormatter(total)}` : ''} สูงสุด ${valueFormatter(peak.value)} วันที่ ${formatDate(peak.date)}`
    : `${label}: ไม่มีข้อมูล`;
  const interval = data.length > 20 ? Math.ceil(data.length / 7) - 1 : data.length > 10 ? 1 : 0;

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{summary}</figcaption>
      <div ref={box} style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="area-trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => formatDayMonth(d)}
              interval={interval}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              tickMargin={8}
              minTickGap={8}
            />
            <YAxis
              tickFormatter={axisFormatter}
              domain={domain ?? [0, 'auto']}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              width={64}
            />
            <Tooltip
              cursor={{ stroke: 'var(--text-muted)', strokeWidth: 1, strokeDasharray: '3 3' }}
              content={<ChartTooltip name={label} fmt={valueFormatter} />}
            />
            <Area
              type={sparse ? 'linear' : 'monotone'}
              dataKey="value"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#area-trend-fill)"
              activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--primary)' }}
              dot={
                sparse || data.length === 1
                  ? { r: 4, fill: 'var(--primary)', stroke: 'var(--surface)', strokeWidth: 2 }
                  : false
              }
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
