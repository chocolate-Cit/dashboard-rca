/**
 * รูปแบบไทยของทั้งระบบ
 * - วันที่แบบ ค.ศ. ตามที่ตกลงไว้ (เช่น 15 ต.ค. 2026) จึงตั้ง calendar เป็น gregory
 * - เวลาเป็นเวลาไทยเสมอ ไม่ขึ้นกับโซนเวลาของเครื่อง
 */
const TZ = 'Asia/Bangkok';
const LOCALE = 'th-TH-u-ca-gregory-nu-latn';

const baht = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const number = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const dayMonthFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
});
const timeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday: 'short' });

/** ฿1,234 (ติดลบเป็น -฿1,234) */
export function formatBaht(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}฿${baht.format(Math.abs(Math.round(value)))}`;
}

/** ฿1.2 ล้าน — ใช้บนแกนกราฟที่พื้นที่จำกัด */
export function formatBahtCompact(value: number): string {
  return `฿${compact.format(value)}`;
}

export function formatNumber(value: number): string {
  return number.format(value);
}

/** +12.3% / -4.0% / 0.0% */
export function formatPercent(value: number, { signed = false, digits = 1 } = {}): string {
  const s = Math.abs(value).toFixed(digits);
  if (!signed) return `${s}%`;
  if (Math.abs(value) < 0.05) return `${(0).toFixed(digits)}%`;
  return `${value > 0 ? '+' : '−'}${s}%`;
}

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // YYYY-MM-DD ถือเป็นวันตามเวลาไทย (เที่ยงวัน กันหลุดวันเมื่อแปลงโซน)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+07:00`) : new Date(value);
}

/** 15 ต.ค. 2026 */
export function formatDate(value: string | Date): string {
  return dateFmt.format(toDate(value));
}

/** 15 ต.ค. */
export function formatDayMonth(value: string | Date): string {
  return dayMonthFmt.format(toDate(value));
}

/** 10:32 */
export function formatTime(value: string | Date): string {
  return timeFmt.format(toDate(value));
}

/** 15 ต.ค. 2026 10:32 */
export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}

export function formatWeekday(value: string | Date): string {
  return weekdayFmt.format(toDate(value));
}

/** ช่วงวันที่: 1–15 ต.ค. 2026 / 28 ก.ย. – 4 ต.ค. 2026 / วันเดียวแสดงวันเดียว */
export function formatDateRange(from: string, to: string): string {
  if (from === to) return formatDate(from);
  const [fy, fm] = from.split('-');
  const [ty, tm] = to.split('-');
  if (fy === ty && fm === tm) return `${Number(from.slice(8))}–${formatDate(to)}`;
  if (fy === ty) return `${formatDayMonth(from)} – ${formatDate(to)}`;
  return `${formatDate(from)} – ${formatDate(to)}`;
}

/**
 * ระยะเวลาแบบอ่านง่าย: 45 นาที / 2 ชม. 15 นาที / 3 วัน 4 ชม.
 * ใช้กับเวลาที่เหลือ/เกิน SLA และเวลาเฉลี่ยใน KPI
 */
export function formatDuration(minutes: number): string {
  const m = Math.round(Math.abs(minutes));
  if (m < 1) return 'ไม่ถึง 1 นาที';
  if (m < 60) return `${m} นาที`;
  const days = Math.floor(m / 1440);
  const hours = Math.floor((m % 1440) / 60);
  const mins = m % 60;
  if (days > 0) return hours ? `${days} วัน ${hours} ชม.` : `${days} วัน`;
  return mins ? `${hours} ชม. ${mins} นาที` : `${hours} ชม.`;
}

/** เวลาที่เหลือก่อนครบ SLA: "เหลือ 2 ชม. 15 นาที" / "เกิน 30 นาที" */
export function formatSlaRemaining(ms: number): string {
  const minutes = ms / 60_000;
  return minutes >= 0 ? `เหลือ ${formatDuration(minutes)}` : `เกิน ${formatDuration(minutes)}`;
}

/** เมื่อ 5 นาทีที่แล้ว / เมื่อวาน 10:32 / 12 ต.ค. 2026 10:32 */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const d = toDate(value);
  const diff = (now.getTime() - d.getTime()) / 60_000;
  if (diff < 1) return 'เมื่อสักครู่';
  if (diff < 60) return `${Math.floor(diff)} นาทีที่แล้ว`;
  if (diff < 6 * 60) return `${Math.floor(diff / 60)} ชม. ที่แล้ว`;
  const today = dateFmt.format(now);
  const yesterday = dateFmt.format(new Date(now.getTime() - 86_400_000));
  if (dateFmt.format(d) === today) return `วันนี้ ${formatTime(d)}`;
  if (dateFmt.format(d) === yesterday) return `เมื่อวาน ${formatTime(d)}`;
  return formatDateTime(d);
}

/** 08:00–09:00 */
export function formatHourRange(hour: number): string {
  const pad = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  return `${pad(hour)}–${pad(hour + 1)}`;
}
