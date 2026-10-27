# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

ตามที่กำหนดใน README.md: Next.js (App Router) + TypeScript, pnpm workspaces + Turborepo, Tailwind CSS + shadcn/ui, TanStack Query, Recharts, react-hook-form + zod, MSW, Vitest + Testing Library, Playwright

## Users

- **ผู้บริหาร (`executive`)**: เปิด Executive Dashboard บนจอใหญ่ทิ้งไว้ หรือดูบน tablet/มือถือ อยากรู้รายได้และสถานการณ์ของลานภายในไม่กี่วินาที โดยไม่ต้องขอรายงาน
- **เจ้าหน้าที่ CIT (`operator`, `admin`)**: ใช้ Service Console ทั้งวันบน desktop และหน้างานบนมือถือ เพื่อเปิด มอบหมาย ติดตาม และปิดงานแจ้งซ่อมให้ทัน SLA ส่วน `admin` ดูแลข้อมูลหลังบ้านด้วย

## Product Purpose

ระบบ Dashboard ของลานจอดรถ Go Inno Parking (ไซต์เดียว) แยกเป็น 2 เว็บ เพื่อรวมรายได้ ปริมาณรถ และงานซ่อมบำรุงไว้ในที่เดียว
- ถือว่าสำเร็จเมื่อผู้บริหารใช้ Dashboard แทนรายงานรายวัน
- งานแจ้งซ่อมทุกงานมีผู้รับผิดชอบและสถานะที่ถูกต้อง
- สลับไปใช้ API จริงของ CIT ได้โดยแก้เฉพาะ `packages/api`

## Operating Context

- ช่างหน้างานใช้ LINE LIFF ซึ่งอีกทีมพัฒนา และใช้ backend เดียวกัน log จาก LIFF จึงต้องแสดงใน timeline ของงาน
- Backend ของ CIT ยังไม่พร้อม ตอนนี้ใช้ mock (MSW) ทั้งหมด
- ข้อมูลอัปเดตด้วย polling ทุก 30–60 วินาที

## Capabilities and Constraints

ดูรายละเอียดใน PRD.md, DESIGN.md, USER_FLOW.md และ TASKS.md
- ใช้ภาษาไทยทั้งหมด วันที่แบบ ค.ศ. (`15 ต.ค. 2026`) และเงินบาท (`฿1,234`)
- login แยกกันในแต่ละเว็บ เก็บ token ใน httpOnly cookie ห้ามใช้ localStorage
- ยังไม่ได้ตัดสินใจ: ค่า SLA แต่ละระดับ, API contract จริง, ที่ deploy

## Brand Commitments

- ชื่อ Go Inno Parking แสดงเป็นตัวอักษร เพราะยังไม่มีไฟล์โลโก้
- Design tokens, ฟอนต์ IBM Plex Sans Thai และโทน Executive เข้ม / Service สว่าง ถูกกำหนดไว้ใน DESIGN.md §5

## Evidence on Hand

ข้อมูลทั้งหมดเป็น mock seed ห้ามนำเสนอว่าเป็นตัวเลขจริง

## Product Principles

1. ผู้บริหารต้องอ่านตัวเลขสำคัญได้ในพริบตา โดยไม่มีปุ่มแก้ไขรบกวน
2. เจ้าหน้าที่ต้องเห็นงานที่ใกล้หรือเกิน SLA ก่อนเสมอ
3. สถานะต้องสื่อด้วยข้อความหรือไอคอนควบคู่กับสี ไม่ใช้สีอย่างเดียว
4. UI ไม่ผูกกับ backend โดยตรง เรียกผ่าน `packages/api` เท่านั้น

## Accessibility & Inclusion

ต้องผ่าน contrast ระดับ WCAG AA ทั้งโทนเข้มและสว่าง และใช้งานด้วยคีย์บอร์ดได้
