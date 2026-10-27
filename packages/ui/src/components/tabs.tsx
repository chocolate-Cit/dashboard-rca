'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../lib/cn';

type Option<V extends string> = { value: V; label: ReactNode };

type SegmentedProps<V extends string> = {
  value: V;
  onChange: (v: V) => void;
  options: Option<V>[];
  label: string;
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * ปุ่มเลือกแบบกลุ่ม (radiogroup) — ใช้สลับมุมมองหรือ preset ช่วงเวลา
 * ลูกศรซ้าย/ขวาเลื่อนตัวเลือก ตาม pattern ของ WAI-ARIA
 */
export function SegmentedControl<V extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: SegmentedProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = options.findIndex((o) => o.value === value);

  function onKeyDown(e: KeyboardEvent) {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (Math.max(index, 0) + dir + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('inline-flex rounded-md border border-border bg-surface-2 p-0.5', className)}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (index < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-[5px] font-medium whitespace-nowrap transition-[background-color,color] duration-150',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              active
                ? 'bg-surface text-text shadow-card ring-1 ring-border'
                : 'text-muted hover:text-text',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
