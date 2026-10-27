import { z } from 'zod';
import { isoDate, prioritySchema } from './common';
import { userSchema } from './user';

export const slaSettingSchema = z.object({
  priority: prioritySchema,
  responseMinutes: z.number().int().positive('ต้องมากกว่า 0 นาที'),
  resolveMinutes: z.number().int().positive('ต้องมากกว่า 0 นาที'),
});
export type SlaSetting = z.infer<typeof slaSettingSchema>;

export const technicianKpiSchema = z.object({
  user: userSchema,
  total: z.number().int(),
  closed: z.number().int(),
  open: z.number().int(),
  avgResponseMinutes: z.number().nullable(),
  avgResolveMinutes: z.number().nullable(),
  slaMet: z.number().int(),
  slaMeasured: z.number().int(),
});
export type TechnicianKpi = z.infer<typeof technicianKpiSchema>;

export const slaOverviewSchema = z.object({
  byPriority: z.array(
    z.object({ priority: prioritySchema, measured: z.number().int(), met: z.number().int() }),
  ),
  trend: z.array(z.object({ date: isoDate, measured: z.number().int(), met: z.number().int() })),
});
export type SlaOverview = z.infer<typeof slaOverviewSchema>;
