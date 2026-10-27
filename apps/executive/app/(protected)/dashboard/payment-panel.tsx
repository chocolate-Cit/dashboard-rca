'use client';

import type { DateRange } from '@gip/api';
import { useRevenuePoints } from '@gip/api/hooks';
import {
  cn,
  EmptyState,
  ErrorState,
  formatBaht,
  formatNumber,
  formatPercent,
  Panel,
  Skeleton,
  StaleBanner,
} from '@gip/ui';
import { ChevronDown, LogOut, MonitorSmartphone, QrCode, Wallet } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

type Row = { key: string; label: string; sub?: string; amount: number; count: number };

/** กลุ่มจุดรับเงินแบบ dropdown: หัวกลุ่มบอกยอดรวม กดแล้วกางรายการแต่ละจุด */
function Group({
  icon,
  title,
  rows,
  total,
}: {
  icon: ReactNode;
  title: string;
  rows: Row[];
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const sum = rows.reduce((a, r) => a + r.amount, 0);
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-fg [&_svg]:size-4">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          <span className="num block text-xs text-muted">
            {rows.length} จุด · {formatPercent(total ? (sum / total) * 100 : 0, { digits: 0 })}{' '}
            ของยอดรวม
          </span>
        </span>
        <span className="num text-sm font-semibold">{formatBaht(sum)}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {/* กาง/ย่อแบบสไลด์: grid-rows 0fr → 1fr ให้ความสูงเลื่อนลงนุ่ม ๆ ตามเนื้อหาจริง */}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <ul id={id} className="flex flex-col gap-3 border-t border-border px-3 py-3">
            {[...rows]
              .sort((a, b) => b.amount - a.amount)
              .map((r) => (
                <li key={r.key}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">{r.label}</span>
                      {r.sub && <span className="block truncate text-xs text-muted">{r.sub}</span>}
                    </span>
                    <span className="num shrink-0 text-right">
                      <span className="block font-medium">{formatBaht(r.amount)}</span>
                      <span className="block text-xs text-muted">
                        {formatNumber(r.count)} รายการ
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(r.amount / max) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** ยอดรับเงินแยกจุดรับเงิน: ทางออกแต่ละช่อง และ Kiosk Payment 1–3 (QR พร้อมเพย์อย่างเดียว) */
export function PaymentPanel({ range }: { range: DateRange }) {
  const q = useRevenuePoints(range);
  const d = q.data;
  const exits: Row[] =
    d?.exits.map((e) => ({
      key: e.siteId,
      label: e.name.replace(/^ป้อม/, ''),
      sub: e.group ?? e.code,
      amount: e.amount,
      count: e.count,
    })) ?? [];
  const kiosks: Row[] =
    d?.kiosks.map((k) => ({ key: k.id, label: k.name, amount: k.amount, count: k.count })) ?? [];
  const total = [...exits, ...kiosks].reduce((a, r) => a + r.amount, 0);

  return (
    <Panel
      id="channels"
      title="ยอดรับเงิน"
      description={d ? `รวม ${formatBaht(total)}` : ' '}
      actions={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-fg">
          <QrCode className="size-3.5" aria-hidden />
          QR พร้อมเพย์
        </span>
      }
    >
      {q.isError && d && <StaleBanner className="mb-3" onRetry={() => q.refetch()} />}
      {q.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : q.isError && !d ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} compact />
      ) : total === 0 ? (
        <EmptyState icon={Wallet} title="ยังไม่มีการรับเงินในช่วงนี้" compact />
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* ช่องทางชำระเงิน: มีช่องทางเดียวคือ QR พร้อมเพย์ */}
          <div className="rounded-md bg-surface-2 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <QrCode className="size-4 text-primary-fg" aria-hidden />
                <span>
                  <span className="block text-xs text-muted">ช่องทางชำระเงิน</span>
                  <span className="block font-medium">QR พร้อมเพย์</span>
                </span>
              </span>
              <span className="num text-right">
                <span className="block font-semibold">{formatBaht(total)}</span>
                <span className="block text-xs text-muted">100%</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-primary" />
          </div>
          <Group icon={<LogOut />} title="ทางออก" rows={exits} total={total} />
          <Group icon={<MonitorSmartphone />} title="Kiosk Payment" rows={kiosks} total={total} />
        </div>
      )}
    </Panel>
  );
}
