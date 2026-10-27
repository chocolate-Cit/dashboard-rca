'use client';

import { formatTime } from '@gip/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/** เวลาอัปเดตล่าสุด = query ของ dashboard ที่ได้ข้อมูลล่าสุด, จุดกะพริบขณะกำลังดึงใหม่ */
export function LastUpdated({ fetching }: { fetching: boolean }) {
  const qc = useQueryClient();
  const [updatedAt, setUpdatedAt] = useState<number>(0);

  useEffect(() => {
    const read = () => {
      const times = qc
        .getQueryCache()
        .findAll()
        .map((q) => q.state.dataUpdatedAt);
      setUpdatedAt(Math.max(0, ...times));
    };
    read();
    return qc.getQueryCache().subscribe(read);
  }, [qc]);

  return (
    <p className="flex items-center gap-2 text-xs whitespace-nowrap text-muted" aria-live="polite">
      <span className="relative flex size-2" aria-hidden>
        {fetching && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
        )}
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      {fetching && !updatedAt ? (
        'กำลังโหลด…'
      ) : updatedAt ? (
        <>
          อัปเดต{' '}
          <time className="num" dateTime={new Date(updatedAt).toISOString()}>
            {formatTime(new Date(updatedAt))}
          </time>
        </>
      ) : (
        '—'
      )}
    </p>
  );
}
