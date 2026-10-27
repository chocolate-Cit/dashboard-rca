import { cn } from '../lib/cn';
import { formatPercent } from '../lib/format';

type Item = { key: string; label: string; value: number; detail?: string };

type Props = {
  items: Item[];
  label: string;
  valueFormatter: (v: number) => string;
  className?: string;
};

/**
 * แท่งแนวนอนเรียงจากมากไปน้อย พร้อมค่าและ % (อ่านง่ายกว่า pie)
 * แท่งเป็นสีเดียว เพราะแต่ละแถวมีชื่อกำกับอยู่แล้ว สีไม่ต้องทำหน้าที่แยกหมวด
 * เขียนด้วย HTML แทน Recharts: ป้ายภาษาไทยไม่ถูกตัด และ hover/โฟกัสต่อแถวได้
 */
export function BarList({ items, label, valueFormatter, className }: Props) {
  const total = items.reduce((a, i) => a + i.value, 0);
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const max = sorted[0]?.value ?? 0;

  return (
    <figure className={cn('m-0', className)}>
      <figcaption className="sr-only">
        {label}:{' '}
        {sorted
          .map(
            (i) =>
              `${i.label} ${valueFormatter(i.value)} (${formatPercent(total ? (i.value / total) * 100 : 0)})`,
          )
          .join(', ')}
      </figcaption>
      <ul className="flex flex-col gap-3.5" aria-hidden>
        {sorted.map((item) => {
          const pct = total ? (item.value / total) * 100 : 0;
          return (
            <li key={item.key} className="group" title={item.detail}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-text">{item.label}</span>
                <span className="num shrink-0">
                  <span className="font-medium text-text">{valueFormatter(item.value)}</span>
                  <span className="ml-2 inline-block w-12 text-right text-muted">
                    {formatPercent(pct)}
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out group-hover:bg-primary-hover"
                  style={{
                    width: `${max ? Math.max((item.value / max) * 100, item.value > 0 ? 1.5 : 0) : 0}%`,
                  }}
                />
              </div>
              {item.detail && <p className="num mt-1 text-xs text-muted">{item.detail}</p>}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
