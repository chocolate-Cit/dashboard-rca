'use client';

import { heatLevel, HEATMAP_LEVELS, type HeatmapModel } from '@gip/api/calc';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { formatHourRange, formatNumber } from '../lib/format';

const levelClass = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

type Props = {
  model: HeatmapModel;
  /** หน่วยของค่า เช่น "คัน/ชม." */
  unit: string;
  label: string;
};

type Hover = { row: number; hour: number } | null;

/**
 * Heatmap จุด × ชั่วโมง สเกลสีเดียว 5 ระดับ
 * - hover หรือโฟกัสด้วยคีย์บอร์ดเพื่อดูค่าจริง (ลูกศรเลื่อนช่องได้)
 * - กล่องเลื่อนแนวนอนได้เองบนจอแคบ ชื่อจุดติดอยู่ทางซ้าย
 */
export function Heatmap({ model, unit, label }: Props) {
  const [hover, setHover] = useState<Hover>(null);
  const [focus, setFocus] = useState<{ row: number; hour: number }>({ row: 0, hour: 8 });
  const scroller = useRef<HTMLDivElement>(null);
  // จอแคบ: เปิดมาที่ช่วงเช้าซึ่งเริ่มมีรถ แทนช่วงตีหนึ่งตีสองที่ว่างเปล่า
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth * 0.22;
  }, []);
  // ช่องสีค่อย ๆ สว่างไล่ตามชั่วโมง เมื่อ heatmap เลื่อนเข้ามาในจอ (ครั้งเดียว)
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return setShown(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setShown(true);
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const active = hover ?? null;
  const activeRow = active ? model.rows[active.row] : null;
  const activeValue = active && activeRow ? activeRow.values[active.hour]! : null;

  function move(e: React.KeyboardEvent) {
    const d: Record<string, [number, number]> = {
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
    };
    const step = d[e.key];
    if (!step) return;
    e.preventDefault();
    const row = Math.min(model.rows.length - 1, Math.max(0, focus.row + step[0]));
    const hour = Math.min(23, Math.max(0, focus.hour + step[1]));
    setFocus({ row, hour });
    setHover({ row, hour });
    document.getElementById(`hm-${row}-${hour}`)?.focus();
  }

  const peakText = model.peak
    ? `ช่วงที่หนาแน่นที่สุดคือ ${model.peak.site.name} เวลา ${formatHourRange(model.peak.hour)}${unit.includes('เฉลี่ย') ? ' เฉลี่ย' : ''} ${formatNumber(model.peak.value)} ${unit}`
    : 'ไม่มีข้อมูลในช่วงนี้';

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        {label}. {peakText}
      </figcaption>

      <div
        className="mb-3 flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm"
        aria-live="polite"
      >
        <p className="num text-muted">
          {activeRow && activeValue !== null ? (
            <>
              <span className="font-medium text-text">{activeRow.site.name}</span> ·{' '}
              {formatHourRange(active!.hour)} ·{' '}
              <span className="font-semibold text-text">{formatNumber(activeValue)}</span> {unit}
            </>
          ) : (
            peakText
          )}
        </p>
        <Legend thresholds={model.thresholds} unit={unit} />
      </div>

      <p className="mb-2 text-xs text-muted md:hidden" aria-hidden>
        ← เลื่อนซ้าย–ขวาเพื่อดูชั่วโมงอื่น →
      </p>
      <div
        ref={scroller}
        className="relative overflow-x-auto overscroll-x-contain pb-2"
        role="region"
        aria-label={`${label} (เลื่อนแนวนอนได้)`}
        tabIndex={-1}
      >
        <table
          className="w-full min-w-[720px] border-separate border-spacing-[2px]"
          onMouseLeave={() => setHover(null)}
          onKeyDown={move}
          role="grid"
          aria-label={label}
        >
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface" />
              {HOURS.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    'num h-6 text-center text-[11px] font-normal text-muted',
                    active?.hour === h && 'text-text',
                  )}
                >
                  {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
                  <span className="sr-only">{formatHourRange(h)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row, r) => (
              <tr key={row.site.id}>
                <th
                  scope="row"
                  className={cn(
                    'sticky left-0 z-10 bg-surface pr-3 text-left text-xs font-normal whitespace-nowrap text-muted',
                    active?.row === r && 'text-text',
                  )}
                >
                  <span className="font-medium">{row.site.code}</span>
                  <span className="hidden lg:inline">
                    {' '}
                    · {row.site.name.replace(/^ทาง(เข้า|ออก) [A-Z] /, '')}
                  </span>
                </th>
                {row.values.map((v, h) => {
                  const level = heatLevel(v, model.max);
                  const isActive = active?.row === r && active.hour === h;
                  return (
                    <td
                      key={h}
                      id={`hm-${r}-${h}`}
                      role="gridcell"
                      tabIndex={focus.row === r && focus.hour === h ? 0 : -1}
                      aria-label={`${row.site.name} ${formatHourRange(h)}: ${formatNumber(v)} ${unit}`}
                      onMouseEnter={() => setHover({ row: r, hour: h })}
                      onFocus={() => {
                        setFocus({ row: r, hour: h });
                        setHover({ row: r, hour: h });
                      }}
                      style={shown ? { animationDelay: `${150 + h * 45 + r * 14}ms` } : undefined}
                      className={cn(
                        'h-8 min-w-6 rounded-[3px] transition-[box-shadow] duration-100 outline-none',
                        levelClass[level],
                        shown ? 'heat-in' : 'opacity-0',
                        isActive && 'ring-2 ring-text ring-offset-1 ring-offset-surface',
                      )}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function Legend({ thresholds, unit }: { thresholds: number[]; unit: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted" aria-label="คำอธิบายสี">
      <span>น้อย</span>
      <ol className="flex gap-[2px]">
        {Array.from({ length: HEATMAP_LEVELS }, (_, i) => {
          const lo = i === 0 ? 0 : thresholds[i - 1]! + 1;
          const hi = thresholds[i]!;
          return (
            <li
              key={i}
              className={cn('h-3 w-6 first:rounded-l-[3px] last:rounded-r-[3px]', levelClass[i])}
              title={`${formatNumber(lo)}–${formatNumber(hi)} ${unit}`}
            >
              <span className="sr-only">
                ระดับ {i + 1}: {formatNumber(lo)}–{formatNumber(hi)} {unit}
              </span>
            </li>
          );
        })}
      </ol>
      <span>มาก</span>
    </div>
  );
}
