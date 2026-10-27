import { CloudOff, RotateCw, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Button } from './button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

type EmptyProps = {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
};

/** สถานะว่าง: บอกว่าเกิดอะไรขึ้น และควรทำอะไรต่อ */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-1.5 px-4 py-6' : 'gap-2 px-6 py-12',
        className,
      )}
    >
      {Icon && (
        <span className="mb-1 grid size-10 place-items-center rounded-full bg-surface-2 text-muted">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <p className="font-medium text-text">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

type ErrorProps = {
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
  compact?: boolean;
};

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'โหลดข้อมูลไม่สำเร็จ';
}

/** สถานะผิดพลาด: ข้อความจากระบบ + ปุ่มลองใหม่ */
export function ErrorState({ error, onRetry, retrying, className, compact }: ErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-danger-soft text-danger-fg">
        <CloudOff className="size-5" aria-hidden />
      </span>
      <p className="font-medium">โหลดข้อมูลไม่สำเร็จ</p>
      <p className="max-w-sm text-sm text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying} className="mt-1">
          {!retrying && <RotateCw aria-hidden />}
          ลองใหม่
        </Button>
      )}
    </div>
  );
}

/** แถบเตือนบาง ๆ เมื่อดึงข้อมูลใหม่ไม่สำเร็จแต่ยังมีข้อมูลเดิมแสดงอยู่ */
export function StaleBanner({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 rounded-md bg-warning-soft px-3 py-1.5 text-xs text-warning-fg',
        className,
      )}
    >
      <CloudOff className="size-3.5 shrink-0" aria-hidden />
      <span className="flex-1">อัปเดตไม่สำเร็จ กำลังแสดงข้อมูลล่าสุดที่มี</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-medium underline">
          ลองใหม่
        </button>
      )}
    </div>
  );
}
