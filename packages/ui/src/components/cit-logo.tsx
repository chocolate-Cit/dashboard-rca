import { cn } from '../lib/cn';

/**
 * โลโก้ CIT (ไฟล์อยู่ใน public/brand ของแต่ละเว็บ)
 * - tone="light": ตัวอักษรน้ำเงิน สำหรับพื้นสว่าง
 * - tone="dark": ตัวอักษรขาว สำหรับพื้นเข้ม/กรมท่า
 * - mark: เฉพาะสัญลักษณ์ลูกโลก (ที่แคบ)
 */
export function CitLogo({
  tone = 'dark',
  mark,
  className,
}: {
  tone?: 'light' | 'dark';
  mark?: boolean;
  className?: string;
}) {
  if (mark) {
    return (
      <img
        src="/brand/cit-mark.png"
        alt="CIT"
        width={256}
        height={256}
        className={cn('h-8 w-auto', className)}
      />
    );
  }
  return (
    <img
      src={tone === 'dark' ? '/brand/cit-logo-white.png' : '/brand/cit-logo.png'}
      alt="CIT"
      width={661}
      height={128}
      className={cn('h-6 w-auto', className)}
    />
  );
}
