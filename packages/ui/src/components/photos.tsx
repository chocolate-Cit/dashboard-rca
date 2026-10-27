'use client';

import { ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { Button } from './button';
import { Dialog, DialogContent } from './dialog';

const MAX_EDGE = 1600;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_BYTES = 15 * 1024 * 1024;

/** ย่อรูปฝั่ง browser ก่อนส่ง (รูปจากมือถือมักใหญ่หลาย MB) */
export async function resizeImage(file: File, maxEdge = MAX_EDGE, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}

type UploaderProps = {
  value: string[];
  onChange: (photos: string[]) => void;
  max?: number;
  label?: string;
  error?: string;
  disabled?: boolean;
};

/** แนบรูป: เลือกหลายรูป / ถ่ายจากกล้องมือถือ, ย่อขนาดอัตโนมัติ, ลบได้ */
export function PhotoUploader({
  value,
  onChange,
  max = 6,
  label = 'แนบรูป',
  error,
  disabled,
}: UploaderProps) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const remaining = max - value.length;

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setProblem(null);
    const list = [...files].slice(0, remaining);
    const rejected = list.filter((f) => !ACCEPT.includes(f.type) || f.size > MAX_BYTES);
    if (rejected.length)
      setProblem('รองรับเฉพาะไฟล์รูป JPG, PNG, WEBP หรือ HEIC ขนาดไม่เกิน 15 MB');
    setBusy(true);
    try {
      const ok = await Promise.all(
        list.filter((f) => !rejected.includes(f)).map((f) => resizeImage(f).catch(() => null)),
      );
      const good = ok.filter((x): x is string => !!x);
      if (good.length < list.length - rejected.length)
        setProblem('บางรูปเปิดไม่ได้ ลองเลือกรูปอื่น');
      onChange([...value, ...good]);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
    if (files.length > remaining) setProblem(`แนบได้สูงสุด ${max} รูป`);
  }

  const message = error ?? problem;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((src, i) => (
          <div
            key={i}
            className="group relative aspect-square overflow-hidden rounded-md border border-border bg-surface-2"
          >
            <img src={src} alt={`รูปที่ ${i + 1}`} className="size-full object-cover" />
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label={`ลบรูปที่ ${i + 1}`}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
        {remaining > 0 && !disabled && (
          <label
            htmlFor={id}
            className={cn(
              'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border-strong text-center text-xs text-muted transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-fg',
              busy && 'pointer-events-none opacity-60',
              message && 'border-danger',
            )}
          >
            <ImagePlus className="size-5" aria-hidden />
            <span>{busy ? 'กำลังเตรียมรูป…' : label}</span>
            <span className="num">
              {value.length}/{max}
            </span>
          </label>
        )}
      </div>
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => onFiles(e.target.files)}
      />
      {message && (
        <p className="text-sm text-danger-fg" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

/** แกลเลอรีรูป: กดเพื่อดูเต็มจอ เลื่อนดูด้วยปุ่มหรือคีย์ลูกศร */
export function PhotoGallery({
  photos,
  label,
  className,
}: {
  photos: string[];
  label: string;
  className?: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  if (!photos.length) return <p className="text-sm text-muted">ไม่มีรูป</p>;
  const go = (d: number) =>
    setIndex((i) => (i === null ? i : (i + d + photos.length) % photos.length));

  return (
    <>
      <ul className={cn('grid grid-cols-3 gap-2 sm:grid-cols-4', className)}>
        {photos.map((src, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="block aspect-square w-full overflow-hidden rounded-md border border-border bg-surface-2 transition-opacity hover:opacity-90"
              aria-label={`ดู${label} รูปที่ ${i + 1} จาก ${photos.length}`}
            >
              <img src={src} alt="" className="size-full object-cover" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={index !== null} onOpenChange={(o) => !o && setIndex(null)}>
        {index !== null && (
          <DialogContent title={`${label} (${index + 1}/${photos.length})`} size="lg">
            <div
              className="relative"
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') go(1);
                if (e.key === 'ArrowLeft') go(-1);
              }}
            >
              <img
                src={photos[index]}
                alt={`${label} รูปที่ ${index + 1}`}
                className="max-h-[65dvh] w-full rounded-md object-contain"
              />
              {photos.length > 1 && (
                <div className="mt-3 flex justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="รูปก่อนหน้า"
                    onClick={() => go(-1)}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="รูปถัดไป"
                    onClick={() => go(1)}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
