# API ที่ Dashboard ผู้บริหารรอ: ยอดเงิน และ ยอดรถ

เอกสารนี้บอกว่าหน้า Dashboard ต้องการข้อมูลอะไรจาก Backend เพื่อเลิกใช้ข้อมูลจำลอง ส่วนสถานะ Hardware ต่อ API จริงแล้ว (ดู `apps/executive/app/api/hw/route.ts`)

## วิธีต่อ

ตั้งค่าใน `apps/executive/.env.local`

```
API_MODE=live
API_BASE_URL=https://<backend>
```

หน้าเว็บเรียกผ่าน `/api/proxy/...` ของเว็บเอง แล้ว server ส่งต่อไปที่ `API_BASE_URL` พร้อม token ของผู้ใช้ใน header `Authorization: Bearer <token>` ทุก response ถูกตรวจรูปแบบด้วย zod (`packages/api/src/schemas/dashboard.ts`) ถ้า field ขาดหรือชนิดผิด หน้าเว็บจะขึ้นข้อความผิดพลาดแทนการแสดงตัวเลขผิด

ถ้า Backend มีรูปแบบ response ต่างจากนี้ ให้เขียนตัวแปลงฝั่ง server แบบเดียวกับ `app/api/hw/route.ts` แทนการแก้หน้าเว็บ

## ข้อตกลงร่วม

- ทุก endpoint รับ query `from` และ `to` เป็นวันที่ `YYYY-MM-DD` ตามเวลาไทย (Asia/Bangkok) รวมวันปลายทาง
- จำนวนรถเป็นจำนวนเต็ม เงินเป็นบาท (ทศนิยมได้)
- `siteId` ต้องตรงกับ id ของช่องทางใน `/sites` (เช่น ช่องทาง `CP1-IN1`)
- หน้าเว็บดึงข้อมูลใหม่ทุก 6 วินาที (`NEXT_PUBLIC_POLL_INTERVAL_MS`) ฝั่ง Backend ควร cache ได้

## 1. สรุปตัวเลขหลัก

`GET /dashboard/summary?from&to` ใช้กับการ์ด รายได้ / รถเข้า / รถออก / รถคงค้างในลาน และตัวเลขบนภาพ 3D

```json
{
  "revenue": 80425,
  "previousRevenue": 88050.5,
  "carsIn": 2468,
  "carsOut": 1394,
  "carsInside": 1574,
  "previousFrom": "2026-10-22",
  "previousTo": "2026-10-22"
}
```

| field | ความหมาย |
|---|---|
| `revenue` | รายได้ในช่วง `from`–`to` |
| `previousRevenue` | รายได้ช่วงก่อนหน้าที่ยาวเท่ากัน **ถึงเวลาเดียวกัน** (ถ้าช่วงรวมวันนี้ ให้นับเมื่อวานถึงเวลาเดียวกับตอนนี้) ใช้คำนวณ % เทียบ |
| `previousFrom`, `previousTo` | วันของช่วงก่อนหน้า |
| `carsIn`, `carsOut` | รถเข้า/ออกในช่วง **รีเซ็ตเป็น 0 ตอนเที่ยงคืน** |
| `carsInside` | รถคงค้างในลาน **ตอนนี้** สะสมข้ามวัน ไม่รีเซ็ตตอนเที่ยงคืน (= ค้างจากเมื่อวาน + เข้าวันนี้ − ออกวันนี้) |

## 2. แนวโน้มรายได้รายวัน

`GET /dashboard/revenue-trend?from&to` (หน้าเว็บส่ง 30 วันล่าสุด ไม่รวมวันนี้)

```json
[{ "date": "2026-10-21", "revenue": 152300 }]
```

ต้องมีครบทุกวันในช่วง วันที่ไม่มีรายได้ส่ง `0`

## 3. ยอดรับเงินแยกจุดรับเงิน

`GET /dashboard/revenue-points?from&to` ชำระผ่าน QR พร้อมเพย์อย่างเดียว

```json
{
  "channel": "qr",
  "exits": [
    { "siteId": "…", "code": "CP1-OUT1", "name": "ป้อมจตุรทิศ ทางออก 1", "group": "จุดที่ 1 ป้อมจตุรทิศ", "amount": 11280, "count": 210 }
  ],
  "kiosks": [{ "id": "…", "name": "Kiosk 1", "amount": 5400, "count": 98 }]
}
```

`exits` ครบทุกช่องทางออก, `kiosks` ครบทุกตู้ Kiosk Payment (3 ตู้)

## 4. ปริมาณรถรายชั่วโมง

`GET /dashboard/traffic-heatmap?from&to` ใช้กับ Heatmap และอัตรารถ/ชม. บนภาพ 3D

```json
{
  "days": 1,
  "cells": [{ "siteId": "…", "hour": 9, "carsIn": 53, "carsOut": 0 }]
}
```

- `days` = จำนวนวันในช่วง
- `cells` = ผลรวมต่อช่องทางต่อชั่วโมง (0–23) ทางเข้าใส่ `carsIn` ทางออกใส่ `carsOut`

## ส่วนที่ใช้ข้อมูลจริงแล้ว

| ส่วน | แหล่งข้อมูล |
|---|---|
| สถานะอุปกรณ์, สีบนภาพ 3D, กรวย | API Hardware (`CIT_HW_URL`, `CIT_HW_KEY`) |
| ปุ่มทดสอบยก/ปิดไม้กั้น CP4-IN1 | ตู้ควบคุม CIT (`CIT_BARRIER_*`) |
| สภาพอากาศ | Open-Meteo |
