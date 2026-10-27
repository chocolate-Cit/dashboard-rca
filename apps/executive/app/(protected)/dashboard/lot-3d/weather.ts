'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * สภาพอากาศจริงของโครงการ จาก Open-Meteo (ฟรี ไม่ต้องใช้ key)
 * ส่งไปเฉพาะพิกัดของโครงการ (ย่านพระราม 9 / เพชรบุรี) ไม่มีข้อมูลผู้ใช้
 */
const LAT = 13.748;
const LON = 100.565;
const URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,is_day,precipitation,cloud_cover&timezone=Asia%2FBangkok`;

export type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm';
export type Weather = {
  temp: number;
  isDay: boolean;
  kind: WeatherKind;
  label: string;
  cloud: number;
};

/** รหัสอากาศ WMO → ประเภทและคำอธิบายภาษาไทย */
function describe(code: number): { kind: WeatherKind; label: string } {
  if (code === 0) return { kind: 'clear', label: 'ท้องฟ้าแจ่มใส' };
  if (code <= 2) return { kind: 'clear', label: 'มีเมฆบางส่วน' };
  if (code === 3) return { kind: 'cloudy', label: 'เมฆมาก' };
  if (code === 45 || code === 48) return { kind: 'fog', label: 'หมอก' };
  if (code >= 51 && code <= 57) return { kind: 'rain', label: 'ฝนตก' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { kind: 'rain', label: 'ฝนตก' };
  if (code >= 95) return { kind: 'storm', label: 'ฝนตก' };
  return { kind: 'cloudy', label: 'เมฆมาก' };
}

export function useWeather() {
  return useQuery({
    queryKey: ['weather', LAT, LON],
    queryFn: async (): Promise<Weather> => {
      const res = await fetch(URL);
      if (!res.ok) throw new Error('ดึงข้อมูลสภาพอากาศไม่สำเร็จ');
      const d = (await res.json()) as {
        current: {
          temperature_2m: number;
          weather_code: number;
          is_day: number;
          cloud_cover: number;
        };
      };
      return {
        temp: Math.round(d.current.temperature_2m),
        isDay: d.current.is_day === 1,
        cloud: d.current.cloud_cover / 100,
        ...describe(d.current.weather_code),
      };
    },
    refetchInterval: 10 * 60_000,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** โหมดแสดงผล: auto = ตามเวลากลางวัน/กลางคืนจริง, ที่เหลือใช้สาธิต */
export type SkyMode = 'auto' | 'day' | 'night';

/** ค่าที่ฉาก 3D ใช้ */
export type SceneEnv = { night: boolean };

/** ภาพ 3D แสดงแค่กลางวัน/กลางคืน (ฝนตกแสดงเป็นข้อความบนป้ายอากาศเท่านั้น) */
export function resolveEnv(mode: SkyMode, w: Weather | undefined): SceneEnv {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date()),
  );
  const night =
    mode === 'day' ? false : mode === 'night' ? true : w ? !w.isDay : hour < 6 || hour >= 18;
  return { night };
}
