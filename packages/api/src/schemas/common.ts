import { z } from 'zod';

export const isoDateTime = z.string().datetime({ offset: true });
/** วันที่แบบ YYYY-MM-DD */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const dateRangeSchema = z.object({ from: isoDate, to: isoDate });
export type DateRange = z.infer<typeof dateRangeSchema>;

export const priorities = ['low', 'medium', 'high', 'critical'] as const;
export const prioritySchema = z.enum(priorities);
export type Priority = z.infer<typeof prioritySchema>;

export const apiErrorSchema = z.object({ message: z.string(), code: z.string().optional() });
