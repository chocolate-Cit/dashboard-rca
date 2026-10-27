import { z } from 'zod';

export const siteSchema = z.object({
  id: z.string(),
  code: z.string().min(1, 'กรอกรหัสจุด'),
  name: z.string().min(1, 'กรอกชื่อจุด'),
  direction: z.enum(['in', 'out']),
  /** ป้อมที่ช่องทางนี้สังกัด เช่น "จุดที่ 1 ป้อมจตุรทิศ" */
  group: z.string().nullable(),
  active: z.boolean(),
});
export type Site = z.infer<typeof siteSchema>;
export const siteInputSchema = siteSchema.omit({ id: true });
export type SiteInput = z.infer<typeof siteInputSchema>;

/** ตรงกับอุปกรณ์ในบอร์ด ESP ของ API Hardware (sub_code) */
export const equipmentTypes = [
  'esp',
  'controller',
  'computer',
  'barrier',
  'ticket',
  'payment',
  'kiosk',
  'lpr',
  'face',
  'qr',
  'notouch',
  'loop',
  'radar',
  'intercom',
] as const;
/** Kiosk Payment ไม่สังกัดป้อม: ใช้รหัสโซนนี้แทน siteId */
export const KIOSK_ZONE_ID = 'kiosk';
export const equipmentTypeSchema = z.enum(equipmentTypes);
export type EquipmentType = z.infer<typeof equipmentTypeSchema>;

/**
 * สถานะอุปกรณ์
 * - normal: ทำงานปกติ
 * - stuck:  ยังตอบสัญญาณ (heartbeat) แต่ทำงานค้าง เช่น ไม้กั้นยกค้างนานผิดปกติ
 * - down:   ตรวจสัญญาณไม่เจอแล้ว (เสีย)
 */
export const equipmentStatuses = ['normal', 'stuck', 'down'] as const;
export const equipmentStatusValueSchema = z.enum(equipmentStatuses);
export type EquipmentStatusValue = z.infer<typeof equipmentStatusValueSchema>;

export const equipmentSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  type: equipmentTypeSchema,
  name: z.string().min(1, 'กรอกชื่ออุปกรณ์'),
  status: equipmentStatusValueSchema,
  /** เวลาที่ได้รับสัญญาณล่าสุด */
  lastHeartbeatAt: z.string().nullable(),
  /** อาการที่ระบบตรวจพบ เช่น "ไม้กั้นยกค้าง 25 นาที" */
  statusNote: z.string().nullable(),
  /**
   * ไม้กั้นยกอยู่หรือไม่ (เฉพาะ type = barrier) · true = ได้คำสั่งยก, false = ได้คำสั่งปิด
   * รอ API จริงของ CIT ส่งมา ถ้าไม่ส่ง (undefined/null) ถือว่าไม้กั้นลงอยู่
   */
  armOpen: z.boolean().nullable().optional(),
  /** รหัสบอร์ด ESP ใน API Hardware เช่น ESP-001 */
  hwCode: z.string().nullable().optional(),
  /** รหัสอุปกรณ์ใน API Hardware (sub_code) เช่น LPR_02 */
  subCode: z.string().nullable().optional(),
});
export type Equipment = z.infer<typeof equipmentSchema>;
export const equipmentInputSchema = equipmentSchema.pick({ siteId: true, type: true, name: true });
export type EquipmentInput = z.infer<typeof equipmentInputSchema>;

export const equipmentStatusSchema = z.array(
  z.object({
    site: siteSchema,
    normal: z.number().int(),
    stuck: z.number().int(),
    down: z.number().int(),
    items: z.array(equipmentSchema),
  }),
);
export type EquipmentStatus = z.infer<typeof equipmentStatusSchema>;
