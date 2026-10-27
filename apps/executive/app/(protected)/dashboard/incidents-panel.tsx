'use client';

import { activeStatuses } from '@gip/api';
import { useEquipment, useIncidents, useProblemTypes } from '@gip/api/hooks';
import {
  EmptyState,
  ErrorState,
  formatNumber,
  formatRelative,
  Panel,
  PriorityBadge,
  SlaBadge,
  Skeleton,
  StaleBanner,
  StatusBadge,
} from '@gip/ui';
import { PartyPopper } from 'lucide-react';
import { useEffect, useState } from 'react';

const SHOW = 8;

/** ปัญหาล่าสุด: งานที่ยังเปิดอยู่ เรียงงานเกิน/ใกล้เกิน SLA ขึ้นก่อน (อ่านอย่างเดียว) */
export function IncidentsPanel({ className }: { className?: string }) {
  const q = useIncidents({ status: activeStatuses });
  const equipment = useEquipment();
  const problems = useProblemTypes();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const eqName = (id: string) => equipment.data?.find((e) => e.id === id)?.name ?? '—';
  const problemName = (id: string) => problems.data?.find((p) => p.id === id)?.name ?? '';
  const items = q.data ?? [];

  return (
    <Panel
      id="incidents"
      title="ปัญหาล่าสุด"
      className={className}
      bodyClassName="px-0 pt-3 pb-1 sm:px-0"
      description={q.data ? `งานซ่อมที่ยังเปิดอยู่ ${formatNumber(items.length)} งาน` : undefined}
    >
      {q.isError && q.data && (
        <StaleBanner className="mx-4 mb-3 sm:mx-5" onRetry={() => q.refetch()} />
      )}
      {q.isPending ? (
        <div className="space-y-3 px-4 sm:px-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} compact />
      ) : items.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title="ไม่มีงานค้าง"
          description="อุปกรณ์ทุกจุดพร้อมให้บริการ"
          compact
        />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {items.slice(0, SHOW).map((inc) => (
              <li
                key={inc.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2 text-sm">
                    <span className="num shrink-0 font-medium text-muted">{inc.code}</span>
                    <span className="truncate font-medium">{eqName(inc.equipmentId)}</span>
                  </p>
                  <p className="truncate text-sm text-muted">
                    {problemName(inc.problemTypeId)} · เปิดเมื่อ {formatRelative(inc.openedAt, now)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                  <PriorityBadge priority={inc.priority} />
                  <StatusBadge status={inc.status} />
                  <SlaBadge incident={inc} now={now} />
                </div>
              </li>
            ))}
          </ul>
          {items.length > SHOW && (
            <p className="border-t border-border px-4 py-2.5 text-sm text-muted sm:px-5">
              และอีก {formatNumber(items.length - SHOW)} งาน
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
