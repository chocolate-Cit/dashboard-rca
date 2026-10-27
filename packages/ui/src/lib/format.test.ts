import { describe, expect, it } from 'vitest';
import {
  formatBaht,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDuration,
  formatHourRange,
  formatPercent,
  formatSlaRemaining,
  formatTime,
} from './format';

describe('รูปแบบไทย', () => {
  it('เงินบาท ฿1,234 ไม่มีทศนิยม', () => {
    expect(formatBaht(1234)).toBe('฿1,234');
    expect(formatBaht(1234.6)).toBe('฿1,235');
    expect(formatBaht(-500)).toBe('-฿500');
    expect(formatBaht(0)).toBe('฿0');
  });

  it('วันที่แบบ ค.ศ. (ไม่ใช่ พ.ศ.)', () => {
    expect(formatDate('2026-10-15')).toBe('15 ต.ค. 2026');
    expect(formatDate('2026-01-01')).toBe('1 ม.ค. 2026');
  });

  it('เวลาเป็นเวลาไทยเสมอ', () => {
    expect(formatTime('2026-10-15T03:32:00Z')).toBe('10:32');
    expect(formatDateTime('2026-10-15T17:05:00Z')).toBe('16 ต.ค. 2026 00:05');
  });

  it('ช่วงวันที่ย่อเมื่อเดือน/ปีเดียวกัน', () => {
    expect(formatDateRange('2026-10-15', '2026-10-15')).toBe('15 ต.ค. 2026');
    expect(formatDateRange('2026-10-01', '2026-10-15')).toBe('1–15 ต.ค. 2026');
    expect(formatDateRange('2026-09-28', '2026-10-04')).toBe('28 ก.ย. – 4 ต.ค. 2026');
    expect(formatDateRange('2025-12-30', '2026-01-02')).toBe('30 ธ.ค. 2025 – 2 ม.ค. 2026');
  });

  it('ระยะเวลา SLA', () => {
    expect(formatDuration(0.2)).toBe('ไม่ถึง 1 นาที');
    expect(formatDuration(45)).toBe('45 นาที');
    expect(formatDuration(60)).toBe('1 ชม.');
    expect(formatDuration(135)).toBe('2 ชม. 15 นาที');
    expect(formatDuration(1440 * 3 + 240)).toBe('3 วัน 4 ชม.');
    expect(formatSlaRemaining(30 * 60_000)).toBe('เหลือ 30 นาที');
    expect(formatSlaRemaining(-90 * 60_000)).toBe('เกิน 1 ชม. 30 นาที');
  });

  it('เปอร์เซ็นต์และช่วงชั่วโมง', () => {
    expect(formatPercent(12.345)).toBe('12.3%');
    expect(formatPercent(12.3, { signed: true })).toBe('+12.3%');
    expect(formatPercent(-4, { signed: true })).toBe('−4.0%');
    expect(formatPercent(0.01, { signed: true })).toBe('0.0%');
    expect(formatHourRange(8)).toBe('08:00–09:00');
    expect(formatHourRange(23)).toBe('23:00–00:00');
  });
});
