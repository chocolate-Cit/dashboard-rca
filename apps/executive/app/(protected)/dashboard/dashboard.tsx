'use client';

import { presetRange } from '@gip/api/calc';
import { useIsFetching } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { EquipmentPanel } from './equipment-panel';
import { HeatmapPanel } from './heatmap-panel';
import { IncidentsPanel } from './incidents-panel';
import { KpiRow } from './kpi-row';
import { LotPanel } from './lot-3d/lot-panel';
import { LastUpdated } from './last-updated';
import { PaymentPanel } from './payment-panel';
import { TopBar } from './top-bar';
import { TrendPanel } from './trend-panel';

/**
 * Executive /dashboard
 * ลำดับอ่าน: ตัวเลขหลัก → แนวโน้ม/ช่องทาง → ความหนาแน่น → สิ่งที่กระทบบริการ
 */
/** true เมื่อจอกว้างตั้งแต่ขนาดนี้ (ติดตามการหมุนจอ/ปรับขนาดหน้าต่าง) */
function useMinWidth(px: number) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const on = () => setOk(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [px]);
  return ok;
}

export function Dashboard() {
  const showLot = useMinWidth(768);
  // ไม่มีตัวเลือกช่วงเวลา: แสดงข้อมูลวันนี้เสมอ
  const range = useMemo(() => presetRange('today'), []);
  const fetching = useIsFetching({ queryKey: ['dashboard'] }) > 0;

  return (
    <div className="min-h-dvh">
      <TopBar />

      <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pt-4 pb-10 sm:px-6 lg:gap-5 lg:px-8">
        <div className="flex items-center justify-end gap-3 xl:hidden">
          <LastUpdated fetching={fetching} />
        </div>

        <KpiRow range={range} />

        {/* ภาพ 3D: แสดงเฉพาะแท็บเล็ต/คอมพิวเตอร์ (≥ 768px) · มือถือไม่โหลดเลย ประหยัดเครื่องและเน็ต */}
        <div className="reveal hidden md:block" style={{ '--d': '320ms' } as CSSProperties}>
          {showLot && <LotPanel />}
        </div>

        <div
          className="reveal grid gap-4 lg:grid-cols-3 lg:gap-5"
          style={{ '--d': '480ms' } as CSSProperties}
        >
          <TrendPanel range={range} className="lg:col-span-2" />
          <PaymentPanel range={range} />
        </div>

        <div className="reveal" style={{ '--d': '620ms' } as CSSProperties}>
          <HeatmapPanel range={range} />
        </div>

        <div
          className="reveal grid gap-4 lg:grid-cols-5 lg:gap-5"
          style={{ '--d': '740ms' } as CSSProperties}
        >
          <EquipmentPanel className="lg:col-span-2" />
          <IncidentsPanel className="lg:col-span-3" />
        </div>
      </main>
    </div>
  );
}
