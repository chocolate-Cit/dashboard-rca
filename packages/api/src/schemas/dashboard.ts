import { z } from 'zod';
import { isoDate } from './common';

export const paymentChannels = ['cash', 'credit', 'ewallet', 'qr'] as const;
export const paymentChannelSchema = z.enum(paymentChannels);
export type PaymentChannel = z.infer<typeof paymentChannelSchema>;

export const parkingHourlySchema = z.object({
  date: isoDate,
  siteId: z.string(),
  hour: z.number().int().min(0).max(23),
  carsIn: z.number().int(),
  carsOut: z.number().int(),
  revenue: z.number(),
  byChannel: z.record(paymentChannelSchema, z.number()),
});
export type ParkingHourly = z.infer<typeof parkingHourlySchema>;

export const dashboardSummarySchema = z.object({
  revenue: z.number(),
  previousRevenue: z.number(),
  carsIn: z.number().int(),
  carsOut: z.number().int(),
  /**
   * รถคงค้างในลานตอนนี้ (สะสมข้ามวัน) · รถเข้า/ออกรีเซ็ตเป็น 0 ตอนเที่ยงคืน แต่ค่านี้ไม่รีเซ็ต
   * = รถที่ค้างจากเมื่อวาน + รถเข้าวันนี้ − รถออกวันนี้
   */
  carsInside: z.number().int(),
  previousFrom: isoDate,
  previousTo: isoDate,
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const revenueTrendSchema = z.array(z.object({ date: isoDate, revenue: z.number() }));
export type RevenueTrend = z.infer<typeof revenueTrendSchema>;

/** ยอดรับเงินแยกตามจุดรับเงิน (ชำระผ่าน QR พร้อมเพย์อย่างเดียว) */
export const revenuePointsSchema = z.object({
  channel: z.literal('qr'),
  exits: z.array(
    z.object({
      siteId: z.string(),
      code: z.string(),
      name: z.string(),
      group: z.string().nullable(),
      amount: z.number(),
      count: z.number().int(),
    }),
  ),
  kiosks: z.array(
    z.object({ id: z.string(), name: z.string(), amount: z.number(), count: z.number().int() }),
  ),
});
export type RevenuePoints = z.infer<typeof revenuePointsSchema>;

export const trafficCellSchema = z.object({
  siteId: z.string(),
  hour: z.number().int().min(0).max(23),
  carsIn: z.number().int(),
  carsOut: z.number().int(),
});
export type TrafficCell = z.infer<typeof trafficCellSchema>;
export const trafficHeatmapSchema = z.object({
  days: z.number().int(),
  cells: z.array(trafficCellSchema),
});
export type TrafficHeatmap = z.infer<typeof trafficHeatmapSchema>;
