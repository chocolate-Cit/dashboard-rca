'use client';

import { loginInputSchema } from '@gip/api';
import { Eye, EyeOff, LockKeyhole, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Button } from './button';
import { CitLogo } from './cit-logo';
import { Field, Input } from './form';

const reasons: Record<string, { tone: 'warning' | 'danger'; text: string }> = {
  expired: { tone: 'warning', text: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง' },
  forbidden: { tone: 'danger', text: 'บัญชีนี้ไม่มีสิทธิ์เข้าเว็บนี้' },
  logout: { tone: 'warning', text: 'ออกจากระบบแล้ว' },
};

type Props = {
  appName: string;
  tagline: string;
  /** หน้าแรกหลัง login */
  home: string;
  reason?: string | null;
  next?: string | null;
  aside?: ReactNode;
  /** แผงแบรนด์ด้านซ้าย (จอกว้าง lg ขึ้นไป) ถ้าไม่ส่งจะเป็นฟอร์มกลางจอแบบเดิม */
  panel?: ReactNode;
  /** สีโลโก้ CIT บนฟอร์ม: light = พื้นสว่าง (Service), dark = พื้นเข้ม (Executive) */
  logoTone?: 'light' | 'dark';
};

/** หน้า Login ร่วม: รหัสพนักงาน + รหัสผ่าน, validate ฝั่ง client, ข้อความผิดพลาดจาก server */
export function LoginScreen({
  appName,
  tagline,
  home,
  reason,
  next,
  aside,
  panel,
  logoTone = 'light',
}: Props) {
  const [values, setValues] = useState({ employeeCode: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<'employeeCode' | 'password', string>>>({});
  const [formError, setFormError] = useState<string | null>(
    reason ? (reasons[reason]?.text ?? null) : null,
  );
  const [formTone, setFormTone] = useState<'warning' | 'danger'>(
    reason ? (reasons[reason]?.tone ?? 'danger') : 'danger',
  );
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = loginInputSchema.safeParse(values);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors({ employeeCode: fe.employeeCode?.[0], password: fe.password?.[0] });
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) {
        const target = next && next.startsWith('/') && !next.startsWith('//') ? next : home;
        window.location.assign(target);
        return;
      }
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setFormTone('danger');
      setFormError(body?.message ?? 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
      if (res.status === 401) setValues((v) => ({ ...v, password: '' }));
    } catch {
      setFormTone('danger');
      setFormError('เชื่อมต่อเครือข่ายไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    }
    setBusy(false);
  }

  const form = (
    <div className="w-full max-w-[400px]">
      <div className="login-rise mb-8" style={{ animationDelay: '220ms' }}>
        <div className={cn('flex items-center gap-2.5', panel && 'lg:hidden')}>
          <CitLogo tone={logoTone} className="h-7" />
          <span className="h-6 w-px bg-border" aria-hidden />
          <p className="text-lg font-semibold tracking-tight text-text">
            Go Inno <span className="text-primary">Parking</span>
          </p>
        </div>
        <h1
          className={cn(
            'mt-6 text-2xl font-semibold tracking-tight',
            panel && 'lg:mt-0 lg:text-3xl',
          )}
        >
          {appName}
        </h1>
        <p className="mt-1 text-sm text-muted">{tagline}</p>
      </div>

      <form
        onSubmit={submit}
        noValidate
        className={cn(
          'login-stagger flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6',
          panel && 'lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none',
        )}
      >
        {formError && (
          <div
            role="alert"
            className={cn(
              'flex items-start gap-2 rounded-md px-3 py-2.5 text-sm',
              formTone === 'danger'
                ? 'bg-danger-soft text-danger-fg'
                : 'bg-warning-soft text-warning-fg',
            )}
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{formError}</span>
          </div>
        )}
        <Field label="รหัสพนักงาน" error={errors.employeeCode}>
          <Input
            name="employeeCode"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
            value={values.employeeCode}
            onChange={(e) => setValues((v) => ({ ...v, employeeCode: e.target.value }))}
            placeholder="เช่น ADMIN"
            className="h-11 uppercase placeholder:normal-case"
          />
        </Field>
        <Field label="รหัสผ่าน" error={errors.password} htmlFor="login-password">
          <div className="relative">
            <Input
              id="login-password"
              name="password"
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={values.password}
              onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
              aria-invalid={errors.password ? true : undefined}
              className="h-11 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded text-muted hover:text-text"
              aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">
          {!busy && <LockKeyhole aria-hidden />}
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </Button>
        <p className="text-center text-xs text-muted">
          ลืมรหัสผ่าน? ติดต่อผู้ดูแลระบบ CIT เพื่อรีเซ็ต
        </p>
      </form>
      {aside}
    </div>
  );

  if (!panel) return <main className="grid min-h-dvh place-items-center px-4 py-10">{form}</main>;
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="login-fade hidden lg:block">{panel}</div>
      <div className="grid place-items-center px-4 py-10 sm:px-8">{form}</div>
    </main>
  );
}
