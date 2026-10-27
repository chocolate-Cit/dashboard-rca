import { getSession } from '@gip/api/server';
import { SessionProvider } from '@gip/ui';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { app } from '@/lib/app';
import { Unavailable } from '@/lib/unavailable';

/** ตรวจ token กับ backend ทุกครั้งที่เข้าหน้า และกันบัญชีที่ role ไม่ใช่ executive */
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getSession((await headers()).get('cookie'), app);
  switch (session.status) {
    case 'ok':
      return <SessionProvider user={session.user}>{children}</SessionProvider>;
    case 'none':
      return redirect('/login');
    case 'expired':
      return redirect(`/api/auth/logout?next=${encodeURIComponent('/login?reason=expired')}`);
    case 'forbidden':
      return redirect(`/api/auth/logout?next=${encodeURIComponent('/login?reason=forbidden')}`);
    default:
      return <Unavailable />;
  }
}
