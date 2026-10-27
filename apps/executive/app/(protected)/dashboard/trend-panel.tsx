'use client';

import type { DateRange } from '@gip/api';
import { addDays, daysInRange, toSiteDate } from '@gip/api/calc';
import { useRevenueTrend } from '@gip/api/hooks';
import { EmptyState, ErrorState, formatDateRange, Panel, Skeleton, StaleBanner } from '@gip/ui';
import { AreaTrend } from '@gip/ui/charts';
import { TrendingUp } from 'lucide-react';
import { useLiveExtras } from '@/lib/live-summary';

/**
 * ช่วงสั้นกว่า 7 วันดูแนวโน้มไม่ได้ จึงแสดง 30 วันที่สิ้นสุดวันสุดท้ายของช่วงที่เลือกแทน
 * (ค่าเริ่มต้นของกราฟตาม PRD E-04 คือ 30 วัน)
 */
function trendRange(range: DateRange): DateRange {
  return daysInRange(range) >= 7 ? range : { from: addDays(range.to, -29), to: range.to };
}

export function TrendPanel({ range, className }: { range: DateRange; className?: string }) {
  const base = trendRange(range);
  // วันนี้ยังไม่จบวัน ถ้าใส่ในกราฟจะดูเหมือนรายได้ตกฮวบ จึงจบที่เมื่อวาน (ยอดวันนี้ดูที่การ์ดรายได้)
  const today = toSiteDate(new Date());
  const trimmed = base.to === today && base.from < today;
  let r = trimmed ? { from: base.from, to: addDays(today, -1) } : base;
  const mock = useRevenueTrend(r);
  // ใช้ trend จริงจาก API v2 เมื่อมี (30 วัน จบที่เมื่อวาน) ไม่งั้นใช้ข้อมูลจำลอง
  const extras = useLiveExtras();
  const liveTrend = extras?.trend;
  const q = liveTrend
    ? { ...mock, data: liveTrend.days, isPending: false, isError: false }
    : extras === undefined
      ? { ...mock, isPending: true }
      : mock;
  if (liveTrend) r = { from: liveTrend.from, to: liveTrend.to };
  const data = q.data?.map((p) => ({ date: p.date, value: p.revenue })) ?? [];
  const hasValue = data.some((p) => p.value > 0);

  return (
    <Panel
      id="trend"
      title="แนวโน้มรายได้รายวัน"
      description={`${formatDateRange(r.from, r.to)}${liveTrend || base !== range ? ' · 30 วันล่าสุด' : ''}${trimmed ? ' · ยอดวันนี้ดูที่การ์ดรายได้' : ''}`}
      className={className}
    >
      {q.isError && q.data && <StaleBanner className="mb-3" onRetry={() => q.refetch()} />}
      {q.isPending ? (
        <Skeleton className="h-[260px] w-full" />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} compact />
      ) : !hasValue ? (
        <EmptyState
          icon={TrendingUp}
          title="ยังไม่มีรายได้ในช่วงนี้"
          description="ลองเลือกช่วงเวลาที่ยาวขึ้น"
        />
      ) : (
        <AreaTrend data={data} label="รายได้" draw />
      )}
    </Panel>
  );
}
