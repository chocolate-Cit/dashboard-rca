import { priorityLabel, statusLabel, type IncidentStatus, type Priority } from '@gip/api';
import { slaRemainingMs, slaState, type SlaState } from '@gip/api/calc';
import type { Incident } from '@gip/api';
import {
  Ban,
  ChevronsDown,
  ChevronsUp,
  Minus,
  Siren,
  CircleCheck,
  CircleDot,
  Clock,
  Hourglass,
  Package,
  TriangleAlert,
  UserCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { formatSlaRemaining } from '../lib/format';

type Tone = 'success' | 'primary' | 'warning' | 'danger' | 'neutral';

const toneClass: Record<Tone, string> = {
  success: 'bg-success-soft text-success-fg',
  primary: 'bg-primary-soft text-primary-fg',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
  neutral: 'bg-neutral-soft text-muted',
};

/** ป้ายสถานะ: สีคู่กับไอคอนและข้อความเสมอ (ไม่สื่อด้วยสีอย่างเดียว) */
export function Badge({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        toneClass[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

const statusMeta: Record<IncidentStatus, { tone: Tone; icon: LucideIcon }> = {
  open: { tone: 'primary', icon: CircleDot },
  assigned: { tone: 'primary', icon: UserCheck },
  in_progress: { tone: 'warning', icon: Wrench },
  waiting_parts: { tone: 'warning', icon: Package },
  closed: { tone: 'success', icon: CircleCheck },
  cancelled: { tone: 'neutral', icon: Ban },
};

export function StatusBadge({ status, className }: { status: IncidentStatus; className?: string }) {
  const m = statusMeta[status];
  return (
    <Badge tone={m.tone} icon={m.icon} className={className}>
      {statusLabel[status]}
    </Badge>
  );
}

/**
 * ความเร่งด่วน: สีไล่ระดับแบบไฟจราจร + ไอคอนที่อ่านทันที + ข้อความ
 * ต่ำ = เขียว ลูกศรลง · ปานกลาง = เหลือง ขีดกลาง · สูง = ส้มทึบ ลูกศรขึ้น · วิกฤต = แดงทึบ ไซเรน
 * ระดับสูงและวิกฤตใช้พื้นทึบให้เด่นกว่าป้ายอื่นในแถว
 */
const priorityMeta: Record<Priority, { icon: LucideIcon; className: string }> = {
  low: { icon: ChevronsDown, className: 'bg-prio-low-bg text-prio-low-fg' },
  medium: { icon: Minus, className: 'bg-prio-medium-bg text-prio-medium-fg' },
  high: { icon: ChevronsUp, className: 'bg-prio-high text-white' },
  critical: {
    icon: Siren,
    className: 'bg-prio-critical text-white shadow-[0_2px_8px_-2px_var(--prio-critical)]',
  },
};
export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const { icon: Icon, className: tone } = priorityMeta[priority];
  return (
    <span
      className={cn(
        'inline-flex min-w-[5.5rem] items-center justify-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        tone,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
      {priorityLabel[priority]}
    </span>
  );
}

const slaMeta: Record<SlaState, { tone: Tone; icon: LucideIcon; label?: string }> = {
  ok: { tone: 'neutral', icon: Clock },
  warning: { tone: 'warning', icon: Hourglass },
  breached: { tone: 'danger', icon: TriangleAlert },
  met: { tone: 'success', icon: CircleCheck, label: 'ทัน SLA' },
  missed: { tone: 'danger', icon: TriangleAlert, label: 'เกิน SLA' },
  none: { tone: 'neutral', icon: Ban, label: '—' },
};

/** เวลานับถอยหลัง SLA (ใช้ now จาก parent เพื่อให้ทั้งตารางเดินพร้อมกัน) */
export function SlaBadge({
  incident,
  now,
  className,
}: {
  incident: Pick<Incident, 'status' | 'openedAt' | 'resolvedAt' | 'slaDueAt'>;
  now: Date;
  className?: string;
}) {
  const state = slaState(incident, now);
  const m = slaMeta[state];
  const text = m.label ?? formatSlaRemaining(slaRemainingMs(incident, now));
  return (
    <Badge tone={m.tone} icon={m.icon} className={cn('num', className)}>
      {text}
    </Badge>
  );
}

export function EquipmentBadge({ status }: { status: 'normal' | 'stuck' | 'down' }) {
  if (status === 'normal')
    return (
      <Badge tone="success" icon={CircleCheck}>
        ปกติ
      </Badge>
    );
  if (status === 'stuck')
    return (
      <Badge tone="warning" icon={Hourglass}>
        ค้าง
      </Badge>
    );
  return (
    <Badge tone="danger" icon={TriangleAlert}>
      เสีย
    </Badge>
  );
}
