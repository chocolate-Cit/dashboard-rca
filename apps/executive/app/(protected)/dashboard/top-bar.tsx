'use client';

import { buttonVariants, CitLogo, cn, markLoggingOut, useUser } from '@gip/ui';
import { useIsFetching } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { LastUpdated } from './last-updated';

export function TopBar({ children }: { children?: ReactNode }) {
  const user = useUser();
  const fetching = useIsFetching() > 0;
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <CitLogo tone="dark" className="h-6 shrink-0 sm:h-7" />
        <span className="h-7 w-px shrink-0 bg-border" aria-hidden />
        <div className="mr-auto min-w-0">
          <p className="truncate text-[15px] leading-tight font-semibold tracking-tight">
            Go Inno <span className="text-primary">Parking</span>
          </p>
          <p className="hidden truncate text-xs text-muted sm:block">ภาพรวมลานจอด</p>
        </div>
        <div className="hidden xl:block">
          <LastUpdated fetching={fetching} />
        </div>
        {children}
        <div className="hidden h-6 w-px bg-border sm:block" />
        <span className="hidden max-w-40 truncate text-sm text-muted lg:inline" title={user.name}>
          {user.name}
        </span>
        <a
          href={`/api/auth/logout?next=${encodeURIComponent('/login?reason=logout')}`}
          onClick={markLoggingOut}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'px-2 sm:px-3')}
        >
          <LogOut aria-hidden />
          <span className="hidden sm:inline">ออก</span>
          <span className="sr-only sm:hidden">ออกจากระบบ</span>
        </a>
      </div>
    </header>
  );
}
