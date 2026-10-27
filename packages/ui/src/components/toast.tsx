'use client';

import * as T from '@radix-ui/react-toast';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  tone: 'success' | 'error' | 'info';
};
type ToastInput = Omit<ToastItem, 'id' | 'tone'> & { tone?: ToastItem['tone'] };

const Ctx = createContext<((t: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: ToastInput) => {
    setItems((xs) => [
      ...xs.slice(-2),
      { ...t, tone: t.tone ?? 'success', id: Date.now() + Math.random() },
    ]);
  }, []);

  return (
    <Ctx.Provider value={push}>
      <T.Provider swipeDirection="right" duration={4500}>
        {children}
        {items.map((t) => (
          <T.Root
            key={t.id}
            type={t.tone === 'error' ? 'foreground' : 'background'}
            onOpenChange={(open) => !open && setItems((xs) => xs.filter((x) => x.id !== t.id))}
            className={cn(
              'flex items-start gap-3 rounded-lg border border-border bg-surface p-3 pr-2 text-text shadow-pop animate-pop-in',
              'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[state=closed]:opacity-0 data-[state=closed]:transition-opacity',
            )}
          >
            {t.tone === 'error' ? (
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
            ) : (
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <T.Title className="text-sm font-medium">{t.title}</T.Title>
              {t.description && (
                <T.Description className="text-sm text-muted">{t.description}</T.Description>
              )}
            </div>
            <T.Close
              className="rounded p-1 text-muted hover:bg-surface-hover hover:text-text"
              aria-label="ปิด"
            >
              <X className="size-4" />
            </T.Close>
          </T.Root>
        ))}
        <T.Viewport className="fixed right-0 bottom-0 z-[60] flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
      </T.Provider>
    </Ctx.Provider>
  );
}

export function useToast() {
  const push = useContext(Ctx);
  if (!push) throw new Error('useToast ต้องอยู่ใน <ToastProvider>');
  return push;
}
