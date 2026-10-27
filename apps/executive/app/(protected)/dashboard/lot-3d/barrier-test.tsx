'use client';

import { Button, cn, formatDateTime } from '@gip/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, FlaskConical, Radio, TriangleAlert } from 'lucide-react';

type Config = { enabled: boolean; site: string | null };
type SendResult = { site: string; raw: unknown };
type HookEvent = { site: string; armOpen: boolean | null; at: string; raw: unknown };
type HookState = { latest: Record<string, HookEvent>; events: HookEvent[] };

/**
 * ไม้กั้นใน 3D แสดง "สถานะจริงที่ไม้กั้นแจ้งกลับ" (webhook /api/barrier/hook) เท่านั้น ไม่สนว่าใครสั่ง
 * ปุ่มสั่งยก/ปิด เป็นตัวจำลองไว้ทดสอบ: ส่งคำสั่งไปที่ตู้ แล้วดูว่าตู้ตอบอะไร และมีสถานะอะไรแจ้งกลับมา
 */
export function useBarrierTest() {
  const config = useQuery({
    queryKey: ['barrier-test'],
    queryFn: async (): Promise<Config> => {
      const res = await fetch('/api/barrier', { cache: 'no-store' });
      return res.ok ? res.json() : { enabled: false, site: null };
    },
    staleTime: Infinity,
  });
  const site = config.data?.enabled ? config.data.site : null;

  const hook = useQuery({
    queryKey: ['barrier-hook'],
    queryFn: async (): Promise<HookState> => {
      const res = await fetch('/api/barrier/hook', { cache: 'no-store' });
      return res.ok ? res.json() : { latest: {}, events: [] };
    },
    enabled: !!site,
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
  });

  const send = useMutation({
    mutationFn: async (action: 'open' | 'close'): Promise<SendResult> => {
      const res = await fetch('/api/barrier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => null)) as
        | (SendResult & { message?: string })
        | null;
      if (!res.ok || !body) throw new Error(body?.message ?? 'ส่งคำสั่งไม่สำเร็จ');
      return body;
    },
  });

  const latest = site ? hook.data?.latest[site] : undefined;
  return {
    site,
    /** สถานะจริงล่าสุดที่ไม้กั้นแจ้งกลับ (null = ยังไม่เคยได้รับ) */
    arm: latest && latest.armOpen !== null ? { site: latest.site, armOpen: latest.armOpen } : null,
    events: (hook.data?.events ?? []).filter((e) => e.site === site).slice(0, 5),
    send,
  };
}

const short = (v: unknown) => JSON.stringify(v).slice(0, 120);

/** แผงจำลองในการ์ดของป้อม: ส่งคำสั่งทดสอบ + ดูคำตอบของตู้ + สถานะที่ไม้กั้นแจ้งกลับ */
export function BarrierTestControl({
  t,
  laneLabel,
}: {
  t: ReturnType<typeof useBarrierTest>;
  laneLabel: string;
}) {
  const pending = t.send.isPending ? t.send.variables : null;
  return (
    <div className="mt-3 rounded-md border border-warning/40 bg-warning-soft/40 p-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-warning-fg">
        <FlaskConical className="size-3.5" aria-hidden />
        จำลองสั่งไม้กั้น · {laneLabel} ({t.site})
      </p>
      <p className="mt-1 text-[11px] text-muted">
        ไม้กั้นที่หน้างานอาจขยับจริง ตรวจว่าไม่มีรถหรือคนอยู่ใต้ไม้กั้นก่อนกด · ไม้กั้นใน 3D
        ขยับตามสถานะที่ไม้กั้นแจ้งกลับเท่านั้น
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          size="sm"
          loading={pending === 'open'}
          disabled={t.send.isPending}
          onClick={() => t.send.mutate('open')}
        >
          {pending !== 'open' && <ArrowUpFromLine aria-hidden />}
          สั่งยก
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={pending === 'close'}
          disabled={t.send.isPending}
          onClick={() => t.send.mutate('close')}
        >
          {pending !== 'close' && <ArrowDownToLine aria-hidden />}
          สั่งปิด
        </Button>
      </div>

      {/* คำตอบของตู้ต่อคำสั่งล่าสุด */}
      <p
        role="status"
        className={cn(
          'mt-2 flex items-start gap-1.5 text-[11px] break-all',
          t.send.isError ? 'text-danger-fg' : 'text-muted',
        )}
      >
        {t.send.isError ? (
          <>
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            {t.send.error.message}
          </>
        ) : t.send.data ? (
          <>
            ตู้ตอบ ({t.send.variables === 'open' ? 'สั่งยก' : 'สั่งปิด'}): {short(t.send.data.raw)}
          </>
        ) : (
          'ยังไม่ได้ส่งคำสั่ง'
        )}
      </p>

      {/* สถานะที่ไม้กั้นแจ้งกลับ (webhook) */}
      <div className="mt-2 border-t border-warning/30 pt-2">
        <p className="flex items-center gap-1.5 text-[11px] font-medium">
          <Radio className="size-3.5" aria-hidden />
          สถานะที่ไม้กั้นแจ้งกลับ · {t.arm ? (t.arm.armOpen ? 'ยกอยู่' : 'ลงอยู่') : 'ยังไม่ได้รับ'}
        </p>
        {t.events.length > 0 ? (
          <ul className="mt-1 space-y-0.5 text-[11px] text-muted">
            {t.events.map((e) => (
              <li key={e.at} className="break-all">
                <span className="num">{formatDateTime(e.at)}</span> ·{' '}
                {e.armOpen === null ? 'อ่านไม่ได้' : e.armOpen ? 'ยก' : 'ลง'} · {short(e.raw)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[11px] text-muted">รอข้อความจากไม้กั้น (ทุก 3 วินาที)</p>
        )}
      </div>
    </div>
  );
}
