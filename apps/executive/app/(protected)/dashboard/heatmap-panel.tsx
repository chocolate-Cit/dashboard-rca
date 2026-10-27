'use client';

import type { DateRange } from '@gip/api';
import { buildHeatmap, type HeatmapMode } from '@gip/api/calc';
import { useSites, useTrafficHeatmap } from '@gip/api/hooks';
import { EmptyState, ErrorState, Panel, SegmentedControl, Skeleton, StaleBanner } from '@gip/ui';
import { Heatmap } from '@gip/ui/charts';
import { CarFront } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLiveExtras } from '@/lib/live-summary';

const modes: { value: HeatmapMode; label: string }[] = [
  { value: 'all', label: 'เข้า+ออก' },
  { value: 'in', label: 'รถเข้า' },
  { value: 'out', label: 'รถออก' },
];

export function HeatmapPanel({ range }: { range: DateRange }) {
  const [mode, setMode] = useState<HeatmapMode>('all');
  const q = useTrafficHeatmap(range);
  const sites = useSites();
  // ข้อมูลจริงรายชั่วโมงของวันนี้จาก API v2 (ไม่ใช่ค่าเฉลี่ย) · ไม่มี = ใช้ข้อมูลจำลอง
  const hourly = useLiveExtras()?.hourly;

  const model = useMemo(
    () =>
      hourly
        ? buildHeatmap(hourly.cells, hourly.sites, mode, 1)
        : q.data && sites.data
          ? buildHeatmap(
              q.data.cells,
              sites.data.filter((s) => s.active),
              mode,
              q.data.days,
            )
          : null,
    [hourly, q.data, sites.data, mode],
  );
  const days = hourly ? 1 : (q.data?.days ?? 1);
  const error = hourly ? null : (q.error ?? sites.error);

  return (
    <Panel
      id="heatmap"
      title="ปริมาณรถรายชั่วโมง"
      description={
        days > 1 ? `เฉลี่ยต่อวัน จาก ${days} วัน · แยกตามจุดทางเข้า–ออก` : 'แยกตามจุดทางเข้า–ออก'
      }
      actions={
        <SegmentedControl
          label="มุมมอง Heatmap"
          size="sm"
          value={mode}
          onChange={setMode}
          options={modes}
        />
      }
    >
      {!hourly && q.isError && q.data && (
        <StaleBanner className="mb-3" onRetry={() => q.refetch()} />
      )}
      {!model && !error ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-64" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : !model ? (
        <ErrorState
          error={error}
          onRetry={() => {
            q.refetch();
            sites.refetch();
          }}
          retrying={q.isFetching}
          compact
        />
      ) : model.max === 0 ? (
        <EmptyState icon={CarFront} title="ยังไม่มีรถผ่านในช่วงนี้" compact />
      ) : (
        <Heatmap
          model={model}
          unit={days > 1 ? 'คัน/ชม. (เฉลี่ย)' : 'คัน'}
          label="Heatmap ปริมาณรถรายชั่วโมง"
        />
      )}
    </Panel>
  );
}
