import type { DateRange } from '../schemas';

/** โซนเวลาของไซต์ ใช้ตัดวันให้ตรงกับเวลาไทยไม่ว่าเครื่องจะตั้งโซนไหน */
export const SITE_TIME_ZONE = 'Asia/Bangkok';

const isoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SITE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const hourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: SITE_TIME_ZONE,
  hour: '2-digit',
  hourCycle: 'h23',
});

/** วันที่ (YYYY-MM-DD) ตามเวลาไทยของเวลาที่ให้มา */
export function toSiteDate(date: Date): string {
  return isoFormatter.format(date);
}

/** ชั่วโมง (0–23) ตามเวลาไทย */
export function toSiteHour(date: Date): number {
  return Number(hourFormatter.format(date));
}

function parse(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** จำนวนวันในช่วง (นับรวมวันแรกและวันสุดท้าย) */
export function daysInRange(range: DateRange): number {
  return Math.round((parse(range.to).getTime() - parse(range.from).getTime()) / 86_400_000) + 1;
}

/** รายการวันที่ทุกวันในช่วง */
export function eachDay(range: DateRange): string[] {
  const n = daysInRange(range);
  return Array.from({ length: Math.max(n, 0) }, (_, i) => addDays(range.from, i));
}

/** ช่วงก่อนหน้าที่ยาวเท่ากัน ใช้คำนวณ % เปลี่ยนแปลง */
export function previousRange(range: DateRange): DateRange {
  const n = daysInRange(range);
  return { from: addDays(range.from, -n), to: addDays(range.from, -1) };
}

export const rangePresets = ['today', 'yesterday', '7d', '30d', 'month'] as const;
export type RangePreset = (typeof rangePresets)[number];

export function presetRange(preset: RangePreset, now: Date = new Date()): DateRange {
  const today = toSiteDate(now);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
    case 'month':
      return { from: `${today.slice(0, 8)}01`, to: today };
  }
}

/** หา preset ที่ตรงกับช่วงนี้ ถ้าไม่ตรงคืน null (= เลือกเอง) */
export function matchPreset(range: DateRange, now: Date = new Date()): RangePreset | null {
  return (
    rangePresets.find((p) => {
      const r = presetRange(p, now);
      return r.from === range.from && r.to === range.to;
    }) ?? null
  );
}

export function isValidRange(range: Partial<DateRange>): range is DateRange {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  return (
    !!range.from &&
    !!range.to &&
    re.test(range.from) &&
    re.test(range.to) &&
    !Number.isNaN(parse(range.from).getTime()) &&
    !Number.isNaN(parse(range.to).getTime()) &&
    range.from <= range.to
  );
}
