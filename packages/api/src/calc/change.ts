/**
 * % เปลี่ยนแปลงเทียบช่วงก่อน
 * คืน null เมื่อช่วงก่อนเป็น 0 (หาร 0 ไม่ได้ ไม่ควรแสดงเป็น ∞%)
 */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type Trend = 'up' | 'down' | 'flat';

/** ทิศทางของการเปลี่ยนแปลง ปัดค่าที่น้อยกว่า 0.05% เป็นคงที่ */
export function trendOf(change: number | null): Trend {
  if (change === null || Math.abs(change) < 0.05) return 'flat';
  return change > 0 ? 'up' : 'down';
}
