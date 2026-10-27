import { z } from 'zod';
import { request } from '../client';
import {
  checklistTemplateSchema,
  dashboardSummarySchema,
  equipmentSchema,
  equipmentStatusSchema,
  incidentDetailSchema,
  incidentLogSchema,
  incidentSchema,
  inspectionSchema,
  revenuePointsSchema,
  problemTypeSchema,
  revenueTrendSchema,
  siteSchema,
  slaOverviewSchema,
  slaSettingSchema,
  technicianKpiSchema,
  trafficHeatmapSchema,
  userSchema,
  type ChecklistTemplateInput,
  type DateRange,
  type EquipmentInput,
  type IncidentClose,
  type IncidentCreate,
  type IncidentFilter,
  type IncidentPatch,
  type ProblemTypeInput,
  type SiteInput,
  type SlaSetting,
  type UserInput,
} from '../schemas';

const ok = z.object({ ok: z.literal(true) });

// ---- Auth ----
export const authApi = {
  me: () => request('/auth/me', userSchema),
};

// ---- Executive dashboard ----
export const dashboardApi = {
  summary: (r: DateRange) => request('/dashboard/summary', dashboardSummarySchema, { query: r }),
  revenueTrend: (r: DateRange) =>
    request('/dashboard/revenue-trend', revenueTrendSchema, { query: r }),
  revenuePoints: (r: DateRange) =>
    request('/dashboard/revenue-points', revenuePointsSchema, { query: r }),
  trafficHeatmap: (r: DateRange) =>
    request('/dashboard/traffic-heatmap', trafficHeatmapSchema, { query: r }),
};

// ---- Incidents ----
export const incidentsApi = {
  list: (f: IncidentFilter = {}) =>
    request('/incidents', z.array(incidentSchema), { query: f as Record<string, string> }),
  get: (id: string) => request(`/incidents/${id}`, incidentDetailSchema),
  create: (body: IncidentCreate) => request('/incidents', incidentSchema, { method: 'POST', body }),
  update: (id: string, body: IncidentPatch) =>
    request(`/incidents/${id}`, incidentSchema, { method: 'PATCH', body }),
  close: (id: string, body: IncidentClose) =>
    request(`/incidents/${id}/close`, incidentSchema, { method: 'POST', body }),
  addLog: (id: string, message: string) =>
    request(`/incidents/${id}/logs`, incidentLogSchema, { method: 'POST', body: { message } }),
  addPhotos: (id: string, kind: 'before' | 'after', photos: string[]) =>
    request(`/incidents/${id}/photos`, incidentSchema, { method: 'POST', body: { kind, photos } }),
};

// ---- Inspections ----
export const inspectionsApi = {
  list: (date: string) => request('/inspections', z.array(inspectionSchema), { query: { date } }),
  get: (id: string) => request(`/inspections/${id}`, inspectionSchema),
};

// ---- KPI ----
export const kpiApi = {
  technicians: (r: DateRange) =>
    request('/kpi/technicians', z.array(technicianKpiSchema), { query: r }),
  sla: (r: DateRange) => request('/kpi/sla', slaOverviewSchema, { query: r }),
};

// ---- Master data (อ่านได้ทุก role ใน Service, แก้ได้เฉพาะ admin) ----
function crud<T, I>(path: string, schema: z.ZodType<T>) {
  return {
    list: () => request(path, z.array(schema)),
    create: (body: I) => request(path, schema, { method: 'POST', body }),
    update: (id: string, body: Partial<I>) =>
      request(`${path}/${id}`, schema, { method: 'PATCH', body }),
    remove: (id: string) => request(`${path}/${id}`, ok, { method: 'DELETE' }),
  };
}

export const usersApi = {
  ...crud<z.infer<typeof userSchema>, UserInput & { active?: boolean }>('/users', userSchema),
  resetPassword: (id: string) =>
    request(`/users/${id}/reset-password`, z.object({ temporaryPassword: z.string() }), {
      method: 'POST',
    }),
};
export const sitesApi = crud<z.infer<typeof siteSchema>, SiteInput>('/sites', siteSchema);
export const equipmentApi = {
  ...crud<z.infer<typeof equipmentSchema>, EquipmentInput>('/equipment', equipmentSchema),
  status: () => request('/equipment/status', equipmentStatusSchema),
};
export const checklistsApi = crud<z.infer<typeof checklistTemplateSchema>, ChecklistTemplateInput>(
  '/checklist-templates',
  checklistTemplateSchema,
);
export const problemTypesApi = crud<z.infer<typeof problemTypeSchema>, ProblemTypeInput>(
  '/problem-types',
  problemTypeSchema,
);
export const slaApi = {
  list: () => request('/sla-settings', z.array(slaSettingSchema)),
  save: (body: SlaSetting[]) =>
    request('/sla-settings', z.array(slaSettingSchema), { method: 'PUT', body }),
};
