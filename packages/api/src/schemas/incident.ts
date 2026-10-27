import { z } from 'zod';
import { isoDateTime, prioritySchema } from './common';
import { equipmentTypeSchema } from './site';

export const incidentStatuses = [
  'open',
  'assigned',
  'in_progress',
  'waiting_parts',
  'closed',
  'cancelled',
] as const;
export const incidentStatusSchema = z.enum(incidentStatuses);
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;

/** สถานะที่ถือว่างานยังไม่จบ */
export const activeStatuses: IncidentStatus[] = [
  'open',
  'assigned',
  'in_progress',
  'waiting_parts',
];

export const problemTypeSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'กรอกชื่อประเภทปัญหา'),
  equipmentType: equipmentTypeSchema.nullable(),
  active: z.boolean(),
});
export type ProblemType = z.infer<typeof problemTypeSchema>;
export const problemTypeInputSchema = problemTypeSchema.omit({ id: true });
export type ProblemTypeInput = z.infer<typeof problemTypeInputSchema>;

export const incidentSchema = z.object({
  id: z.string(),
  code: z.string().regex(/^INC-\d{4,}$/),
  siteId: z.string(),
  equipmentId: z.string(),
  problemTypeId: z.string(),
  description: z.string(),
  priority: prioritySchema,
  status: incidentStatusSchema,
  assigneeId: z.string().nullable(),
  cause: z.string().nullable(),
  parts: z.string().nullable(),
  photosBefore: z.array(z.string()),
  photosAfter: z.array(z.string()),
  openedAt: isoDateTime,
  respondedAt: isoDateTime.nullable(),
  resolvedAt: isoDateTime.nullable(),
  slaDueAt: isoDateTime,
  inspectionId: z.string().nullable(),
});
export type Incident = z.infer<typeof incidentSchema>;

export const incidentLogSchema = z.object({
  id: z.string(),
  incidentId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  message: z.string(),
  source: z.enum(['web', 'liff']),
  createdAt: isoDateTime,
});
export type IncidentLog = z.infer<typeof incidentLogSchema>;

export const incidentDetailSchema = incidentSchema.extend({ logs: z.array(incidentLogSchema) });
export type IncidentDetail = z.infer<typeof incidentDetailSchema>;

export const incidentCreateSchema = z.object({
  siteId: z.string().min(1, 'เลือกจุดติดตั้ง'),
  equipmentId: z.string().min(1, 'เลือกอุปกรณ์'),
  problemTypeId: z.string().min(1, 'เลือกประเภทปัญหา'),
  priority: prioritySchema,
  description: z.string().trim().min(5, 'อธิบายอาการอย่างน้อย 5 ตัวอักษร'),
  photosBefore: z.array(z.string()).max(6, 'แนบรูปได้ไม่เกิน 6 รูป'),
  inspectionId: z.string().nullable().optional(),
});
export type IncidentCreate = z.infer<typeof incidentCreateSchema>;

export const incidentPatchSchema = z
  .object({
    status: incidentStatusSchema,
    priority: prioritySchema,
    assigneeId: z.string().nullable(),
    cause: z.string().nullable(),
    parts: z.string().nullable(),
  })
  .partial();
export type IncidentPatch = z.infer<typeof incidentPatchSchema>;

export const incidentCloseSchema = z.object({
  cause: z.string().trim().min(3, 'ระบุสาเหตุของปัญหา'),
  parts: z.string().trim().optional(),
  photosAfter: z.array(z.string()).min(1, 'แนบรูปหลังซ่อมอย่างน้อย 1 รูป').max(6),
});
export type IncidentClose = z.infer<typeof incidentCloseSchema>;

export type IncidentFilter = {
  q?: string;
  status?: IncidentStatus[];
  priority?: z.infer<typeof prioritySchema>[];
  siteId?: string;
  assigneeId?: string;
  from?: string;
  to?: string;
};
