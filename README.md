# Go Inno Parking — Dashboard (RCA)

ระบบเว็บ Dashboard ของลานจอดรถ ประกอบด้วย **เว็บผู้บริหาร (Executive)** ใช้ภาษาไทยทั้งหมด

| เว็บ | ผู้ใช้ | ใช้ทำอะไร | โทน |
| --- | --- | --- | --- |
| **Executive** (`apps/executive`) | ผู้บริหาร (`executive`) | ดูรายได้, ช่องทางชำระเงิน, แนวโน้ม, Heatmap ปริมาณรถ, สถานะอุปกรณ์/ปัญหาล่าสุด | เข้ม |

> ใช้กับไซต์ลานจอดนี้ที่เดียว ช่างหน้างานใช้ **LINE LIFF** ที่อีกทีมพัฒนา ไม่อยู่ในโปรเจกต์นี้ (รวมถึงการแจ้งเตือนช่าง)

## เอกสาร

| ไฟล์ | เนื้อหา |
| --- | --- |
| [PRD.md](PRD.md) | ความต้องการของระบบ ขอบเขต และฟีเจอร์ |
| [DESIGN.md](DESIGN.md) | สถาปัตยกรรม, โครง repo, ดีไซน์ UI, ข้อมูล/mock |
| [USER_FLOW.md](USER_FLOW.md) | User Story และ User Flow |
| [TASKS.md](TASKS.md) | รายการงานที่ต้องทำ (checklist) |
| [docs/service-web.md](docs/service-web.md) | สเปกเว็บ Service (ส่งต่อให้ Dev อีกทีมพัฒนา โค้ดไม่อยู่ใน repo นี้แล้ว) |

## เทคโนโลยี

| ส่วน | เทคโนโลยี |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript |
| Monorepo | pnpm workspaces + Turborepo |
| Styling | Tailwind CSS + shadcn/ui |
| Data fetching | TanStack Query (polling ทุก 30–60 วินาที) |
| กราฟ | Recharts |
| ฟอร์ม | react-hook-form + zod |
| Mock API | MSW (Mock Service Worker) |
| ทดสอบ | Vitest + Testing Library, Playwright (E2E) |

## โครงสร้าง

```text
Web_Dashboard_RCA/
├─ apps/
│  └─ executive/     เว็บผู้บริหาร (Next.js)
├─ packages/
│  ├─ ui/            component, theme, กราฟ ที่ใช้ร่วมกัน
│  ├─ api/           ตัวเรียก API + ชนิดข้อมูล (zod schema) + MSW handlers/mock data
│  └─ config/        eslint, tsconfig, tailwind preset
└─ docs (ไฟล์ .md ที่ root)
```

## เริ่มต้นใช้งาน (local)

ต้องมี Node.js 20+ และ pnpm 9

```sh
pnpm install
cp .env.example apps/executive/.env.local

pnpm dev                       # รัน mock backend (:4000) + เว็บผู้บริหาร
# หรือแยกทีละตัว
pnpm mock                      # mock backend ที่ http://localhost:4000
pnpm --filter executive dev    # http://localhost:3000
```

ตัวแปร environment (`.env.local` ในแต่ละแอป)

| ตัวแปร | ค่า | ความหมาย |
| --- | --- | --- |
| `API_MODE` | `mock` / `live` | `mock` ใช้ mock server, `live` ต่อ backend CIT (ฝั่ง server เท่านั้น) |
| `API_BASE_URL` | URL | ที่อยู่ backend (mock = `http://localhost:4000`, live = URL ของ CIT) |
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | `30000` | ช่วงเวลาดึงข้อมูลใหม่ (ms) |

### การเชื่อมต่อ API และ mock

```text
Browser ──fetch──▶ /api/proxy/*  (route handler ของ Next.js แนบ token จาก httpOnly cookie)
                      │
                      ▼
               API_BASE_URL ──▶ mock server (MSW handlers) หรือ backend CIT
```

- UI เรียกผ่าน hook ใน `packages/api` เท่านั้น ไม่เห็น token และไม่รู้ว่าปลายทางเป็น mock หรือของจริง
- mock ใช้ **MSW handlers ชุดเดียว** ทั้งใน mock server (`pnpm mock`) และใน unit test
  เลือกรัน handler เป็น server แยกแทน service worker ในเบราว์เซอร์ เพราะ login ต้องผ่าน route handler ฝั่ง server (เพื่อตั้ง httpOnly cookie)
  และให้ทุกหน้าเห็นข้อมูลชุดเดียวกัน
- ตัวเลือกของ mock server
  - `MOCK_DELAY_MS=800 pnpm mock`: จำลองเครือข่ายช้า (ค่าเริ่มต้น 250–500 ms)
  - `MOCK_ERROR_RATE=0.2 pnpm mock`: ให้คำขอ GET ล้มเหลว 20% เพื่อดูสถานะ error/ลองใหม่
  - `MOCK_LIFF_INTERVAL_MS=0 pnpm mock`: ปิดการจำลองช่างอัปเดตจาก LINE LIFF (ค่าเริ่มต้นทุก 90 วินาที)
- ข้อมูล mock สร้างใหม่ทุกครั้งที่เปิด server และหายเมื่อปิด ตัวเลขทั้งหมดเป็นข้อมูลจำลอง

บัญชีทดสอบในโหมด mock

| รหัสพนักงาน | รหัสผ่าน | role | เข้าเว็บ |
| --- | --- | --- | --- |
| `EXEC01` | `password123` | executive | Executive |
| `ADMIN` | `password123` | admin | Executive (สิทธิ์สูงสุด) |
| `OP01` | `password123` | operator | Service |
| `TECH01`–`TECH05` | `password123` | operator (ช่าง) | Service |

## คำสั่งที่ใช้บ่อย

```sh
pnpm build      # build ทุกแอป
pnpm test       # unit + component test (Vitest)
pnpm e2e        # Playwright (เปิด mock + ทั้งสองเว็บให้เอง ถ้ายังไม่ได้เปิด)
pnpm lint
pnpm typecheck
```

## สถานะ

- ทำครบหมวด 1–7 ของ [TASKS.md](TASKS.md) และ CI แล้ว (`.github/workflows/ci.yml`)
- Backend ของ CIT ยังไม่พร้อม ตอนนี้ใช้ **mock** ทั้งหมด เมื่อได้ API จริงให้ปรับ schema/endpoint ใน `packages/api` แล้วตั้ง `API_MODE=live` และ `API_BASE_URL`
- ค่า SLA ปัจจุบันเป็นค่าชั่วคราว (วิกฤต 4 ชม., สูง 8 ชม., ปานกลาง 1 วัน, ต่ำ 3 วัน) รอค่าจริงจาก CIT
- การ deploy ยังไม่กำหนด (รัน local)
