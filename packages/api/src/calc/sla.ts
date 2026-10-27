import type { Incident, Priority, SlaSetting } from '../schemas';

/** ค่า SLA ชั่วคราว รอค่าจริงจาก CIT (ดู PRD §7) */
export const DEFAULT_SLA: SlaSetting[] = [
  { priority: 'critical', responseMinutes: 15, resolveMinutes: 240 },
  { priority: 'high', responseMinutes: 30, resolveMinutes: 480 },
  { priority: 'medium', responseMinutes: 60, resolveMinutes: 1440 },
  { priority: 'low', responseMinutes: 240, resolveMinutes: 4320 },
];

export function slaFor(priority: Priority, settings: SlaSetting[] = DEFAULT_SLA): SlaSetting {
  return (
    settings.find((s) => s.priority === priority) ??
    DEFAULT_SLA.find((s) => s.priority === priority)!
  );
}

/** กำหนดเวลาแก้ไขตาม SLA นับจากเวลาเปิดงาน */
export function slaDueAt(openedAt: string, priority: Priority, settings?: SlaSetting[]): string {
  const minutes = slaFor(priority, settings).resolveMinutes;
  return new Date(new Date(openedAt).getTime() + minutes * 60_000).toISOString();
}

export type SlaState = 'ok' | 'warning' | 'breached' | 'met' | 'missed' | 'none';

/** สัดส่วนเวลาที่เหลือที่ถือว่า "ใกล้เกิน SLA" */
export const SLA_WARNING_RATIO = 0.25;

type SlaInput = Pick<Incident, 'status' | 'openedAt' | 'resolvedAt' | 'slaDueAt'>;

/**
 * สถานะ SLA ของงาน
 * - งานที่ยังเปิด: ok / warning (เหลือ ≤25% ของเวลาทั้งหมด) / breached
 * - งานที่ปิดแล้ว: met / missed
 * - งานที่ยกเลิก: none
 */
export function slaState(incident: SlaInput, now: Date = new Date()): SlaState {
  if (incident.status === 'cancelled') return 'none';
  const due = new Date(incident.slaDueAt).getTime();
  if (incident.status === 'closed') {
    if (!incident.resolvedAt) return 'none';
    return new Date(incident.resolvedAt).getTime() <= due ? 'met' : 'missed';
  }
  const remaining = due - now.getTime();
  if (remaining < 0) return 'breached';
  const total = due - new Date(incident.openedAt).getTime();
  return remaining <= total * SLA_WARNING_RATIO ? 'warning' : 'ok';
}

/** เวลาที่เหลือก่อนครบ SLA (ms) ติดลบเมื่อเกินแล้ว */
export function slaRemainingMs(
  incident: Pick<Incident, 'slaDueAt'>,
  now: Date = new Date(),
): number {
  return new Date(incident.slaDueAt).getTime() - now.getTime();
}

/** ลำดับความสำคัญในการเรียง: เกิน SLA → ใกล้เกิน → ปกติ → ปิดแล้ว */
export function slaSortRank(state: SlaState): number {
  return { breached: 0, warning: 1, ok: 2, missed: 3, met: 3, none: 4 }[state];
}

export function minutesBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60_000;
}
