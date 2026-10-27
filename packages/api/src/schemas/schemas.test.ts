import { describe, expect, it } from 'vitest';
import {
  incidentCloseSchema,
  incidentCreateSchema,
  incidentSchema,
  loginInputSchema,
  slaSettingSchema,
  userInputSchema,
} from './index';

describe('schemas', () => {
  it('login ต้องมีทั้งรหัสพนักงานและรหัสผ่าน', () => {
    expect(
      loginInputSchema.safeParse({ employeeCode: ' OP01 ', password: 'x' }).data?.employeeCode,
    ).toBe('OP01');
    const r = loginInputSchema.safeParse({ employeeCode: '', password: '' });
    expect(r.success).toBe(false);
    expect(r.error?.flatten().fieldErrors.employeeCode?.[0]).toBe('กรอกรหัสพนักงาน');
  });

  it('รหัสพนักงานรับเฉพาะตัวอักษรอังกฤษ ตัวเลข - _', () => {
    const ok = {
      employeeCode: 'TECH-06',
      name: 'ช่าง',
      role: 'operator',
      isTechnician: true,
      password: '12345678',
    };
    expect(userInputSchema.safeParse(ok).success).toBe(true);
    expect(userInputSchema.safeParse({ ...ok, employeeCode: 'ช่าง 1' }).success).toBe(false);
    expect(userInputSchema.safeParse({ ...ok, password: 'short' }).success).toBe(false);
    expect(userInputSchema.safeParse({ ...ok, role: 'root' }).success).toBe(false);
  });

  it('เลขงานต้องเป็นรูปแบบ INC-0001', () => {
    const inc = {
      id: 'i',
      code: 'INC-0001',
      siteId: 's',
      equipmentId: 'e',
      problemTypeId: 'p',
      description: 'x',
      priority: 'high',
      status: 'open',
      assigneeId: null,
      cause: null,
      parts: null,
      photosBefore: [],
      photosAfter: [],
      openedAt: '2026-10-16T01:00:00.000Z',
      respondedAt: null,
      resolvedAt: null,
      slaDueAt: '2026-10-16T09:00:00.000Z',
      inspectionId: null,
    };
    expect(incidentSchema.safeParse(inc).success).toBe(true);
    expect(incidentSchema.safeParse({ ...inc, code: 'INC1' }).success).toBe(false);
  });

  it('เปิดงานต้องเลือกครบและอธิบายอาการ', () => {
    const r = incidentCreateSchema.safeParse({
      siteId: '',
      equipmentId: '',
      problemTypeId: '',
      priority: 'low',
      description: 'ab',
      photosBefore: [],
    });
    const fe = r.error!.flatten().fieldErrors;
    expect(fe.siteId?.[0]).toBe('เลือกจุดติดตั้ง');
    expect(fe.description?.[0]).toBe('อธิบายอาการอย่างน้อย 5 ตัวอักษร');
  });

  it('ปิดงานบังคับสาเหตุและรูปหลังซ่อมอย่างน้อย 1 รูป', () => {
    expect(
      incidentCloseSchema.safeParse({ cause: 'สายหลวม', photosAfter: ['data:x'] }).success,
    ).toBe(true);
    const r = incidentCloseSchema.safeParse({ cause: '', photosAfter: [] });
    expect(r.error!.flatten().fieldErrors.photosAfter?.[0]).toBe('แนบรูปหลังซ่อมอย่างน้อย 1 รูป');
  });

  it('SLA ต้องเป็นนาทีที่มากกว่า 0', () => {
    expect(
      slaSettingSchema.safeParse({ priority: 'low', responseMinutes: 0, resolveMinutes: 10 })
        .success,
    ).toBe(false);
  });
});
