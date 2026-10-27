'use client';

import type { DateRange as IsoRange } from '@gip/api';
import { addDays, matchPreset, presetRange, toSiteDate, type RangePreset } from '@gip/api/calc';
import * as Popover from '@radix-ui/react-popover';
import { th } from 'date-fns/locale';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { DayPicker, type DateRange as DayRange } from 'react-day-picker';
import { cn } from '../lib/cn';
import { formatDateRange } from '../lib/format';
import { Button } from './button';
import { SegmentedControl } from './tabs';

export const presetLabels: Record<RangePreset, string> = {
  today: 'วันนี้',
  yesterday: 'เมื่อวาน',
  '7d': '7 วัน',
  '30d': '30 วัน',
  month: 'เดือนนี้',
};

const toLocal = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Props = {
  value: IsoRange;
  onChange: (range: IsoRange) => void;
  presets?: RangePreset[];
  /** ย้อนหลังได้กี่วัน */
  maxPastDays?: number;
  className?: string;
};

/** เลือกช่วงวันที่: preset + เลือกเองจากปฏิทิน (ภาษาไทย ปี ค.ศ.) */
export function DateRangePicker({
  value,
  onChange,
  presets = ['today', 'yesterday', '7d', '30d', 'month'],
  maxPastDays = 365,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DayRange | undefined>();
  const today = toSiteDate(new Date());
  const active = matchPreset(value);
  const label = active ? presetLabels[active] : formatDateRange(value.from, value.to);

  function openChange(next: boolean) {
    setOpen(next);
    if (next) setDraft({ from: toLocal(value.from), to: toLocal(value.to) });
  }

  function apply() {
    if (!draft?.from) return;
    const from = toIso(draft.from);
    const to = toIso(draft.to ?? draft.from);
    onChange({ from, to });
    setOpen(false);
  }

  const calendar = (
    <Popover.Root open={open} onOpenChange={openChange}>
      <Popover.Trigger asChild>
        <Button
          variant={active ? 'ghost' : 'secondary'}
          size="sm"
          className={cn('gap-1.5', !active && 'ring-1 ring-primary/40')}
          aria-label={`เลือกช่วงวันที่เอง (ตอนนี้: ${label})`}
        >
          <CalendarDays aria-hidden />
          <span className="num md:hidden">{label}</span>
          <span className={cn('num hidden md:inline', active && 'md:hidden')}>{label}</span>
          <ChevronDown className="md:hidden" aria-hidden />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[min(100vw-24px,340px)] rounded-lg border border-border bg-surface p-3 text-text shadow-pop animate-pop-in"
        >
          <div className="mb-3 flex flex-wrap gap-1.5 md:hidden">
            {presets.map((p) => (
              <Button
                key={p}
                size="sm"
                variant={active === p ? 'primary' : 'secondary'}
                onClick={() => {
                  onChange(presetRange(p));
                  setOpen(false);
                }}
              >
                {presetLabels[p]}
              </Button>
            ))}
          </div>
          <DayPicker
            mode="range"
            locale={th}
            selected={draft}
            onSelect={setDraft}
            defaultMonth={toLocal(value.to)}
            disabled={[
              { after: toLocal(today) },
              { before: toLocal(addDays(today, -maxPastDays)) },
            ]}
            startMonth={toLocal(addDays(today, -maxPastDays))}
            endMonth={toLocal(today)}
            showOutsideDays
            components={{
              Chevron: ({ orientation }) =>
                orientation === 'left' ? (
                  <ChevronLeft className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                ),
            }}
            classNames={{
              root: 'relative text-sm',
              months: 'relative',
              month_caption: 'flex h-9 items-center px-1 font-medium',
              nav: 'absolute top-0 right-0 flex gap-1',
              button_previous:
                'grid size-9 place-items-center rounded-md text-muted hover:bg-surface-hover hover:text-text disabled:opacity-30',
              button_next:
                'grid size-9 place-items-center rounded-md text-muted hover:bg-surface-hover hover:text-text disabled:opacity-30',
              month_grid: 'mt-2 w-full border-collapse',
              weekdays: 'text-xs text-muted',
              weekday: 'h-8 font-normal',
              week: '',
              day: 'num p-0 text-center',
              day_button:
                'mx-auto grid size-10 place-items-center rounded-md transition-colors hover:bg-surface-hover disabled:pointer-events-none',
              today: 'font-semibold text-primary-fg',
              outside: 'text-muted/50',
              disabled: 'text-muted/30',
              selected: '[&>button]:bg-primary-soft',
              range_start: '[&>button]:!bg-primary [&>button]:!text-on-primary',
              range_end: '[&>button]:!bg-primary [&>button]:!text-on-primary',
              range_middle: '[&>button]:rounded-none',
            }}
          />
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
            <span className="num text-xs text-muted">
              {draft?.from
                ? formatDateRange(toIso(draft.from), toIso(draft.to ?? draft.from))
                : 'เลือกวันเริ่มต้น'}
            </span>
            <Button size="sm" onClick={apply} disabled={!draft?.from}>
              ใช้ช่วงนี้
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <SegmentedControl
        label="ช่วงเวลา"
        size="sm"
        className="hidden md:inline-flex"
        value={(active ?? 'custom') as RangePreset}
        onChange={(p) => onChange(presetRange(p))}
        options={presets.map((p) => ({ value: p, label: presetLabels[p] }))}
      />
      {calendar}
    </div>
  );
}
