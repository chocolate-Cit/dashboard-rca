'use client';

import type { DashboardSummary, DateRange, Site, TrafficCell } from '@gip/api';
import { useDashboardSummary } from '@gip/api/hooks';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ParkingLive } from '@/app/api/parking/route';

/** อ่าน snapshot ล่าสุดจาก server (server รับจาก WebSocket / REST สำรอง) */
export function useParkingLive() {
  return useQuery({
    queryKey: ['parking', 'live'],
    queryFn: async (): Promise<ParkingLive> => {
      const res = await fetch('/api/parking', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ParkingLive;
      if (data.enabled)
        console.info(
          '[ยอดรถ/รายได้ API v2]',
          data.data ?? 'ยังไม่ได้รับ snapshot',
          data.error ?? '',
        );
      return data;
    },
    refetchInterval: 6_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}

export type LiveSummary = DashboardSummary & {
  live: boolean;
  /** วันที่ที่ใช้เทียบ (เมื่อวาน ช่วงเวลาเดียวกัน) · null = ไม่แสดงการเทียบ */
  compareDate: string | null;
};

/**
 * เหมือน useDashboardSummary แต่ใช้ยอดจริงจาก API v2 เมื่อตั้งค่าไว้
 * เทียบเมื่อวาน: ใช้ yesterday_same_time เฉพาะเมื่อ vs_yesterday_pct ไม่เป็น null (null = เทียบไม่ได้)
 */
export function useLiveDashboardSummary(range: DateRange) {
  const q = useDashboardSummary(range);
  const live = useParkingLive();
  const p = live.data?.enabled ? live.data : null;
  const waiting = !!p && !p.data; // ตั้งค่าแล้วแต่ยังไม่ได้ snapshot แรก
  const data = useMemo((): LiveSummary | undefined => {
    if (!q.data || waiting || !live.isFetched) return undefined;
    if (!p?.data) return { ...q.data, live: false, compareDate: null };
    const d = p.data;
    const canCompare = d.vsYesterdayPct !== null && d.yesterdaySameTime !== null;
    return {
      ...q.data,
      revenue: d.revenue,
      carsIn: d.carsIn,
      carsOut: d.carsOut,
      carsInside: d.carsInside,
      previousRevenue: canCompare ? d.yesterdaySameTime! : Number.NaN,
      live: true,
      compareDate: canCompare ? d.yesterdayDate : null,
    };
  }, [q.data, p, waiting, live.isFetched]);
  return {
    ...q,
    data,
    isPending: q.isPending || !live.isFetched || waiting,
    liveStale: !!p && (p.stale || live.isError),
  };
}

/** ข้อมูลส่วนอื่นของ API v2 (กราฟ 30 วัน, Heatmap) · undefined = ยังโหลด, null = ไม่ได้ใช้ API จริง */
export function useLiveExtras() {
  const live = useParkingLive();
  const d = live.data?.enabled ? live.data.data : null;
  const loading = !live.isFetched || (!!live.data?.enabled && !d);
  return useMemo(() => {
    if (loading) return undefined;
    if (!d) return null;
    // แปลงช่องทางดิบของ Backend เป็นรูปแบบเดียวกับ Heatmap เดิม (ยังไม่มีตารางแมปป้อม → แสดง label ดิบ)
    const hourly = d.hourly && {
      currentHour: d.hourly.currentHour,
      sites: d.hourly.lanes.map(
        (l): Site => ({
          id: `${l.direction}:${l.id}`,
          code: l.direction === 'in' ? 'เข้า' : 'ออก',
          name: l.label,
          direction: l.direction,
          group: null,
          active: true,
        }),
      ),
      cells: d.hourly.lanes.flatMap((l) =>
        l.counts.map(
          (n, hour): TrafficCell => ({
            siteId: `${l.direction}:${l.id}`,
            hour,
            carsIn: l.direction === 'in' ? n : 0,
            carsOut: l.direction === 'out' ? n : 0,
          }),
        ),
      ),
    };
    return { trend: d.trend, hourly, stale: live.data!.stale };
  }, [loading, d, live.data]);
}
