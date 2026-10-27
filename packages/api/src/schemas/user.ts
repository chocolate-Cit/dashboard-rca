import { z } from 'zod';

export const roles = ['executive', 'admin', 'operator'] as const;
export const roleSchema = z.enum(roles);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  id: z.string(),
  employeeCode: z.string().min(1),
  name: z.string().min(1),
  role: roleSchema,
  isTechnician: z.boolean(),
  /** ตำแหน่งงาน เช่น ช่างเทคนิค, หัวหน้ากะ */
  position: z.string().nullable(),
  phone: z.string().nullable(),
  active: z.boolean(),
});
export type User = z.infer<typeof userSchema>;

export const userInputSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .min(2, 'กรอกรหัสพนักงานอย่างน้อย 2 ตัวอักษร')
    .max(20, 'รหัสพนักงานยาวเกิน 20 ตัวอักษร')
    .regex(/^[A-Za-z0-9_-]+$/, 'ใช้ได้เฉพาะ A–Z, 0–9, - และ _'),
  name: z.string().trim().min(1, 'กรอกชื่อ-นามสกุล'),
  role: roleSchema,
  isTechnician: z.boolean(),
  position: z.string().trim().max(60).nullable().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{0,20}$/, 'เบอร์โทรใช้ได้เฉพาะตัวเลข + - และช่องว่าง')
    .nullable()
    .optional(),
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').optional(),
});
export type UserInput = z.infer<typeof userInputSchema>;

/** ช่างเทคนิคต้องมีเบอร์โทร (ไว้โทรตามเมื่อเกิดปัญหา) · คืนข้อความผิดพลาด หรือ null ถ้าผ่าน */
export const TECH_PHONE_REQUIRED = 'ช่างเทคนิคต้องใส่เบอร์โทร เพื่อให้โทรตามได้เมื่อเกิดปัญหา';
export function technicianPhoneError(v: { isTechnician?: boolean; phone?: string | null }) {
  return v.isTechnician && !v.phone?.replace(/[\s-]/g, '') ? TECH_PHONE_REQUIRED : null;
}

export const loginInputSchema = z.object({
  employeeCode: z.string().trim().min(1, 'กรอกรหัสพนักงาน'),
  password: z.string().min(1, 'กรอกรหัสผ่าน'),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const loginResponseSchema = z.object({ token: z.string(), user: userSchema });
export type LoginResponse = z.infer<typeof loginResponseSchema>;
