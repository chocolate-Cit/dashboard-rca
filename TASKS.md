# Tasks

> ✅ ทำเครื่องหมาย `[x]` เมื่อเสร็จ · ลำดับหัวข้อคือลำดับที่แนะนำให้ทำ

## 1. ตั้งค่าโปรเจกต์ (Foundation)

- [x] 1.1 สร้าง monorepo (pnpm workspaces + Turborepo)
  - [x] สร้าง `apps/executive`, `apps/service` ด้วย Next.js (App Router, TypeScript)
  - [x] สร้าง `packages/ui`, `packages/api`, `packages/config`
  - [x] ตั้ง script `dev`, `build`, `lint`, `typecheck`, `test`, `e2e` ที่ root
- [x] 1.2 คุณภาพโค้ด
  - [x] ESLint + Prettier + tsconfig ร่วมกัน
  - [x] Vitest + Testing Library
  - [x] Playwright
  - [ ] Husky/lint-staged (ไม่บังคับ — ข้ามไว้ก่อน ใช้ CI ตรวจแทน)
- [x] 1.3 Environment
  - [x] `.env.example` (`API_MODE`, `API_BASE_URL`, `POLL_INTERVAL_MS`)
  - [x] สลับ mock/live ด้วย env

## 2. Design System (`packages/ui`)

- [x] 2.1 ติดตั้ง Tailwind preset + shadcn/ui
- [x] 2.2 Design tokens โทนเข้ม (Executive) และสว่าง (Service)
- [x] 2.3 ฟอนต์ IBM Plex Sans Thai + ตัวเลข tabular
- [x] 2.4 Component พื้นฐาน
  - [x] Button, Input, Select, Dialog, Toast, Tabs
  - [x] StatCard (ค่า + % เปลี่ยนแปลง)
  - [x] StatusBadge / PriorityBadge
  - [x] DataTable (เรียง, แบ่งหน้า, เป็นการ์ดบนมือถือ)
  - [x] DateRangePicker (Preset + เลือกเอง, ภาษาไทย)
  - [x] PhotoUploader / PhotoGallery
  - [x] Skeleton, EmptyState, ErrorState
- [x] 2.5 Chart wrappers (Recharts): AreaChart, BarChart แนวนอน, Heatmap
- [x] 2.6 Helper รูปแบบไทย: เงินบาท, วันที่, เวลา, ระยะเวลา SLA

## 3. API Layer + Mock (`packages/api`)

- [x] 3.1 `client.ts` (base URL, cookie, จัดการ error/401)
- [x] 3.2 zod schema + type
  - [x] User, Site, Equipment
  - [x] Incident, IncidentLog, ProblemType
  - [x] Inspection, ChecklistTemplate
  - [x] ParkingHourly, DashboardSummary, KPI, SlaSetting
- [x] 3.3 Endpoints + TanStack Query hooks (มี polling)
- [x] 3.4 Mock (MSW)
  - [x] seed data 90 วัน, 6 จุด, ~40 อุปกรณ์, ~60 งาน
  - [x] mock db ในหน่วยความจำ (เพิ่ม/แก้ได้ระหว่างใช้งาน)
  - [x] handlers ครบทุก endpoint ใน DESIGN.md
  - [x] จำลอง delay และ error เพื่อทดสอบ
  - [x] จำลอง log จาก LIFF (`source: liff`)
- [x] 3.5 Unit test ของ schema และ helper คำนวณ

## 4. Authentication (ทั้งสองเว็บ)

- [x] 4.1 หน้า `/login` (รหัสพนักงาน + รหัสผ่าน, validate, ข้อความผิดพลาด)
- [x] 4.2 Route handler login/logout → httpOnly cookie
- [x] 4.3 `middleware.ts` redirect ถ้าไม่มี session
- [x] 4.4 ตรวจ role ต่อเว็บ (Executive: executive / Service: admin, operator)
- [x] 4.5 กันหน้า `/admin/*` เฉพาะ admin
- [x] 4.6 จัดการ session หมดอายุ (401 → กลับ login)
- [x] 4.7 บัญชีทดสอบใน mock

## 5. เว็บ Executive (`apps/executive`)

- [x] 5.1 Layout โทนเข้ม: header, ตัวเลือกช่วงเวลา, เวลาอัปเดตล่าสุด, ปุ่มออก
- [x] 5.2 ตัวเลือกช่วงเวลา (state ใน URL query เพื่อแชร์ลิงก์ได้)
- [x] 5.3 KPI การ์ด: รายได้, เทียบช่วงก่อน, รถเข้า, รถออก
- [x] 5.4 กราฟแนวโน้มรายได้
- [x] 5.5 ช่องทางชำระเงิน
- [x] 5.6 Heatmap ปริมาณรถ
  - [x] helper คำนวณ (แยกจุด/ชั่วโมง/ระดับสี) + unit test
  - [x] สลับมุมมอง เข้า+ออก / เข้า / ออก
  - [x] tooltip + legend + เลื่อนแนวนอนบนมือถือ
- [x] 5.7 สถานะอุปกรณ์แยกจุด
- [x] 5.8 รายการปัญหาล่าสุด (อ่านอย่างเดียว)
- [x] 5.9 Responsive + loading/empty/error ครบ

## 6. เว็บ Service (`apps/service`)

- [x] 6.1 Layout โทนสว่าง: sidebar (desktop) / drawer (มือถือ), เมนูตาม role
- [x] 6.2 งานแจ้งซ่อม — รายการ `/incidents`
  - [x] ตารางพร้อมคอลัมน์ SLA เหลือ
  - [x] ค้นหา + กรอง (สถานะ, ความเร่งด่วน, จุด, ผู้รับผิดชอบ, ช่วงวัน)
  - [x] ไฮไลต์ใกล้/เกิน SLA
  - [x] มุมมองการ์ดบนมือถือ
- [x] 6.3 งานแจ้งซ่อม — เปิดงาน `/incidents/new`
  - [x] ฟอร์มขั้นตอน จุด → อุปกรณ์ → ปัญหา → รายละเอียด + รูป
  - [x] สร้างเลข `INC-xxxx` และตั้งอุปกรณ์เป็นขัดข้อง
- [x] 6.4 งานแจ้งซ่อม — รายละเอียด `/incidents/[id]`
  - [x] ข้อมูลงาน + รูปก่อน/หลัง
  - [x] มอบหมายช่าง
  - [x] เปลี่ยนสถานะ / ความเร่งด่วน
  - [x] Timeline log (web + LIFF) + เพิ่ม log
  - [x] ปิดงาน (บังคับสาเหตุ + รูปหลังซ่อม) → อุปกรณ์ปกติ
- [x] 6.5 ตรวจเช็กประจำวัน
  - [x] สรุปรายวัน: ตรวจแล้ว/ยังไม่ตรวจ/ข้อไม่ผ่าน
  - [x] รายละเอียดผลรายข้อ + รูป
  - [x] ปุ่มสร้างงานซ่อมจากข้อไม่ผ่าน
- [x] 6.6 KPI / SLA
  - [x] ตาราง KPI รายช่าง
  - [x] ภาพรวม SLA ตามช่วงเวลาและความเร่งด่วน
- [x] 6.7 หลังบ้าน Admin
  - [x] ผู้ใช้ & สิทธิ์ (เพิ่ม/แก้/ปิดใช้งาน/รีเซ็ตรหัสผ่าน, role, เป็นช่าง)
  - [x] จุดติดตั้ง & อุปกรณ์
  - [x] เทมเพลตตรวจเช็ก
  - [x] ประเภทปัญหา
  - [x] ตั้งค่า SLA
- [x] 6.8 Loading/empty/error + ยืนยันก่อนลบ/ปิดใช้งาน

## 7. ทดสอบและคุณภาพ

- [x] 7.1 Unit test: heatmap, SLA, % เปลี่ยนแปลง, format ไทย
- [x] 7.2 Component test: StatCard, Heatmap, IncidentForm, DateRangePicker
- [x] 7.3 E2E
  - [x] login ทุก role + กันสิทธิ์ข้ามเว็บ
  - [x] Executive เปลี่ยนช่วงเวลา
  - [x] เปิดงาน → มอบหมาย → ปิดงาน
  - [x] admin สร้างผู้ใช้
- [x] 7.4 ตรวจ Accessibility (contrast, keyboard) ทั้งสองโทน
- [x] 7.5 ทดสอบบนมือถือ/tablet

## 8. เชื่อม Backend CIT (เมื่อ API พร้อม)

- [ ] 8.1 รับ API spec จาก CIT แล้วเทียบกับ schema ของ mock
- [ ] 8.2 ปรับ schema/endpoint ใน `packages/api` (ไม่แตะ UI)
- [ ] 8.3 ปรับ auth ให้ตรงกับระบบของ CIT
- [ ] 8.4 ยืนยันกับทีม LIFF: รายชื่อช่าง, สถานะงาน, log ใช้ข้อมูลชุดเดียวกัน
- [ ] 8.5 ทดสอบ `API_MODE=live` ครบทุกหน้า

## 9. เตรียม Deploy (ภายหลัง)

- [ ] 9.1 เลือกที่ deploy และโดเมนของสองเว็บ
- [ ] 9.2 Dockerfile / config ตามที่เลือก
- [x] 9.3 CI: lint + typecheck + test + build (+ e2e) — `.github/workflows/ci.yml`

## ประเด็นที่ต้องตามต่อ

- [ ] ค่า SLA ของแต่ละระดับความเร่งด่วน (CIT)
- [x] รูปแบบวันที่: ใช้ ค.ศ.
- [ ] API contract จริงจาก CIT
