import type { Site, TrafficCell } from '../schemas';

export type HeatmapMode = 'all' | 'in' | 'out';
export const HEATMAP_LEVELS = 5;

export type HeatmapRow = { site: Site; values: number[]; total: number };
export type HeatmapModel = {
  rows: HeatmapRow[];
  max: number;
  /** ค่าสูงสุดของแต่ละระดับสี (ใช้ทำ legend) */
  thresholds: number[];
  peak: { site: Site; hour: number; value: number } | null;
};

function valueOf(cell: TrafficCell, mode: HeatmapMode): number {
  if (mode === 'in') return cell.carsIn;
  if (mode === 'out') return cell.carsOut;
  return cell.carsIn + cell.carsOut;
}

/**
 * แปลงข้อมูลรายชั่วโมงเป็นตาราง จุด × 24 ชั่วโมง
 * - มุมมอง "เข้า" แสดงเฉพาะจุดทางเข้า, "ออก" เฉพาะจุดทางออก
 * - ค่าเป็นค่าเฉลี่ยต่อวัน เพื่อให้เทียบช่วงสั้น/ยาวได้
 */
export function buildHeatmap(
  cells: TrafficCell[],
  sites: Site[],
  mode: HeatmapMode,
  days = 1,
): HeatmapModel {
  const visible = sites.filter((s) => mode === 'all' || s.direction === mode);
  const divisor = Math.max(days, 1);
  const bySite = new Map(visible.map((s) => [s.id, new Array<number>(24).fill(0)]));

  for (const cell of cells) {
    const row = bySite.get(cell.siteId);
    if (!row) continue;
    row[cell.hour] = (row[cell.hour] ?? 0) + valueOf(cell, mode);
  }

  let max = 0;
  let peak: HeatmapModel['peak'] = null;
  const rows: HeatmapRow[] = visible.map((site) => {
    const values = (bySite.get(site.id) ?? []).map((v) => Math.round(v / divisor));
    values.forEach((value, hour) => {
      if (value > max) {
        max = value;
        peak = { site, hour, value };
      }
    });
    return { site, values, total: values.reduce((a, b) => a + b, 0) };
  });

  const thresholds = Array.from({ length: HEATMAP_LEVELS }, (_, i) =>
    Math.round((max * (i + 1)) / HEATMAP_LEVELS),
  );
  return { rows, max, thresholds, peak };
}

/** ระดับสี 0–4 (0 = น้อยสุด) แบ่งช่วงเท่า ๆ กันจาก 0 ถึงค่าสูงสุด */
export function heatLevel(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(HEATMAP_LEVELS - 1, Math.floor((value / max) * HEATMAP_LEVELS));
}
