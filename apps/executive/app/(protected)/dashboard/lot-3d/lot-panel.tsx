'use client';

import {
  CHECKPOINTS,
  checkpointLabel,
  equipmentTypeLabel,
  type EquipmentStatus,
  type TrafficCell,
} from '@gip/api';
import { toSiteDate, toSiteHour } from '@gip/api/calc';
import { useIncidents, useRevenuePoints, useTrafficHeatmap } from '@gip/api/hooks';
import { useLiveEquipmentStatus } from '@/lib/live-equipment';
import { useLiveDashboardSummary } from '@/lib/live-summary';
import { cn, formatBaht, formatNumber, Panel, SegmentedControl, Skeleton } from '@gip/ui';
import {
  CircleCheck,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  LogIn,
  LogOut,
  Map as MapIcon,
  Moon,
  Move3d,
  QrCode,
  RotateCcw,
  Sun,
  TriangleAlert,
  Wrench,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CameraFocus, GateModel } from './scene';
import { BarrierTestControl, useBarrierTest } from './barrier-test';
import { resolveEnv, useWeather, type SkyMode } from './weather';

const LotScene = dynamic(() => import('./scene'), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

/** เรนเดอร์ 3D เฉพาะตอนอยู่บนจอ ประหยัด GPU/แบตเตอรี่เมื่อเลื่อนผ่านไปแล้ว */
function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), {
      rootMargin: '120px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, visible] as const;
}

/**
 * ภาพลานจอด 3D แบบสด
 * - ด่านแต่ละจุด: ไฟเขียว/แดงตามสถานะอุปกรณ์จริง ไม้กั้นยกเมื่อมีรถผ่าน
 * - ความถี่รถที่วิ่งผ่านด่าน = ปริมาณรถจริงของชั่วโมงนี้
 * - จำนวนรถที่จอด = สัดส่วนรถที่เข้าวันนี้แล้วยังไม่ออก
 */
export function LotPanel() {
  const today = toSiteDate(new Date());
  const range = { from: today, to: today };
  const status = useLiveEquipmentStatus();
  const traffic = useTrafficHeatmap(range);
  const revenue = useRevenuePoints(range);
  const summary = useLiveDashboardSummary(range);
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const hour = toSiteHour(new Date());
  const [focus, setFocus] = useState<CameraFocus>({ n: null, seq: 0 });
  const weather = useWeather();
  const [skyMode, setSkyMode] = useState<SkyMode>('auto');
  const env = resolveEnv(skyMode, weather.data);
  const barrierTest = useBarrierTest();
  // ไม้กั้นตู้ทดสอบ: ยก/ลงตามสถานะจริงที่ไม้กั้นแจ้งกลับ (webhook)
  const armSite = barrierTest.arm?.site;
  const armOpen = barrierTest.arm?.armOpen ?? false;
  // งานซ่อมที่ช่างกำลังทำหน้างาน: ช่องทางนั้นต้องปิดป้อมระหว่างตรวจสอบ
  const working = useIncidents({ status: ['in_progress'] });

  const gates = useMemo<GateModel[]>(() => {
    if (!status.data) return [];
    // รหัสช่องทาง CP{ป้อม}-{IN|OUT}{ลำดับ} → ตำแหน่งบนผัง
    const parsed = status.data
      .map((row) => ({ row, m: /^CP(\d+)-(IN|OUT)(\d+)$/.exec(row.site.code) }))
      .filter((x): x is { row: EquipmentStatus[number]; m: RegExpExecArray } => !!x.m);
    const order = (cp: number) =>
      parsed
        .filter((x) => Number(x.m[1]) === cp)
        .sort((a, b) =>
          a.m[2] === b.m[2] ? Number(a.m[3]) - Number(b.m[3]) : a.m[2] === 'OUT' ? -1 : 1,
        )
        .map((x) => x.row.site.id);
    return parsed.map(({ row: { site, items, down, stuck }, m }) => {
      const cp = Number(m[1]);
      const lanes = order(cp);
      const cell = traffic.data?.cells.find(
        (c) => c.siteId === site.id && c.hour === Math.max(0, hour - 1),
      );
      const rate = cell ? (site.direction === 'in' ? cell.carsIn : cell.carsOut) : 0;
      const barriers = items.filter((e) => e.type === 'barrier');
      // Dashboard ผู้บริหารมีแค่ 2 สถานะ: ปกติ (เขียว) / เสีย (แดง) · อุปกรณ์ค้างนับเป็นเสีย
      const barrier: GateModel['barrier'] = barriers.some((e) => e.status !== 'normal')
        ? 'down'
        : 'normal';
      const kiosks = items.filter((e) => e.type === 'ticket' || e.type === 'payment');
      const kiosk: GateModel['kiosk'] = kiosks.some((e) => e.status !== 'normal')
        ? 'down'
        : 'normal';
      const issues = [
        ...new Set(
          items
            .filter((e) => e.status !== 'normal')
            .map((e) => `${equipmentTypeLabel[e.type]}เสีย`),
        ),
      ];
      const tone: GateModel['tone'] = down + stuck > 0 ? 'down' : 'ok';
      return {
        id: site.id,
        code: site.code,
        direction: site.direction,
        cp,
        laneIndex: Number(m[3]) - 1,
        laneCount: lanes.length,
        rate,
        tone,
        barrier,
        // ตู้ทดสอบ: สถานะจริงที่ไม้กั้นแจ้งกลับ (webhook) ไม่ใช่ผลของคำสั่ง
        armOpen: armSite === site.code ? armOpen : barriers.some((e) => e.armOpen === true),
        kiosk,
        maintenance: working.data?.find((i) => i.siteId === site.id)?.code ?? null,
        issues: issues.map((x) => `${site.code} ${x}`),
      };
    });
  }, [status.data, traffic.data, hour, armSite, armOpen, working.data]);

  const s = summary.data;
  const inside = s ? s.carsInside : 0;
  const downGates = gates.filter((g) => g.tone === 'down');
  const closed = gates.filter((g) => g.barrier === 'down');
  const maintGates = gates.filter((g) => g.maintenance !== null);
  const ready = gates.length > 0 && !!s;

  return (
    <Panel
      id="lot-3d"
      title="ผังลานจอดตอนนี้"
      description="ภาพจำลอง 3 มิติตามผัง 5 ป้อม จากข้อมูลสด"
      bodyClassName="p-0 sm:p-0"
      actions={
        <span className="hidden items-center gap-1.5 text-xs text-muted sm:inline-flex">
          <Move3d className="size-4" aria-hidden />
          {/* คำแนะนำตามอุปกรณ์: เมาส์ vs จอสัมผัส (iPad/แท็บเล็ต) */}
          <span className="pointer-coarse:hidden">
            ลากเพื่อหมุน · คลิกขวาลากเพื่อเลื่อน · เลื่อนลูกกลิ้งเพื่อซูม
          </span>
          <span className="hidden pointer-coarse:inline">
            ลากนิ้วเดียวเพื่อหมุน · ใช้สองนิ้วเพื่อซูมและเลื่อน
          </span>
        </span>
      }
    >
      <CheckpointPicker
        gates={gates}
        focus={focus}
        onPick={(n) => setFocus((f) => ({ n, seq: f.seq + 1 }))}
      />
      <div
        ref={ref}
        className={cn(
          'relative overflow-hidden border-t border-border bg-bg',
          'h-[480px] rounded-b-lg lg:h-[580px]',
        )}
      >
        {ready && (
          <LotScene
            gates={gates}
            active={onScreen}
            focus={focus}
            env={env}
            onPick={(n) => setFocus((f) => ({ n, seq: f.seq + 1 }))}
          />
        )}
        {!ready && <Skeleton className="size-full rounded-none" />}
        {ready && focus.n !== null && (
          <CheckpointStats
            key={focus.n}
            n={focus.n}
            gates={gates}
            cells={traffic.data?.cells ?? []}
            revenueBySite={new Map((revenue.data?.exits ?? []).map((e) => [e.siteId, e.amount]))}
            hour={Math.max(0, hour - 1)}
            onClose={() => setFocus((f) => ({ n: null, seq: f.seq + 1 }))}
            barrierTest={barrierTest}
          />
        )}

        {/* ตัวเลขซ้อนบนภาพ */}
        {ready && (
          <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap gap-2 sm:inset-x-4 sm:top-4">
            <div className="rounded-lg border border-border bg-bg/80 px-3 py-2 backdrop-blur-md">
              <p className="text-xs text-muted">รถในลานโดยประมาณ</p>
              <p className="num text-xl font-semibold">
                {formatNumber(inside)} <span className="text-sm font-normal text-muted">คัน</span>
              </p>
            </div>
            <div
              className={cn(
                'rounded-lg border bg-bg/80 px-3 py-2 backdrop-blur-md',
                downGates.length || maintGates.length ? 'border-danger/40' : 'border-border',
              )}
            >
              <p className="text-xs text-muted">ป้อม 5 จุด · {gates.length} ช่องทาง</p>
              {maintGates.length > 0 && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-danger-fg">
                  <Wrench className="size-3.5" aria-hidden />
                  ช่างกำลังตรวจสอบ · ปิดชั่วคราว {maintGates.map((g) => g.code).join(', ')}
                </p>
              )}
              {downGates.length ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-danger-fg">
                  <TriangleAlert className="size-4" aria-hidden />
                  อุปกรณ์เสีย {downGates.length} ช่องทาง
                  {closed.length ? ` · ปิด ${closed.length}` : ''}
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-sm font-medium text-success-fg">
                  <CircleCheck className="size-4" aria-hidden />
                  ทุกจุดปกติ
                </p>
              )}
              <p className="text-xs text-muted">
                {[...new Set(downGates.map((g) => `จุดที่ ${g.cp}`))].join(', ') ||
                  'ทุกช่องทางทำงานปกติ'}
              </p>
            </div>
          </div>
        )}

        {ready && (
          <div className="absolute right-3 bottom-3 flex flex-col items-end gap-2 sm:right-4 sm:bottom-4">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setFocus((f) => ({ n: null, seq: f.seq + 1 }))}
                className="grid size-9 place-items-center rounded-lg border border-white/10 bg-bg/80 text-muted backdrop-blur transition-colors hover:border-primary/60 hover:text-text"
                aria-label="กลับมุมภาพรวม"
                title="กลับมุมภาพรวม"
              >
                <RotateCcw className="size-4" />
              </button>
            </div>
            <WeatherChip w={weather.data} error={weather.isError} />
            <SegmentedControl<SkyMode>
              label="บรรยากาศของภาพ"
              size="sm"
              value={skyMode}
              onChange={setSkyMode}
              className="bg-bg/80 backdrop-blur"
              options={[
                { value: 'auto', label: 'ตามจริง' },
                { value: 'day', label: 'กลางวัน' },
                { value: 'night', label: 'กลางคืน' },
              ]}
            />
          </div>
        )}
        {ready && (
          <ul className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-bg/70 px-3 py-1.5 text-[11px] text-muted backdrop-blur sm:bottom-4 sm:left-4">
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-success" /> ปกติทั้งหมด
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-danger" /> มีอุปกรณ์เสีย
            </li>
          </ul>
        )}

        <p className="sr-only">
          {ready &&
            `รถในลานโดยประมาณ ${inside} คัน ${downGates.length ? `จุดที่มีอุปกรณ์เสีย: ${downGates.map((g) => g.code).join(', ')}` : ''}. ${gates
              .map((g) => `${g.code} ${g.rate} คันต่อชั่วโมง`)
              .join(', ')}`}
        </p>
      </div>
    </Panel>
  );
}

const CHECKPOINT_NAMES: [number, string][] = CHECKPOINTS.map((c) => [c.n, checkpointLabel(c.n)]);

/** ปุ่มเลือกป้อม: กดแล้วกล้องเลื่อนไปที่ป้อมนั้น (สีจุด = สถานะแย่ที่สุดของป้อม) */
function CheckpointPicker({
  gates,
  focus,
  onPick,
}: {
  gates: GateModel[];
  focus: CameraFocus;
  onPick: (n: number | null) => void;
}) {
  const toneOf = (n: number) => {
    const gs = gates.filter((g) => g.cp === n);
    return gs.some((g) => g.tone !== 'ok' || g.maintenance) ? 'bg-danger' : 'bg-success';
  };
  const btn = (active: boolean) =>
    cn(
      'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors',
      active
        ? 'border-primary bg-primary text-on-primary'
        : 'border-border-strong bg-surface-2 text-text hover:bg-surface-hover',
    );
  return (
    <div
      role="toolbar"
      aria-label="เลือกจุดบนผัง"
      className="mt-3 flex gap-2 overflow-x-auto border-t border-border px-4 py-2.5 sm:px-5"
    >
      <button
        type="button"
        className={btn(focus.n === null)}
        aria-pressed={focus.n === null}
        onClick={() => onPick(null)}
      >
        <MapIcon className="size-3.5" aria-hidden />
        ภาพรวม
      </button>
      {CHECKPOINT_NAMES.map(([n, label]) => (
        <button
          key={n}
          type="button"
          className={btn(focus.n === n)}
          aria-pressed={focus.n === n}
          onClick={() => onPick(n)}
        >
          <span className={cn('size-2 rounded-full', toneOf(n))} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * ข้อมูลของป้อมที่เลือก: รถเข้า/ออกสะสมวันนี้ แยกรายช่องทาง + ชั่วโมงล่าสุด
 * ใช้ข้อมูลชุดเดียวกับ Heatmap (รถเข้านับที่ช่องทางเข้า รถออกนับที่ช่องทางออก)
 */
function CheckpointStats({
  n,
  gates,
  cells,
  revenueBySite,
  hour,
  onClose,
  barrierTest,
}: {
  n: number;
  gates: GateModel[];
  cells: TrafficCell[];
  revenueBySite: Map<string, number>;
  hour: number;
  onClose: () => void;
  barrierTest: ReturnType<typeof useBarrierTest>;
}) {
  const label = CHECKPOINT_NAMES.find(([k]) => k === n)?.[1] ?? `จุดที่ ${n}`;
  const lanes = gates
    .filter((g) => g.cp === n)
    .sort((a, b) =>
      a.direction === b.direction ? a.laneIndex - b.laneIndex : a.direction === 'in' ? -1 : 1,
    )
    .map((g) => {
      const mine = cells.filter((c) => c.siteId === g.id);
      const pick = (c: TrafficCell) => (g.direction === 'in' ? c.carsIn : c.carsOut);
      return {
        g,
        today: mine.reduce((a, c) => a + pick(c), 0),
        lastHour: mine.filter((c) => c.hour === hour).reduce((a, c) => a + pick(c), 0),
      };
    });
  const totalIn = lanes.filter((l) => l.g.direction === 'in').reduce((a, l) => a + l.today, 0);
  const totalOut = lanes.filter((l) => l.g.direction === 'out').reduce((a, l) => a + l.today, 0);
  const outLanes = lanes.filter((l) => l.g.direction === 'out');
  const revenueTotal = outLanes.reduce((a, l) => a + (revenueBySite.get(l.g.id) ?? 0), 0);

  const toneIcon = (g: GateModel) =>
    g.maintenance ? (
      <span
        className="inline-flex items-center gap-1 text-danger-fg"
        title={`งาน ${g.maintenance}`}
      >
        <Wrench className="size-3.5" aria-hidden />
        ปิดตรวจสอบ
      </span>
    ) : g.tone === 'down' ? (
      <span className="inline-flex items-center gap-1 text-danger-fg">
        <TriangleAlert className="size-3.5" aria-hidden />
        เสีย
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-success-fg">
        <CircleCheck className="size-3.5" aria-hidden />
        ปกติ
      </span>
    );

  return (
    <section
      aria-label={`ข้อมูล${label}`}
      aria-live="polite"
      className="absolute top-3 right-3 z-10 w-[min(320px,calc(100%-24px))] rounded-lg border border-border-strong bg-bg/90 p-3.5 shadow-pop backdrop-blur-md animate-pop-in sm:top-4 sm:right-4"
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{label}</h3>
          <p className="text-xs text-muted">วันนี้ตั้งแต่ 00:00 ถึงตอนนี้</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted hover:bg-surface-hover hover:text-text"
          aria-label="ปิดและกลับภาพรวม"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-surface px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <LogIn className="size-3.5" aria-hidden />
            รถเข้า
          </p>
          <p className="num text-2xl font-semibold">
            {formatNumber(totalIn)} <span className="text-xs font-normal text-muted">คัน</span>
          </p>
        </div>
        <div className="rounded-md bg-surface px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <LogOut className="size-3.5" aria-hidden />
            รถออก
          </p>
          <p className="num text-2xl font-semibold">
            {formatNumber(totalOut)} <span className="text-xs font-normal text-muted">คัน</span>
          </p>
        </div>
      </div>
      {/* ยอดรับเงินวันนี้ที่ทางออกของป้อมนี้ (QR พร้อมเพย์) */}
      <div className="mb-3 rounded-md bg-surface px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <QrCode className="size-3.5" aria-hidden />
            ยอดรับเงินที่ทางออก
          </p>
          <p className="num text-lg font-semibold">{formatBaht(revenueTotal)}</p>
        </div>
        {outLanes.length > 1 && (
          <ul className="mt-1 flex flex-col gap-0.5 border-t border-border pt-1.5 text-xs">
            {outLanes.map((l) => (
              <li key={l.g.id} className="flex justify-between gap-2">
                <span className="text-muted">ทางออก {l.g.laneIndex + 1}</span>
                <span className="num">{formatBaht(revenueBySite.get(l.g.id) ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <table className="w-full text-xs">
        <caption className="sr-only">แยกตามช่องทาง</caption>
        <thead>
          <tr className="text-muted">
            <th scope="col" className="pb-1 text-left font-normal">
              ช่องทาง
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              วันนี้
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              ชม.ล่าสุด
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              สถานะ
            </th>
          </tr>
        </thead>
        <tbody>
          {lanes.map(({ g, today, lastHour }) => (
            <tr key={g.id} className="border-t border-border">
              <td className="py-1.5">
                {g.direction === 'in' ? 'ทางเข้า' : 'ทางออก'} {g.laneIndex + 1}
              </td>
              <td className="num py-1.5 text-right font-medium">{formatNumber(today)}</td>
              <td className="num py-1.5 text-right text-muted">{formatNumber(lastHour)}</td>
              <td className="py-1.5 text-right">{toneIcon(g)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(() => {
        const g = lanes.find((l) => l.g.code === barrierTest.site)?.g;
        return g ? (
          <BarrierTestControl
            t={barrierTest}
            laneLabel={`${g.direction === 'in' ? 'ทางเข้า' : 'ทางออก'} ${g.laneIndex + 1}`}
          />
        ) : null;
      })()}
    </section>
  );
}

/** อุณหภูมิและสภาพอากาศจริงตอนนี้ */
function WeatherChip({ w, error }: { w: ReturnType<typeof useWeather>['data']; error: boolean }) {
  if (!w)
    return (
      <span className="rounded-full bg-bg/80 px-3 py-1 text-xs text-muted backdrop-blur">
        {error ? 'ดึงข้อมูลอากาศไม่ได้ · ใช้เวลาของเครื่อง' : 'กำลังโหลดสภาพอากาศ…'}
      </span>
    );
  const Icon =
    w.kind === 'storm'
      ? CloudLightning
      : w.kind === 'rain'
        ? CloudRain
        : w.kind === 'fog'
          ? CloudFog
          : w.kind === 'cloudy'
            ? Cloud
            : w.isDay
              ? Sun
              : Moon;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-border bg-bg/80 px-3 py-1 text-xs backdrop-blur"
      title="ข้อมูลจาก Open-Meteo อัปเดตทุก 10 นาที"
    >
      <Icon className="size-4 text-primary-fg" aria-hidden />
      <span className="num font-semibold text-text">{w.temp}°C</span>
      <span className="text-muted">
        {w.label} · {w.isDay ? 'กลางวัน' : 'กลางคืน'}
      </span>
    </span>
  );
}
