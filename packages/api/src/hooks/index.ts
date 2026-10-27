'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import {
  authApi,
  checklistsApi,
  dashboardApi,
  equipmentApi,
  incidentsApi,
  inspectionsApi,
  kpiApi,
  problemTypesApi,
  sitesApi,
  slaApi,
  usersApi,
} from '../endpoints';
import type {
  ChecklistTemplateInput,
  DateRange,
  EquipmentInput,
  IncidentClose,
  IncidentCreate,
  IncidentFilter,
  IncidentPatch,
  ProblemTypeInput,
  SiteInput,
  SlaSetting,
  UserInput,
} from '../schemas';

/** ช่วงดึงข้อมูลใหม่ (ms) — หยุดเองเมื่อแท็บไม่ได้เปิดอยู่ (refetchIntervalInBackground = false) */
export const POLL_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS) || 30_000;
const live = { refetchInterval: POLL_INTERVAL_MS, refetchIntervalInBackground: false } as const;

export const keys = {
  me: ['auth', 'me'] as const,
  dashboard: (name: string, r: DateRange) => ['dashboard', name, r.from, r.to] as const,
  equipmentStatus: ['equipment', 'status'] as const,
  incidents: (f: IncidentFilter = {}) => ['incidents', 'list', f] as const,
  incident: (id: string) => ['incidents', 'detail', id] as const,
  inspections: (date: string) => ['inspections', 'list', date] as const,
  inspection: (id: string) => ['inspections', 'detail', id] as const,
  kpi: (name: string, r: DateRange) => ['kpi', name, r.from, r.to] as const,
  users: ['users'] as const,
  sites: ['sites'] as const,
  equipment: ['equipment', 'list'] as const,
  checklists: ['checklist-templates'] as const,
  problemTypes: ['problem-types'] as const,
  sla: ['sla-settings'] as const,
};

// ---------- Queries ----------
export const useMe = () => useQuery({ queryKey: keys.me, queryFn: authApi.me, staleTime: 60_000 });

export const useDashboardSummary = (r: DateRange) =>
  useQuery({
    queryKey: keys.dashboard('summary', r),
    queryFn: () => dashboardApi.summary(r),
    placeholderData: keepPreviousData,
    ...live,
  });
export const useRevenueTrend = (r: DateRange) =>
  useQuery({
    queryKey: keys.dashboard('revenue-trend', r),
    queryFn: () => dashboardApi.revenueTrend(r),
    placeholderData: keepPreviousData,
    ...live,
  });
export const useRevenuePoints = (r: DateRange) =>
  useQuery({
    queryKey: keys.dashboard('revenue-points', r),
    queryFn: () => dashboardApi.revenuePoints(r),
    placeholderData: keepPreviousData,
    ...live,
  });
export const useTrafficHeatmap = (r: DateRange) =>
  useQuery({
    queryKey: keys.dashboard('traffic-heatmap', r),
    queryFn: () => dashboardApi.trafficHeatmap(r),
    placeholderData: keepPreviousData,
    ...live,
  });
export const useEquipmentStatus = () =>
  useQuery({ queryKey: keys.equipmentStatus, queryFn: equipmentApi.status, ...live });

export const useIncidents = (f: IncidentFilter = {}) =>
  useQuery({
    queryKey: keys.incidents(f),
    queryFn: () => incidentsApi.list(f),
    placeholderData: keepPreviousData,
    ...live,
  });
export const useIncident = (id: string) =>
  useQuery({ queryKey: keys.incident(id), queryFn: () => incidentsApi.get(id), ...live });

export const useInspections = (date: string) =>
  useQuery({
    queryKey: keys.inspections(date),
    queryFn: () => inspectionsApi.list(date),
    placeholderData: keepPreviousData,
    ...live,
  });
export const useInspection = (id: string) =>
  useQuery({ queryKey: keys.inspection(id), queryFn: () => inspectionsApi.get(id) });

export const useTechnicianKpi = (r: DateRange) =>
  useQuery({
    queryKey: keys.kpi('technicians', r),
    queryFn: () => kpiApi.technicians(r),
    placeholderData: keepPreviousData,
    ...live,
  });
export const useSlaOverview = (r: DateRange) =>
  useQuery({
    queryKey: keys.kpi('sla', r),
    queryFn: () => kpiApi.sla(r),
    placeholderData: keepPreviousData,
    ...live,
  });

export const useUsers = () => useQuery({ queryKey: keys.users, queryFn: usersApi.list });
export const useSites = () =>
  useQuery({ queryKey: keys.sites, queryFn: sitesApi.list, staleTime: 5 * 60_000 });
export const useEquipment = () =>
  useQuery({ queryKey: keys.equipment, queryFn: equipmentApi.list, staleTime: 60_000 });
export const useChecklists = () =>
  useQuery({ queryKey: keys.checklists, queryFn: checklistsApi.list });
export const useProblemTypes = () =>
  useQuery({ queryKey: keys.problemTypes, queryFn: problemTypesApi.list, staleTime: 5 * 60_000 });
export const useSlaSettings = () => useQuery({ queryKey: keys.sla, queryFn: slaApi.list });

// ---------- Mutations ----------
function useInvalidating<TVars, TData>(fn: (v: TVars) => Promise<TData>, invalidate: QueryKey[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k }))),
  });
}

/** งานซ่อมกระทบสถานะอุปกรณ์ KPI และ dashboard จึง invalidate ทั้งชุด */
const incidentRelated: QueryKey[] = [['incidents'], ['equipment'], ['kpi'], ['inspections']];

export const useCreateIncident = () =>
  useInvalidating((b: IncidentCreate) => incidentsApi.create(b), incidentRelated);
export const useUpdateIncident = (id: string) =>
  useInvalidating((b: IncidentPatch) => incidentsApi.update(id, b), incidentRelated);
export const useCloseIncident = (id: string) =>
  useInvalidating((b: IncidentClose) => incidentsApi.close(id, b), incidentRelated);
export const useAddIncidentLog = (id: string) =>
  useInvalidating((m: string) => incidentsApi.addLog(id, m), [keys.incident(id)]);
export const useAddIncidentPhotos = (id: string) =>
  useInvalidating(
    (v: { kind: 'before' | 'after'; photos: string[] }) =>
      incidentsApi.addPhotos(id, v.kind, v.photos),
    [keys.incident(id)],
  );

type Id<T> = { id: string; body: T };

export const useSaveUser = () =>
  useInvalidating(
    (v: { id?: string; body: Partial<UserInput> & { active?: boolean } }) =>
      v.id ? usersApi.update(v.id, v.body) : usersApi.create(v.body as UserInput),
    [keys.users, ['kpi']],
  );
export const useResetPassword = () =>
  useMutation({ mutationFn: (id: string) => usersApi.resetPassword(id) });

export const useSaveSite = () =>
  useInvalidating(
    (v: { id?: string; body: Partial<SiteInput> }) =>
      v.id ? sitesApi.update(v.id, v.body) : sitesApi.create(v.body as SiteInput),
    [keys.sites, ['equipment'], ['dashboard']],
  );
export const useSaveEquipment = () =>
  useInvalidating(
    (v: { id?: string; body: Partial<EquipmentInput> }) =>
      v.id ? equipmentApi.update(v.id, v.body) : equipmentApi.create(v.body as EquipmentInput),
    [['equipment']],
  );
export const useDeleteEquipment = () =>
  useInvalidating((id: string) => equipmentApi.remove(id), [['equipment']]);
export const useSaveChecklist = () =>
  useInvalidating(
    (v: { id?: string; body: ChecklistTemplateInput }) =>
      v.id ? checklistsApi.update(v.id, v.body) : checklistsApi.create(v.body),
    [keys.checklists],
  );
export const useDeleteChecklist = () =>
  useInvalidating((id: string) => checklistsApi.remove(id), [keys.checklists]);
export const useSaveProblemType = () =>
  useInvalidating(
    (v: { id?: string; body: Partial<ProblemTypeInput> }) =>
      v.id
        ? problemTypesApi.update(v.id, v.body)
        : problemTypesApi.create(v.body as ProblemTypeInput),
    [keys.problemTypes],
  );
export const useDeleteProblemType = () =>
  useInvalidating((id: string) => problemTypesApi.remove(id), [keys.problemTypes]);
export const useSaveSla = () =>
  useInvalidating((body: SlaSetting[]) => slaApi.save(body), [keys.sla, ['kpi'], ['incidents']]);

export type { Id };
