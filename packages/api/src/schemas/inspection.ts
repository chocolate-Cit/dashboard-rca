import { z } from 'zod';
import { isoDate, isoDateTime } from './common';
import { equipmentTypeSchema } from './site';

export const checklistTemplateSchema = z.object({
  id: z.string(),
  equipmentType: equipmentTypeSchema,
  name: z.string().min(1, 'กรอกชื่อเทมเพลต'),
  items: z
    .array(z.object({ id: z.string(), label: z.string().trim().min(1, 'กรอกหัวข้อตรวจ') }))
    .min(1, 'ต้องมีหัวข้อตรวจอย่างน้อย 1 ข้อ'),
});
export type ChecklistTemplate = z.infer<typeof checklistTemplateSchema>;
export const checklistTemplateInputSchema = checklistTemplateSchema.omit({ id: true });
export type ChecklistTemplateInput = z.infer<typeof checklistTemplateInputSchema>;

export const inspectionResultSchema = z.object({
  itemId: z.string(),
  label: z.string(),
  pass: z.boolean(),
  note: z.string().nullable(),
  photo: z.string().nullable(),
});
export type InspectionResult = z.infer<typeof inspectionResultSchema>;

export const inspectionSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  equipmentId: z.string(),
  inspectorId: z.string(),
  inspectorName: z.string(),
  date: isoDate,
  inspectedAt: isoDateTime,
  results: z.array(inspectionResultSchema),
  incidentIds: z.array(z.string()),
});
export type Inspection = z.infer<typeof inspectionSchema>;
