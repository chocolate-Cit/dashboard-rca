'use client';

import { KIOSK_ZONE_ID, type EquipmentStatus } from '@gip/api';
import { useLiveEquipmentStatus } from '@/lib/live-equipment';
import {
  Badge,
  cn,
  EmptyState,
  EquipmentBadge,
  ErrorState,
  formatNumber,
  formatRelative,
  Panel,
  Skeleton,
  StaleBanner,
} from '@gip/ui';
import { ChevronDown, CircleCheck, LogIn, LogOut, TriangleAlert, Wallet } from 'lucide-react';
import { useState } from 'react';

type Row = EquipmentStatus[number];
/** กลุ่มตามป้อม (ช่องทางทุกช่องของป้อมเดียวกัน) */
type Group = {
  key: string;
  label: string;
  lanes: Row[];
  items: Row['items'];
  normal: number;
  stuck: number;
  down: number;
};

function groupByCheckpoint(rows: Row[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const key = r.site.group ?? r.site.code;
    const g = map.get(key) ?? {
      key,
      label: key,
      lanes: [],
      items: [],
      normal: 0,
      stuck: 0,
      down: 0,
    };
    g.lanes.push(r);
    g.items.push(...r.items.map(asTwoState));
    g.normal += r.normal;
    g.down += r.down + r.stuck; // Dashboard ผู้บริหาร: อุปกรณ์ค้างนับเป็นเสีย (มีแค่ปกติ/เสีย)
    map.set(key, g);
  }
  return [...map.values()];
}

/** สีของป้อม: แดง = มีอย่างน้อย 1 เครื่องเสีย, เขียว = ปกติทั้งหมด */
function siteTone(r: { down: number }) {
  return r.down > 0 ? 'danger' : 'success';
}

/** Dashboard ผู้บริหารมีแค่ 2 สถานะ: เครื่องค้างแสดงเป็นเสีย */
function asTwoState<T extends { status: 'normal' | 'stuck' | 'down' }>(e: T): T {
  return e.status === 'stuck' ? { ...e, status: 'down' } : e;
}

const segClass = { normal: 'bg-success/55', stuck: 'bg-danger', down: 'bg-danger' } as const;

type Unit = {
  key: string;
  dir: 'in' | 'out' | 'kiosk';
  title: string;
  code: string;
  hwCode: string;
  items: Row['items'];
};

/** แยกเป็นช่องทาง (เข้า 1, เข้า 2, ออก 1 …) หรือรายตู้ Kiosk ตามบอร์ด ESP · ทางเข้าขึ้นก่อนทางออก */
function laneUnits(row: Group): Unit[] {
  const units: Unit[] = [];
  for (const lane of row.lanes) {
    if (lane.site.id === KIOSK_ZONE_ID) {
      const boards = new Map<string, Row['items']>();
      for (const e of lane.items)
        boards.set(e.hwCode ?? '', [...(boards.get(e.hwCode ?? '') ?? []), e]);
      for (const [hw, items] of boards) {
        const name = items.find((e) => e.type === 'kiosk')?.name ?? hw;
        units.push({ key: hw, dir: 'kiosk', title: name, code: name, hwCode: hw, items });
      }
      continue;
    }
    const n = /(\d+)$/.exec(lane.site.code)?.[1] ?? '';
    const dir = lane.site.direction;
    units.push({
      key: lane.site.id,
      dir,
      title: `${dir === 'in' ? 'ทางเข้า' : 'ทางออก'} ${n}`,
      code: lane.site.code,
      hwCode: lane.items[0]?.hwCode ?? '',
      items: lane.items,
    });
  }
  return units.sort((a, b) =>
    a.dir === b.dir ? a.code.localeCompare(b.code) : a.dir === 'in' ? -1 : 1,
  );
}

/** ตัดรหัสช่องทางท้ายชื่ออุปกรณ์ออก (หัวการ์ดบอกแล้ว) */
const shortName = (name: string, code: string) =>
  name.endsWith(` ${code}`) ? name.slice(0, -code.length - 1) : name;

function SiteRow({ row, open, onToggle }: { row: Group; open: boolean; onToggle: () => void }) {
  const tone = siteTone(row);
  const isKiosk = row.lanes.every((l) => l.site.id === KIOSK_ZONE_ID);
  const total = row.items.length;
  // คงลำดับอุปกรณ์ตามเดิม ไม่ยกตัวที่เสียขึ้นบน (ตำแหน่งไม่กระโดดเมื่อสถานะเปลี่ยน)
  const items = row.items;
  const panelId = `eq-${row.key.replace(/\W/g, '')}`;

  return (
    <li className="py-1 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="-mx-2 w-[calc(100%+1rem)] rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-hover"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm">
            <span className="font-medium">{row.label}</span>
            <span className="text-muted">
              {' '}
              {isKiosk
                ? `· ${row.items.length} เครื่อง`
                : `· เข้า ${row.lanes.filter((l) => l.site.direction === 'in').length} ออก ${row.lanes.filter((l) => l.site.direction === 'out').length}`}
            </span>
          </p>
          <span className="flex shrink-0 items-center gap-1.5">
            {tone === 'success' ? (
              <Badge tone="success" icon={CircleCheck}>
                ปกติ {total}
              </Badge>
            ) : (
              <>
                {row.down > 0 && (
                  <Badge tone="danger" icon={TriangleAlert}>
                    เสีย {row.down}
                  </Badge>
                )}
              </>
            )}
            <ChevronDown
              className={cn(
                'size-4 text-muted transition-transform duration-200',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </span>
        </div>
        <div className="mt-2 flex h-1.5 gap-[2px] overflow-hidden rounded-full" aria-hidden>
          {items.map((e) => (
            <span key={e.id} className={cn('flex-1', segClass[e.status])} />
          ))}
        </div>
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <ul id={panelId} className="mt-1 mb-2 grid gap-2 sm:grid-cols-2">
            {laneUnits(row).map((u) => {
              const items = u.items.map(asTwoState);
              const bad = items.filter((e) => e.status !== 'normal').length;
              const Icon = u.dir === 'in' ? LogIn : u.dir === 'out' ? LogOut : Wallet;
              return (
                <li
                  key={u.key}
                  className={cn(
                    'overflow-hidden rounded-md border bg-surface',
                    bad ? 'border-danger/40' : 'border-border',
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center gap-2 border-b px-2.5 py-2',
                      u.dir === 'in'
                        ? 'border-primary/25 bg-primary/10'
                        : u.dir === 'out'
                          ? 'border-violet-400/25 bg-violet-400/10'
                          : 'border-border bg-surface-2',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded',
                        u.dir === 'in'
                          ? 'bg-primary text-white'
                          : u.dir === 'out'
                            ? 'bg-violet-500 text-white'
                            : 'bg-surface-hover text-text',
                      )}
                      aria-hidden
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {u.title}
                      {u.code !== u.title && (
                        <span className="ml-1.5 text-xs font-normal text-muted">{u.code}</span>
                      )}
                    </p>
                    {bad ? (
                      <Badge tone="danger" icon={TriangleAlert}>
                        เสีย {bad}
                      </Badge>
                    ) : (
                      <Badge tone="success" icon={CircleCheck}>
                        ปกติ {items.length}
                      </Badge>
                    )}
                  </div>
                  <ul className="p-1">
                    {items.map((e) => (
                      <li key={e.id} className="flex items-start gap-3 rounded px-2 py-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">
                            {e.type === 'kiosk' ? 'เครื่องพิมพ์ใบเสร็จ' : shortName(e.name, u.code)}
                          </p>
                          {e.statusNote && <p className="text-xs text-danger-fg">{e.statusNote}</p>}
                          {e.status !== 'normal' && e.lastHeartbeatAt && (
                            <p className="text-xs text-muted">
                              สัญญาณล่าสุด {formatRelative(e.lastHeartbeatAt)}
                            </p>
                          )}
                        </div>
                        <EquipmentBadge status={e.status} />
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </li>
  );
}

/** สถานะอุปกรณ์แยกจุด: กดที่จุดเพื่อดูว่าเครื่องไหนเสีย */
export function EquipmentPanel({ className }: { className?: string }) {
  const q = useLiveEquipmentStatus();
  const rows = q.data ?? [];
  const groups = groupByCheckpoint(rows);
  const [open, setOpen] = useState<string | null>(null);
  const down = rows.reduce((a, r) => a + r.down + r.stuck, 0);
  const total = rows.reduce((a, r) => a + r.items.length, 0);

  return (
    <Panel
      id="equipment"
      title="สถานะอุปกรณ์"
      className={className}
      bodyClassName="pt-3"
      description={
        q.data ? (
          down ? (
            <span className="num">
              เสีย <span className="font-semibold text-danger-fg">{formatNumber(down)}</span> จาก{' '}
              {formatNumber(total)} เครื่อง · กดที่ป้อมเพื่อดูรายละเอียด
            </span>
          ) : (
            `ทั้ง ${formatNumber(total)} เครื่องทำงานปกติ`
          )
        ) : undefined
      }
    >
      {q.isError && q.data && <StaleBanner className="mb-3" onRetry={() => q.refetch()} />}
      {q.liveError && (
        <p
          role="status"
          className="mb-3 flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-fg"
        >
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
          เชื่อมต่อ API Hardware ไม่ได้ · สถานะที่แสดงอาจไม่ใช่ปัจจุบัน
        </p>
      )}
      {q.isPending ? (
        <div className="space-y-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} compact />
      ) : rows.length === 0 ? (
        <EmptyState title="ยังไม่มีจุดติดตั้ง" compact />
      ) : (
        <ul className="divide-y divide-border">
          {groups.map((g) => (
            <SiteRow
              key={g.key}
              row={g}
              open={open === g.key}
              onToggle={() => setOpen((o) => (o === g.key ? null : g.key))}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}
