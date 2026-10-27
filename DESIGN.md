# DESIGN — Go Inno Parking Dashboard

## 1. สถาปัตยกรรม

```text
┌────────────────────┐   ┌────────────────────┐
│ apps/executive     │   │ apps/service       │
│ Next.js (โทนเข้ม)  │   │ Next.js (โทนสว่าง) │
└─────────┬──────────┘   └─────────┬──────────┘
          │ ใช้ร่วมกัน                  │
   ┌──────▼─────────────────────────────▼──────┐
   │ packages/ui   packages/api   packages/config │
   └──────────────────────┬──────────────────────┘
                          │ HTTP (REST)
            ┌─────────────▼─────────────┐
            │ mock (MSW)  │ Backend CIT  │  ← สลับด้วย NEXT_PUBLIC_API_MODE
            └───────────────────────────┘
                          ▲
                LINE LIFF ของช่าง (อีกทีม) ใช้ backend เดียวกัน
```

- สองเว็บ deploy แยก คนละโดเมน, login แยกกัน
- UI ไม่เรียก `fetch` ตรง เรียกผ่านฟังก์ชันใน `packages/api` เท่านั้น
- mock อยู่ระดับ HTTP (MSW) ทำให้โค้ดเดียวกันใช้ได้ทั้ง mock และของจริง

## 2. โครง repo

```text
apps/executive/
├─ app/
│  ├─ login/page.tsx
│  ├─ (protected)/layout.tsx        ตรวจ session + role=executive
│  └─ (protected)/dashboard/page.tsx
├─ app/api/auth/[...]/route.ts      proxy login → ตั้ง httpOnly cookie
└─ middleware.ts                    redirect ถ้ายังไม่ login

apps/service/
├─ app/
│  ├─ login/page.tsx
│  └─ (protected)/
│     ├─ layout.tsx                 sidebar + ตรวจ role=admin|operator
│     ├─ incidents/page.tsx, incidents/new/page.tsx, incidents/[id]/page.tsx
│     ├─ inspections/page.tsx, inspections/[id]/page.tsx
│     ├─ kpi/page.tsx
│     └─ admin/(users|sites|checklists|problems|sla)/page.tsx   เฉพาะ admin
└─ middleware.ts

packages/api/
├─ src/client.ts          fetch wrapper (base URL, cookie, error)
├─ src/schemas/*.ts       zod schema + type
├─ src/endpoints/*.ts     ฟังก์ชันเรียก API แยกตามโดเมน
├─ src/hooks/*.ts         TanStack Query hooks (useRevenue, useIncidents …)
└─ src/mocks/             MSW handlers + seed data + mock db ในหน่วยความจำ

packages/ui/
├─ src/components/        shadcn/ui + StatCard, DateRangePicker, Heatmap, StatusBadge, PhotoUploader, DataTable
├─ src/charts/            wrapper ของ Recharts
└─ src/theme/             tokens โทนเข้ม/สว่าง
```

## 3. ข้อมูลและ API (mock)

endpoint ร่าง เพื่อให้ mock ใช้ จะปรับเมื่อได้ API จริงของ CIT

| Method | Path | ใช้ใน |
| --- | --- | --- |
| POST | `/auth/login` · `/auth/logout` · GET `/auth/me` | ทั้งสอง |
| GET | `/dashboard/summary?from&to` | Executive: KPI การ์ด |
| GET | `/dashboard/revenue-trend?from&to` | Executive: กราฟแนวโน้ม |
| GET | `/dashboard/payment-channels?from&to` | Executive |
| GET | `/dashboard/traffic-heatmap?date&mode=all\|in\|out` | Executive |
| GET | `/equipment/status` | Executive |
| GET/POST | `/incidents` · GET/PATCH `/incidents/:id` | Service (+ Executive อ่าน) |
| POST | `/incidents/:id/logs` · `/incidents/:id/photos` | Service |
| GET | `/inspections?date` · `/inspections/:id` | Service |
| GET | `/kpi/technicians?from&to` · `/kpi/sla?from&to` | Service |
| CRUD | `/users` · `/sites` · `/equipment` · `/checklist-templates` · `/problem-types` · `/sla-settings` | Service Admin |

ข้อมูลหลัก (ชนิดข้อมูลใน `packages/api/src/schemas`)

| Entity | ฟิลด์สำคัญ |
| --- | --- |
| `User` | id, employeeCode, name, role, isTechnician, active |
| `Site` | id, code, name, direction (`in`/`out`) |
| `Equipment` | id, siteId, type, name, status (`normal`/`down`) |
| `Incident` | id, code (`INC-0001`), siteId, equipmentId, problemTypeId, priority, status, assigneeId, cause, parts, photosBefore, photosAfter, openedAt, respondedAt, resolvedAt, slaDueAt |
| `IncidentLog` | id, incidentId, authorId, message, source (`web`/`liff`), createdAt |
| `Inspection` | id, siteId, equipmentId, inspectorId, date, results[] (itemId, pass, note, photo) |
| `ParkingHourly` | siteId, hour, carsIn, carsOut, revenue, byChannel |

กติกาการดึงข้อมูล
- TanStack Query `refetchInterval` = `NEXT_PUBLIC_POLL_INTERVAL_MS` (30 วินาที) และหยุดดึงเมื่อแท็บไม่ได้เปิดอยู่
- หลังแก้ข้อมูล (mutation) ให้ invalidate query ที่เกี่ยวข้อง
- ข้อมูล mock seed 90 วันย้อนหลัง, 6 จุดทางเข้า–ออก, ~40 อุปกรณ์, ~60 งานซ่อม

## 4. Auth

1. ผู้ใช้กรอกรหัสพนักงาน + รหัสผ่านที่ `/login`
2. Route handler ของ Next.js ส่งต่อไป `/auth/login` แล้วเก็บ token เป็น httpOnly cookie
3. `middleware.ts` ตรวจ cookie ทุก request ถ้าไม่มีให้ redirect ไป `/login`
4. Layout ตรวจ role: Executive รับเฉพาะ `executive`, Service รับ `admin`/`operator`, หน้า `/admin/*` รับเฉพาะ `admin`
5. role ไม่ตรงให้ logout และแสดง "บัญชีนี้ไม่มีสิทธิ์เข้าเว็บนี้"

## 5. ดีไซน์ UI

### 5.1 หลักการ
- ผู้บริหาร: อ่านตัวเลขเร็ว ตัวเลขใหญ่ ข้อความน้อย ไม่มีปุ่มแก้ไข
- เจ้าหน้าที่: ทำงานเร็ว ใช้ตารางหนาแน่นบนจอใหญ่ เป็นการ์ดบนมือถือ ปุ่มหลักชัดเจน
- สถานะใช้สีพร้อมข้อความหรือไอคอนเสมอ ไม่สื่อด้วยสีอย่างเดียว

### 5.2 Design tokens

| Token | Executive (เข้ม) | Service (สว่าง) |
| --- | --- | --- |
| `--bg` | `#0B1220` | `#F7F8FA` |
| `--surface` | `#121A2B` | `#FFFFFF` |
| `--border` | `#1F2A40` | `#E3E6EB` |
| `--text` | `#E6EAF2` | `#111827` |
| `--text-muted` | `#8A94A8` | `#5F6672` (เดิม `#6B7280` ปรับให้ผ่าน AA บนพื้นเทาอ่อน) |
| `--primary` | `#4F8CFF` | `#2563EB` |
| `--success` | `#22C55E` | `#16A34A` |
| `--warning` | `#F59E0B` | `#D97706` |
| `--danger` | `#EF4444` | `#DC2626` |

- ฟอนต์: **IBM Plex Sans Thai** (ข้อความ), ตัวเลขใช้ `font-variant-numeric: tabular-nums`
- ระยะห่าง: สเกล 4px (4, 8, 12, 16, 24, 32), มุมโค้ง 8px (การ์ด 12px)
- Breakpoints: `sm 640`, `md 768`, `lg 1024`, `xl 1280`

### 5.3 สีของสถานะ

| ค่า | ป้าย | สี |
| --- | --- | --- |
| อุปกรณ์ปกติ / ปิดงาน | ● ปกติ / ✓ ปิดงาน | success |
| เปิด / มอบหมายแล้ว | เปิด / มอบหมายแล้ว | primary |
| กำลังดำเนินการ / รออะไหล่ | ⏳ | warning |
| ขัดข้อง / เกิน SLA / วิกฤต | ⚠ | danger |

### 5.4 Layout

**Executive `/dashboard`** (desktop)
```text
┌ โลโก้ ─────────────── [วันนี้|7 วัน|30 วัน|เดือนนี้|📅] อัปเดต 10:32 [ออก] ┐
│ [รายได้] [เทียบช่วงก่อน] [รถเข้า] [รถออก]                                   │
│ [แนวโน้มรายได้ 30 วัน (line/area) ──────────] [ช่องทางชำระ (donut/bar)]       │
│ [Heatmap รายชั่วโมง × จุดทางเข้า–ออก  (เข้า+ออก|เข้า|ออก) ───────────────]     │
│ [สถานะอุปกรณ์ แยกจุด]                       [ปัญหาล่าสุด (5–10 รายการ)]        │
└──────────────────────────────────────────────────────────────────────────────┘
```
มือถือ: เรียงทุกส่วนเป็นคอลัมน์เดียว ส่วน Heatmap เลื่อนแนวนอนได้เฉพาะในกล่องของตัวเอง

**Service** — sidebar ซ้าย (มือถือเป็น bottom nav/drawer): งานแจ้งซ่อม · ตรวจเช็ก · KPI · หลังบ้าน
- `/incidents`: แถบตัวกรอง + DataTable (เลขงาน, จุด/อุปกรณ์, ปัญหา, ความเร่งด่วน, สถานะ, ผู้รับผิดชอบ, SLA เหลือ) บนมือถือเป็นการ์ด
- `/incidents/[id]`: ซ้ายเป็นรายละเอียดกับ timeline log ขวาเป็นแผงการกระทำ (มอบหมาย, สถานะ, ความเร่งด่วน, ปิดงาน)

### 5.5 กราฟ
- แนวโน้มรายได้: area chart สีเดียว (`--primary`) แกน Y เป็นบาท
- ช่องทางชำระ: horizontal bar เรียงจากมากไปน้อย (อ่านง่ายกว่า pie) พร้อม %
- Heatmap: สเกลสีเดียวแบบ sequential 5 ระดับ, hover แสดงค่าจริง, มีคำอธิบายสี (legend)
- ทุกกราฟมี tooltip และมีข้อความสรุปสำหรับ screen reader

### 5.6 สถานะหน้าจอ
- Loading: skeleton ตามรูปทรงของ component
- ว่าง: ข้อความกับคำแนะนำ เช่น "ไม่มีงานค้าง 🎉"
- Error: ข้อความกับปุ่ม "ลองใหม่" และเก็บข้อมูลเดิมไว้ถ้ามี

## 6. การทดสอบ
- Unit: helper คำนวณ (heatmap, SLA, % เปลี่ยนแปลง), schema
- Component: StatCard, Heatmap, IncidentForm (Testing Library + MSW)
- E2E (Playwright): login ทุก role, กันสิทธิ์ข้ามเว็บ, flow เปิดงาน → มอบหมาย → ปิดงาน
