import { CloudOff } from 'lucide-react';

/** backend ไม่ตอบระหว่างตรวจ session */
export function Unavailable() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-danger-soft text-danger-fg">
          <CloudOff className="size-6" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold">เชื่อมต่อระบบไม่ได้</h1>
        <p className="text-sm text-muted">
          เซิร์ฟเวอร์ไม่ตอบสนองในขณะนี้ กรุณาลองใหม่อีกครั้ง หากยังไม่ได้ให้แจ้งทีม CIT
        </p>
        <a
          href=""
          className="mt-2 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover"
        >
          ลองใหม่
        </a>
      </div>
    </main>
  );
}
