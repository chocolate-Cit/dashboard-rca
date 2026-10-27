'use client';

import type { EquipmentStatus } from '@gip/api';
import { useEquipmentStatus } from '@gip/api/hooks';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { HwBoard, HwLive } from '@/app/api/hw/route';

/** โพลทุก 6 วินาที (API cache ~5 วินาที · จำกัด 120 ครั้ง/นาที/IP) */
const HW_POLL_MS = 6_000;

/** แสดงสิ่งที่ API Hardware ส่งมาใน Console ของเบราว์เซอร์ (F12 → Console) */
function logHw(d: HwLive) {
  if (!d.enabled) {
    console.info('[API Hardware] ยังไม่ได้ตั้งค่า CIT_HW_URL / CIT_HW_KEY → ใช้ข้อมูลจำลอง');
    return;
  }
  const time = d.serverTime ? new Date(d.serverTime).toLocaleTimeString('th-TH') : '-';
  console.groupCollapsed(`[API Hardware] ${time} · ${d.boards.length} บอร์ด`);
  console.table(
    d.boards.map((b) => ({
      บอร์ด: b.hwCode,
      สถานะ: b.displayStatus,
      ส่งข้อมูลล่าสุด: b.lastSeenAt ? new Date(b.lastSeenAt).toLocaleString('th-TH') : '-',
      อุปกรณ์ที่error: Object.entries(b.errors)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', '),
    })),
  );
  if (d.raw !== undefined) console.log('ข้อมูลดิบจาก API:', d.raw);
  console.groupEnd();
}

function useHwLive() {
  return useQuery({
    queryKey: ['hw', 'live'],
    queryFn: async (): Promise<HwLive> => {
      const res = await fetch('/api/hw', { cache: 'no-store' });
      if (!res.ok) {
        const msg = (
          (await res
            .clone()
            .json()
            .catch(() => null)) as { message?: string } | null
        )?.message;
        console.warn(`[API Hardware] เรียกไม่สำเร็จ HTTP ${res.status}`, msg ?? '');
        throw new Error(
          ((await res.json().catch(() => null)) as { message?: string } | null)?.message ??
            `HTTP ${res.status}`,
        );
      }
      const data = (await res.json()) as HwLive;
      logHw(data);
      return data;
    },
    refetchInterval: HW_POLL_MS,
    // ไม่ลองซ้ำหลายรอบ (รอบละ 4 วินาที) ให้รู้ผลเร็ว · รอบโพลถัดไปจะลองใหม่เอง
    retry: 1,
    refetchIntervalInBackground: false,
  });
}

type Rows = EquipmentStatus;
type Item = Rows[number]['items'][number];

/**
 * ทับสถานะอุปกรณ์ด้วยข้อมูลจริงจาก API Hardware (จับคู่ด้วย hwCode + subCode)
 * - ERROR: ตัวที่อยู่ใน hw_detail = เสีย (แสดง error_description)
 * - OFFLINE / NO_DATA: บอร์ด ESP และอุปกรณ์ทุกตัวในบอร์ดแสดงว่า "ออฟไลน์"
 * - บอร์ดที่ไม่อยู่ใน API: คงข้อมูลเดิม
 */
function applyHw(rows: Rows, boards: HwBoard[]): Rows {
  const byCode = new Map(boards.map((b) => [b.hwCode, b]));
  return rows.map((row) => {
    const items = row.items.map((e): Item => {
      const b = e.hwCode ? byCode.get(e.hwCode.toUpperCase()) : undefined;
      if (!b) return e;
      const base = { ...e, lastHeartbeatAt: b.lastSeenAt ?? e.lastHeartbeatAt };
      if (b.displayStatus === 'OFFLINE' || b.displayStatus === 'NO_DATA') {
        // ESP (Head) ออฟไลน์ → อุปกรณ์ทุกตัวในบอร์ด (Sub) ออฟไลน์ตาม (API ส่ง status = unknown)
        return { ...base, status: 'down', statusNote: 'ออฟไลน์' };
      }
      const err = e.subCode ? b.errors[e.subCode.toUpperCase()] : undefined;
      return err
        ? { ...base, status: 'down', statusNote: err }
        : { ...base, status: 'normal', statusNote: null };
    });
    const count = (s: Item['status']) => items.filter((e) => e.status === s).length;
    return { ...row, items, normal: count('normal'), stuck: count('stuck'), down: count('down') };
  });
}

/** เชื่อมต่อ API Hardware ไม่ได้: อุปกรณ์ที่ผูกกับบอร์ด ESP ทุกตัวถือว่าไม่ทราบสถานะ (แสดงเป็นเสีย) */
function markUnknown(rows: Rows): Rows {
  return rows.map((row) => {
    const items = row.items.map(
      (e): Item =>
        e.hwCode ? { ...e, status: 'down', statusNote: 'ไม่มีสัญญาณจาก API Hardware' } : e,
    );
    const count = (s: Item['status']) => items.filter((e) => e.status === s).length;
    return { ...row, items, normal: count('normal'), stuck: count('stuck'), down: count('down') };
  });
}

/** เหมือน useEquipmentStatus แต่ใช้สถานะจริงจาก API Hardware เมื่อตั้งค่าไว้ */
export function useLiveEquipmentStatus() {
  const q = useEquipmentStatus();
  const hw = useHwLive();
  // isPending กลับเป็น true ทุกครั้งที่ลองใหม่ถ้ายังไม่เคยได้ข้อมูล → ใช้ isFetched (เคยได้ผลอย่างน้อย 1 รอบ) แทน
  const waiting = !hw.isFetched;
  const failed = hw.isFetched && !hw.data;
  const data = useMemo(() => {
    // ยังไม่ได้คำตอบแรกจาก /api/hw: รอก่อน (ไม่โชว์ข้อมูลจำลองว่า "ปกติ" ไปพลาง ๆ)
    if (!q.data || waiting) return undefined;
    // เรียก API Hardware ไม่ได้เลยตั้งแต่ต้น: ไม่ทราบสถานะจริง ห้ามแสดงว่าปกติ
    if (failed) return markUnknown(q.data);
    // เรียกไม่ได้รอบล่าสุดแต่เคยได้ข้อมูล: ใช้ข้อมูลเดิม (หน้าเว็บขึ้นป้าย "ข้อมูลอาจเก่า")
    return hw.data?.enabled ? applyHw(q.data, hw.data.boards) : q.data;
  }, [q.data, hw.data, waiting, failed]);
  return {
    ...q,
    isPending: q.isPending || waiting,
    data,
    live: !!hw.data?.enabled,
    liveError: hw.isError || failed,
    liveAt: hw.data?.serverTime ?? null,
  };
}
