import { percentChange, trendOf } from '@gip/api/calc';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { formatPercent } from '../lib/format';
import { Skeleton } from './states';

type StatCardProps = {
  label: string;
  value: string;
  /** ค่าช่วงก่อนหน้า สำหรับคำนวณ % เปลี่ยนแปลง */
  current?: number;
  previous?: number;
  /** ข้อความใต้ % เช่น "เทียบ 14 ต.ค. 2026" */
  compareLabel?: string;
  /** ค่าลดลงเป็นเรื่องดีไหม (เช่น จำนวนงานค้าง) */
  lowerIsBetter?: boolean;
  icon?: ReactNode;
  emphasis?: boolean;
  footer?: ReactNode;
  loading?: boolean;
  className?: string;
};

/** การ์ดตัวเลขหลัก: ค่า + % เปลี่ยนแปลง (ลูกศร + สี + ข้อความ) */
export function StatCard({
  label,
  value,
  current,
  previous,
  compareLabel,
  lowerIsBetter,
  icon,
  emphasis,
  footer,
  loading,
  className,
}: StatCardProps) {
  const change =
    current !== undefined && previous !== undefined ? percentChange(current, previous) : undefined;
  const trend = change === undefined ? null : trendOf(change);
  const good = trend === 'flat' || trend === null ? null : (trend === 'up') !== !!lowerIsBetter;

  return (
    <section
      aria-label={label}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:p-5',
        className,
      )}
    >
      <header className="flex items-center gap-2 text-sm text-muted">
        {icon && <span className="text-muted [&_svg]:size-4">{icon}</span>}
        <h3 className="font-medium">{label}</h3>
      </header>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className={emphasis ? 'h-10 w-48' : 'h-8 w-32'} />
          <Skeleton className="h-4 w-36" />
        </div>
      ) : (
        <>
          <p
            className={cn(
              'num font-semibold leading-none tracking-tight text-text',
              emphasis ? 'text-[2.5rem] sm:text-5xl' : 'text-[1.75rem] sm:text-[2rem]',
            )}
          >
            {value}
          </p>
          {trend !== null && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span
                className={cn(
                  'num inline-flex items-center gap-0.5 font-medium',
                  good === null ? 'text-muted' : good ? 'text-success-fg' : 'text-danger-fg',
                )}
              >
                {trend === 'up' ? (
                  <ArrowUpRight className="size-4" aria-hidden />
                ) : trend === 'down' ? (
                  <ArrowDownRight className="size-4" aria-hidden />
                ) : (
                  <Minus className="size-4" aria-hidden />
                )}
                <span className="sr-only">
                  {trend === 'up' ? 'เพิ่มขึ้น' : trend === 'down' ? 'ลดลง' : 'คงที่'}
                </span>
                {change === null ? 'ไม่มีข้อมูลช่วงก่อน' : formatPercent(change!, { signed: true })}
              </span>
              {compareLabel && <span className="text-muted">{compareLabel}</span>}
            </p>
          )}
          {footer}
        </>
      )}
    </section>
  );
}
