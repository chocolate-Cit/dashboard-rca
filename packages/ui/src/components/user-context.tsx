'use client';

import { configureClient, type User } from '@gip/api';
import { createContext, useContext, useEffect, type ReactNode } from 'react';

const Ctx = createContext<User | null>(null);

let loggingOut = false;
/** เรียกก่อนไปหน้า logout: คำขอ polling ที่ได้ 401 ระหว่างนั้นจะไม่พาไปหน้า "เซสชันหมดอายุ" */
export function markLoggingOut() {
  loggingOut = true;
}

/**
 * ผู้ใช้ที่ login อยู่ (ตรวจแล้วฝั่ง server ใน protected layout)
 * และตั้งให้ API client ส่งกลับหน้า login เมื่อ session หมดอายุ (401)
 */
export function SessionProvider({ user, children }: { user: User; children: ReactNode }) {
  useEffect(() => {
    // กำลังออกจากหน้า (กด logout / เปลี่ยนหน้า) ไม่ต้องพาไปหน้า "เซสชันหมดอายุ"
    window.addEventListener('beforeunload', markLoggingOut);
    window.addEventListener('pagehide', markLoggingOut);
    configureClient({
      onUnauthorized: () => {
        if (loggingOut) return;
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(
          `/api/auth/logout?next=${encodeURIComponent(`/login?reason=expired&next=${next}`)}`,
        );
      },
    });
    return () => {
      window.removeEventListener('beforeunload', markLoggingOut);
      window.removeEventListener('pagehide', markLoggingOut);
    };
  }, []);
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>;
}

export function useUser(): User {
  const user = useContext(Ctx);
  if (!user) throw new Error('useUser ต้องอยู่ใน <SessionProvider>');
  return user;
}
