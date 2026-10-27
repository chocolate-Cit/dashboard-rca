'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { formatNumber } from '../lib/format';
import { Button } from './button';
import { Skeleton } from './states';

export type Column<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** ใส่เมื่อคอลัมน์นี้เรียงได้ */
  sortValue?: (row: T) => string | number | null;
  align?: 'left' | 'right' | 'center';
  className?: string;
  headerClassName?: string;
};

type Sort = { id: string; dir: 'asc' | 'desc' } | null;

type LinkLike = ComponentType<{
  href: string;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
}>;

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  /** ทั้งแถวกดได้ (ใช้ Link ของ Next.js ผ่าน linkComponent) */
  rowHref?: (row: T) => string;
  rowLabel?: (row: T) => string;
  linkComponent?: LinkLike;
  rowClassName?: (row: T) => string | undefined;
  /** มุมมองการ์ดบนจอเล็ก ถ้าไม่ใส่จะเลื่อนตารางแนวนอนแทน */
  mobileCard?: (row: T) => ReactNode;
  /** แสดงการ์ดแทนตารางเมื่อจอแคบกว่า breakpoint นี้ (ตารางคอลัมน์เยอะใช้ lg) */
  cardsBelow?: 'md' | 'lg';
  pageSize?: number;
  initialSort?: Sort;
  loading?: boolean;
  empty?: ReactNode;
  caption?: string;
  className?: string;
};

const DefaultLink: LinkLike = ({ href, className, children, ...rest }) => (
  <a href={href} className={className} {...rest}>
    {children}
  </a>
);

function compare(a: string | number | null, b: string | number | null) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b), 'th');
}

/** ตาราง: เรียงตามคอลัมน์, แบ่งหน้า, เป็นการ์ดบนมือถือ */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  rowLabel,
  linkComponent: Link = DefaultLink,
  rowClassName,
  mobileCard,
  cardsBelow = 'md',
  pageSize = 20,
  initialSort = null,
  loading,
  empty,
  caption,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<Sort>(initialSort);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!rows) return [];
    const col = sort && columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    const out = [...rows].sort((a, b) => compare(get(a), get(b)));
    return sort!.dir === 'desc' ? out.reverse() : out;
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = sorted.slice(current * pageSize, (current + 1) * pageSize);

  function toggle(id: string) {
    setPage(0);
    setSort((s) =>
      s?.id !== id ? { id, dir: 'asc' } : s.dir === 'asc' ? { id, dir: 'desc' } : null,
    );
  }

  const alignClass = (a?: Column<T>['align']) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  if (!loading && rows && rows.length === 0) return <>{empty}</>;

  return (
    <div className={className}>
      {/* การ์ดบนมือถือ */}
      {mobileCard && (
        <ul
          className={cn('divide-y divide-border', cardsBelow === 'lg' ? 'lg:hidden' : 'md:hidden')}
          aria-label={caption}
        >
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="space-y-2 p-4">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                </li>
              ))
            : visible.map((row) => (
                <li key={rowKey(row)} className={cn('relative', rowClassName?.(row))}>
                  {rowHref ? (
                    <Link
                      href={rowHref(row)}
                      aria-label={rowLabel?.(row)}
                      className="block p-4 hover:shadow-[inset_0_0_0_999px_rgb(0_0_0/0.035)] focus-visible:shadow-[inset_0_0_0_999px_rgb(0_0_0/0.05)]"
                    >
                      {mobileCard(row)}
                    </Link>
                  ) : (
                    <div className="p-4">{mobileCard(row)}</div>
                  )}
                </li>
              ))}
        </ul>
      )}

      {/* ตารางบนจอใหญ่ */}
      <div
        className={cn(
          'relative overflow-x-auto',
          mobileCard && (cardsBelow === 'lg' ? 'hidden lg:block' : 'hidden md:block'),
        )}
      >
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-border bg-surface-2">
              {columns.map((c) => {
                const active = sort?.id === c.id;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={
                      active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={cn(
                      'h-10 px-3 font-medium whitespace-nowrap text-muted first:pl-4 last:pr-4',
                      alignClass(c.align),
                      c.headerClassName,
                    )}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.id)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded hover:text-text',
                          active && 'text-text',
                          c.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {c.header}
                        {active ? (
                          sort!.dir === 'asc' ? (
                            <ArrowUp className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowDown className="size-3.5" aria-hidden />
                          )
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }, (_, i) => (
                  <tr key={i} className="border-b border-border">
                    {columns.map((c) => (
                      <td key={c.id} className="h-12 px-3 first:pl-4 last:pr-4">
                        <Skeleton className="h-4 w-full max-w-32" />
                      </td>
                    ))}
                  </tr>
                ))
              : visible.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className={cn(
                      'relative border-b border-border transition-colors last:border-0',
                      rowHref &&
                        'cursor-pointer hover:shadow-[inset_0_0_0_999px_rgb(0_0_0/0.035)] focus-within:shadow-[inset_0_0_0_999px_rgb(0_0_0/0.05)]',
                      rowClassName?.(row),
                    )}
                  >
                    {columns.map((c, i) => (
                      <td
                        key={c.id}
                        className={cn(
                          'h-12 px-3 py-2 align-middle first:pl-4 last:pr-4',
                          alignClass(c.align),
                          c.className,
                        )}
                      >
                        {i === 0 && rowHref ? (
                          <Link
                            href={rowHref(row)}
                            aria-label={rowLabel?.(row)}
                            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                          >
                            {c.cell(row)}
                          </Link>
                        ) : (
                          c.cell(row)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!loading && sorted.length > pageSize && (
        <nav
          aria-label="แบ่งหน้า"
          className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted"
        >
          <span className="num">
            {formatNumber(current * pageSize + 1)}–
            {formatNumber(Math.min((current + 1) * pageSize, sorted.length))} จาก{' '}
            {formatNumber(sorted.length)} รายการ
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="หน้าก่อนหน้า"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="num px-2">
              {current + 1} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="หน้าถัดไป"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
