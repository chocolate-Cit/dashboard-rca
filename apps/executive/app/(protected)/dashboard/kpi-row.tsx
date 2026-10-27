'use client';

import type { DateRange } from '@gip/api';
import {
  ErrorState,
  formatBaht,
  formatDateRange,
  formatNumber,
  StaleBanner,
  StatCard,
} from '@gip/ui';
import { CarFront, LogIn, LogOut, Wallet } from 'lucide-react';
import { useLiveDashboardSummary } from '@/lib/live-summary';

export function KpiRow({ range }: { range: DateRange }) {
  const q = useLiveDashboardSummary(range);
  const s = q.data;
  const loading = q.isPending;
  // ยอดจริง: เทียบเมื่อวานช่วงเวลาเดียวกัน (API ให้ null = เทียบไม่ได้ → ไม่แสดง)
  const compare = !s
    ? undefined
    : s.live
      ? s.compareDate
        ? `เทียบ ${formatDateRange(s.compareDate, s.compareDate)} เวลาเดียวกัน`
        : undefined
      : `เทียบ ${formatDateRange(s.previousFrom, s.previousTo)}`;

  if (q.isError && !s) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <ErrorState error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} compact />
      </div>
    );
  }

  return (
    <section aria-label="ตัวเลขหลัก" className="flex flex-col gap-2">
      {(q.isError || q.liveStale) && <StaleBanner onRetry={() => q.refetch()} />}
      <div className="reveal-stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-5">
        <StatCard
          emphasis
          className="col-span-2 lg:col-span-1"
          icon={<Wallet />}
          label={`รายได้ · ${formatDateRange(range.from, range.to)}`}
          value={s ? formatBaht(s.revenue) : ''}
          current={s?.revenue}
          previous={compare ? s?.previousRevenue : undefined}
          compareLabel={compare && s ? `${compare} (${formatBaht(s.previousRevenue)})` : undefined}
          loading={loading}
        />
        <StatCard
          icon={<LogIn />}
          label="รถเข้า"
          value={s ? `${formatNumber(s.carsIn)} คัน` : ''}
          loading={loading}
        />
        <StatCard
          icon={<LogOut />}
          label="รถออก"
          value={s ? `${formatNumber(s.carsOut)} คัน` : ''}
          loading={loading}
        />
        {/* รถคงค้าง: สะสมข้ามวัน ไม่รีเซ็ตตอนเที่ยงคืน (รถเข้า/ออกรีเซ็ต) */}
        <StatCard
          className="col-span-2 lg:col-span-1"
          icon={<CarFront />}
          label="รถคงค้างในลาน"
          value={s ? `${formatNumber(s.carsInside)} คัน` : ''}
          loading={loading}
        />
      </div>
    </section>
  );
}
