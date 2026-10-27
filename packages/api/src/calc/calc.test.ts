import { describe, expect, it } from 'vitest';
import type { Site, TrafficCell } from '../schemas';
import { percentChange, trendOf } from './change';
import {
  addDays,
  daysInRange,
  eachDay,
  isValidRange,
  matchPreset,
  presetRange,
  previousRange,
  toSiteDate,
} from './dates';
import { buildHeatmap, heatLevel } from './heatmap';
import { DEFAULT_SLA, slaDueAt, slaRemainingMs, slaSortRank, slaState } from './sla';

describe('percentChange', () => {
  it('คำนวณ % เพิ่ม/ลด', () => {
    expect(percentChange(120, 100)).toBeCloseTo(20);
    expect(percentChange(80, 100)).toBeCloseTo(-20);
    expect(percentChange(100, 100)).toBe(0);
  });
  it('ช่วงก่อนเป็น 0 คืน null แทน Infinity', () => {
    expect(percentChange(50, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
  it('ค่าที่ไม่ใช่ตัวเลขคืน null', () => {
    expect(percentChange(Number.NaN, 10)).toBeNull();
  });
  it('trendOf ปัดค่าเล็กมากเป็นคงที่', () => {
    expect(trendOf(0.01)).toBe('flat');
    expect(trendOf(null)).toBe('flat');
    expect(trendOf(3)).toBe('up');
    expect(trendOf(-3)).toBe('down');
  });
});

describe('dates', () => {
  it('ตัดวันตามเวลาไทย ไม่ใช่ UTC', () => {
    // 17:30 UTC = 00:30 วันถัดไปที่ไทย
    expect(toSiteDate(new Date('2026-10-15T17:30:00Z'))).toBe('2026-10-16');
    expect(toSiteDate(new Date('2026-10-15T16:59:00Z'))).toBe('2026-10-15');
  });
  it('addDays ข้ามเดือน/ปี', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('previousRange ยาวเท่ากันและต่อกันพอดี', () => {
    const r = { from: '2026-10-10', to: '2026-10-16' };
    const p = previousRange(r);
    expect(p).toEqual({ from: '2026-10-03', to: '2026-10-09' });
    expect(daysInRange(p)).toBe(daysInRange(r));
    expect(eachDay(r)).toHaveLength(7);
  });
  it('preset และการจับคู่ preset', () => {
    const now = new Date('2026-10-16T05:00:00Z');
    expect(presetRange('today', now)).toEqual({ from: '2026-10-16', to: '2026-10-16' });
    expect(presetRange('7d', now)).toEqual({ from: '2026-10-10', to: '2026-10-16' });
    expect(presetRange('month', now)).toEqual({ from: '2026-10-01', to: '2026-10-16' });
    expect(matchPreset({ from: '2026-09-17', to: '2026-10-16' }, now)).toBe('30d');
    expect(matchPreset({ from: '2026-10-02', to: '2026-10-05' }, now)).toBeNull();
  });
  it('isValidRange กันค่าผิดรูปแบบและ from > to', () => {
    expect(isValidRange({ from: '2026-10-01', to: '2026-10-02' })).toBe(true);
    expect(isValidRange({ from: '2026-10-05', to: '2026-10-02' })).toBe(false);
    expect(isValidRange({ from: '2026-13-45', to: '2026-10-02' })).toBe(false);
    expect(isValidRange({ from: 'abc' })).toBe(false);
  });
});

const site = (id: string, direction: 'in' | 'out'): Site => ({
  id,
  code: id.toUpperCase(),
  name: id,
  direction,
  group: null,
  active: true,
});
const sites = [site('in-a', 'in'), site('out-a', 'out')];
const cells: TrafficCell[] = [
  { siteId: 'in-a', hour: 8, carsIn: 100, carsOut: 0 },
  { siteId: 'in-a', hour: 9, carsIn: 40, carsOut: 0 },
  { siteId: 'out-a', hour: 18, carsIn: 0, carsOut: 60 },
  { siteId: 'unknown', hour: 1, carsIn: 999, carsOut: 999 },
];

describe('buildHeatmap', () => {
  it('มุมมองเข้า+ออก มีทุกจุด 24 ช่อง และหา peak', () => {
    const m = buildHeatmap(cells, sites, 'all');
    expect(m.rows).toHaveLength(2);
    expect(m.rows[0]!.values).toHaveLength(24);
    expect(m.max).toBe(100);
    expect(m.peak).toMatchObject({ hour: 8, value: 100 });
    expect(m.rows[0]!.total).toBe(140);
  });
  it('มุมมองเข้า/ออก กรองเฉพาะจุดตามทิศ และไม่รวมจุดที่ไม่รู้จัก', () => {
    expect(buildHeatmap(cells, sites, 'in').rows.map((r) => r.site.id)).toEqual(['in-a']);
    const out = buildHeatmap(cells, sites, 'out');
    expect(out.rows.map((r) => r.site.id)).toEqual(['out-a']);
    expect(out.max).toBe(60);
  });
  it('หลายวันเป็นค่าเฉลี่ยต่อวัน', () => {
    expect(buildHeatmap(cells, sites, 'in', 4).max).toBe(25);
  });
  it('ไม่มีข้อมูล: max 0 และ peak null', () => {
    const m = buildHeatmap([], sites, 'all');
    expect(m.max).toBe(0);
    expect(m.peak).toBeNull();
    expect(m.thresholds).toEqual([0, 0, 0, 0, 0]);
  });
  it('heatLevel แบ่ง 5 ระดับ ค่าสูงสุดอยู่ระดับบนสุด', () => {
    expect(heatLevel(0, 100)).toBe(0);
    expect(heatLevel(19, 100)).toBe(0);
    expect(heatLevel(20, 100)).toBe(1);
    expect(heatLevel(59, 100)).toBe(2);
    expect(heatLevel(100, 100)).toBe(4);
    expect(heatLevel(5, 0)).toBe(0);
  });
});

describe('SLA', () => {
  const openedAt = '2026-10-16T01:00:00.000Z';
  const due = slaDueAt(openedAt, 'high'); // high = 480 นาที
  const base = { status: 'in_progress' as const, openedAt, resolvedAt: null, slaDueAt: due };

  it('กำหนดเวลาตามระดับความเร่งด่วน', () => {
    expect(due).toBe('2026-10-16T09:00:00.000Z');
    const custom = [{ priority: 'high' as const, responseMinutes: 10, resolveMinutes: 60 }];
    expect(slaDueAt(openedAt, 'high', custom)).toBe('2026-10-16T02:00:00.000Z');
    // ระดับที่ไม่ได้ตั้งค่า ใช้ค่าเริ่มต้น
    expect(slaDueAt(openedAt, 'low', custom)).toBe(slaDueAt(openedAt, 'low', DEFAULT_SLA));
  });
  it('ok → warning (เหลือ ≤25%) → breached', () => {
    expect(slaState(base, new Date('2026-10-16T03:00:00Z'))).toBe('ok');
    expect(slaState(base, new Date('2026-10-16T07:00:00Z'))).toBe('warning');
    expect(slaState(base, new Date('2026-10-16T09:00:01Z'))).toBe('breached');
  });
  it('งานปิดแล้ววัดจากเวลาปิด', () => {
    expect(
      slaState(
        { ...base, status: 'closed', resolvedAt: '2026-10-16T08:59:00Z' },
        new Date('2026-10-20'),
      ),
    ).toBe('met');
    expect(slaState({ ...base, status: 'closed', resolvedAt: '2026-10-16T09:30:00Z' })).toBe(
      'missed',
    );
    expect(slaState({ ...base, status: 'cancelled' })).toBe('none');
  });
  it('เวลาที่เหลือติดลบเมื่อเกิน และงานเกินเรียงก่อน', () => {
    expect(slaRemainingMs(base, new Date('2026-10-16T09:30:00Z'))).toBe(-30 * 60_000);
    expect(slaSortRank('breached')).toBeLessThan(slaSortRank('warning'));
    expect(slaSortRank('warning')).toBeLessThan(slaSortRank('ok'));
  });
});
