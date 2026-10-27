# Go Inno Parking — Service Console: สเปกหน้าเว็บสำหรับพัฒนาต่อ

เอกสารนี้อธิบายเว็บ **Service Console** (`apps/service`) ตามที่ทำงานอยู่ตอนนี้ทุกหน้า เพื่อให้ทีมพัฒนาสร้างต่อหรือสร้างใหม่ได้ **หน้าตาและพฤติกรรมเหมือนเดิมทุกอย่าง**

- ข้อความบนหน้าจอทุกคำคัดมาจากโค้ดตรงตัว (อยู่ในเครื่องหมายคำพูด) ห้ามแก้คำ
- class ของ Tailwind ที่ระบุไว้คือค่าที่ทำให้หน้าตาเป็นแบบนี้ ถ้าใช้ framework อื่นให้แปลงตามค่าเดียวกัน
- โค้ดต้นฉบับอยู่ใน repo นี้ อ้างชื่อไฟล์ไว้ทุกหัวข้อ ถ้าเอกสารกับโค้ดขัดกัน **ให้ยึดโค้ด**
- ข้อมูลตอนนี้มาจาก mock server (`packages/api/src/mocks`) กฎฝั่ง server ที่เขียนไว้ (เช่น การเปลี่ยนสถานะอุปกรณ์เมื่อเปิด/ปิดงาน) คือพฤติกรรมของ mock ที่ backend จริงต้องทำให้เหมือนกัน

## สารบัญ
1. ส่วนที่ 1 · โครงหน้า, Login, Theme, Component กลาง, Auth และข้อมูล
2. ส่วนที่ 2 · งานแจ้งซ่อม (Incidents)
3. ส่วนที่ 3 · ตรวจเช็กประจำวัน, KPI / SLA และหลังบ้าน


---

## ส่วนที่ 1 · โครงหน้า, Login, Theme, Component กลาง, Auth และข้อมูล


> เอกสารนี้อธิบาย `apps/service` (Go Inno Parking · Service Console) ให้สร้างใหม่ได้ตรงทุกพิกเซล ข้อความ/label/identifier คัดลอกตามโค้ดจริงทุกตัวอักษร

---

### 1. Tech stack, โครงสร้าง, วิธีรัน

#### 1.1 เวอร์ชัน
| ส่วน | แพ็กเกจ | เวอร์ชัน |
|---|---|---|
| Monorepo | pnpm / turbo / typescript / prettier / playwright | 9.15.0 / 2.3.3 / 5.7.2 / 3.4.2 / 1.49.1 |
| Framework | next (App Router, `--turbopack`) | 15.1.3 |
| React | react / react-dom | 19.0.0 |
| Styling | tailwindcss + @tailwindcss/postcss | 4.1.11 |
| Data | @tanstack/react-query | 5.62.11 |
| Validation | zod (ใน @gip/api) | 3.24.1 |
| Icons | lucide-react | 0.469.0 |
| UI primitives (@gip/ui) | @radix-ui/react-dialog 1.1.4, react-popover 1.1.4, react-tabs 1.1.2, react-toast 1.2.4, react-tooltip 1.1.6, class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 2.6.0, date-fns 4.1.0, react-day-picker 9.4.4, recharts 2.15.0 | |
| Mock | msw 2.7.0, `tsx src/mocks/server.ts` (พอร์ต 4000) | |
| Test | vitest 2.1.8, @testing-library/react 16.1.0, jsdom 25.0.1 | |
| Font | `IBM_Plex_Sans_Thai` จาก `next/font/google` (subsets thai+latin, weight 400/500/600, variable `--font-plex-thai`, display swap) | |

#### 1.2 โครงสร้าง
```
/ (go-inno-parking-dashboard)
├─ apps/
│  ├─ executive/            (เว็บผู้บริหาร พอร์ต 3000 – ไม่อยู่ใน spec นี้)
│  └─ service/              (พอร์ต 3001, admin-only)
│     ├─ middleware.ts
│     ├─ next.config.ts     transpilePackages ['@gip/api','@gip/ui'], poweredByHeader:false
│     ├─ public/brand/      cit-logo.png, cit-logo-white.png, cit-mark.png
│     ├─ lib/               app.ts, shell.tsx, lookups.ts, use-now.ts, unavailable.tsx
│     └─ app/
│        ├─ layout.tsx, page.tsx(redirect HOME), providers.tsx, globals.css, icon.png, apple-icon.png
│        ├─ login/page.tsx
│        ├─ api/auth/login/route.ts (POST), api/auth/logout/route.ts (GET,POST), api/proxy/[...path]/route.ts
│        └─ (protected)/ layout.tsx, loading.tsx, template.tsx
│           ├─ incidents/ (page, incident-list, new/page, [id]/page, action-panel, timeline)
│           ├─ inspections/ (page, [id]/page)
│           ├─ kpi/ (page, sla-charts)
│           └─ admin/ (layout, page, users, sites, checklists, problems, sla)
└─ packages/
   ├─ api/   (@gip/api) schemas/, labels.ts, checkpoints.ts, client.ts, endpoints/, hooks/, calc/, server.ts, mocks/
   ├─ ui/    (@gip/ui)  components/, lib/(cn, format), theme/(base.css, service.css, executive.css), charts/
   └─ config/
```
Exports ที่ใช้: `@gip/api` (schemas, labels, checkpoints, client), `@gip/api/hooks`, `@gip/api/calc`, `@gip/api/server`, `@gip/ui`.

#### 1.3 วิธีรัน
1. คัดลอก `.env.example` → `apps/service/.env.local`
   ```
   API_MODE=mock            # mock | live
   API_BASE_URL=http://localhost:4000
   NEXT_PUBLIC_POLL_INTERVAL_MS=30000
   ```
   (`API_MODE=live` ต้องตั้ง `API_BASE_URL` ไม่งั้น throw `API_MODE=live ต้องตั้ง API_BASE_URL`)
2. `pnpm install` → `pnpm mock` (mock backend :4000) → `pnpm dev` (turbo; service = `next dev --turbopack -p 3001`)
3. สคริปต์ service: `dev`, `build`, `start -p 3001`, `lint` (eslint app lib components middleware.ts), `typecheck`, `test` (vitest)

`app/globals.css`:
```css
@import 'tailwindcss';
@import '@gip/ui/theme/base.css';
@import '@gip/ui/theme/service.css';
@source '../';
@source '../../../packages/ui/src';
```

#### 1.4 Root layout / metadata
- `<html lang="th" className={plex.variable}>` → `<body><Providers>…`
- metadata.title: default `Service Console · Go Inno Parking`, template `%s · Service Console`
- description: `ระบบจัดการงานซ่อมบำรุงของเจ้าหน้าที่ CIT`; robots index:false follow:false
- viewport: `themeColor: '#ffffff'`, `colorScheme: 'light'`
- `/` → `redirect('/incidents')` (HOME)

#### 1.5 Providers
- `QueryClient` defaultOptions.queries: `staleTime: 15_000`, `refetchOnWindowFocus: true`, `retry`: ไม่ retry ถ้า `ApiError` status 400–499, อย่างอื่น retry สูงสุด 2 ครั้ง (`count < 2`)
- ห่อด้วย `<ToastProvider>`

---

### 2. Design tokens

#### 2.1 ตัวแปร CSS (service.css, `:root`, โทนสว่างเท่านั้น)
| ตัวแปร | ค่า | Tailwind utility |
|---|---|---|
| `--scheme` | `light` | (color-scheme ของ html) |
| `--bg` | `#f7f8fa` | `bg-bg` |
| `--surface` | `#ffffff` | `bg-surface` |
| `--surface-2` | `#f1f3f6` | `bg-surface-2` |
| `--surface-hover` | `#f3f5f8` | `bg-surface-hover` |
| `--border` | `#e3e6eb` | `border-border` |
| `--border-strong` | `#cdd2da` | `border-border-strong` |
| `--text` | `#111827` | `text-text` |
| `--text-muted` | `#5f6672` | `text-muted` |
| `--primary` | `#2563eb` | `bg-primary` |
| `--primary-hover` | `#1d4ed8` | `bg-primary-hover` |
| `--primary-soft` | `#eaf1fe` | `bg-primary-soft` |
| `--primary-fg` | `#1d4ed8` | `text-primary-fg` |
| `--on-primary` | `#ffffff` | `text-on-primary` |
| `--success` / `-soft` / `-fg` | `#16a34a` / `#e8f6ee` / `#15703a` | `success`, `success-soft`, `success-fg` |
| `--warning` / `-soft` / `-fg` | `#d97706` / `#fdf3e2` / `#8f4a05` | |
| `--danger` / `-soft` / `-fg` | `#dc2626` / `#fdecec` / `#b31d1d` | |
| `--neutral-soft` | `#eef0f3` | `bg-neutral-soft` |
| `--heat-0..4` | `#eef3fd`, `#c9daf9`, `#8fb2f3`, `#4f84ec`, `#1d4ed8` | `bg-heat-0..4` |
| `--sidebar` | `#0f1b33` (กรมท่า) | `bg-sidebar` |
| `--sidebar-hover` | `rgb(255 255 255 / 0.06)` | `bg-sidebar-hover` |
| `--sidebar-text` | `#d5dceb` | `text-sidebar-text` |
| `--sidebar-muted` | `#8b98b3` | `text-sidebar-muted` |
| `--sidebar-border` | `rgb(255 255 255 / 0.08)` | `border-sidebar-border` |
| `--prio-low-bg` / `--prio-low-fg` | `#dcf5e6` / `#136c37` | `bg-prio-low-bg` / `text-prio-low-fg` |
| `--prio-medium-bg` / `--prio-medium-fg` | `#fdf0b8` / `#7a5200` | |
| `--prio-high` | `#c2410c` | `bg-prio-high` |
| `--prio-critical` | `#dc2626` | `bg-prio-critical` |
| `--focus` | `#2563eb` | outline focus |
| `--selection` | `#c9daf9` | ::selection |
| `--shadow-color` | `rgb(17 24 39 / 0.1)` | |

#### 2.2 ค่าจาก base.css (`@theme inline`)
| Token | ค่า |
|---|---|
| `--font-sans` | `var(--font-plex-thai), 'IBM Plex Sans Thai', 'Noto Sans Thai', system-ui, sans-serif` |
| `--radius-sm/md/lg` | `6px` / `8px` / `12px` (`rounded-sm/md/lg`) |
| `--shadow-pop` | `0 12px 32px -8px var(--shadow-color), 0 2px 6px -2px var(--shadow-color)` |
| `--shadow-card` | `0 1px 2px 0 var(--shadow-color)` |
| breakpoints | sm 640, md 768, lg 1024, xl 1280 |

Base layer: body `background:var(--bg)`, `color:var(--text)`, `line-height:1.6`, antialiased; `.num, table, time` → `font-variant-numeric: tabular-nums`; `:focus-visible` outline 2px `--focus` offset 2px radius 4px; caret สี primary; `a` underline-offset 3px; scrollbar thin สี `--border-strong` (webkit 10px, thumb radius 999 border 3px transparent); `prefers-reduced-motion` → animation/transition 0.01ms

#### 2.3 Animations / keyframes
| ชื่อ (utility/class) | keyframes | ระยะ/easing | ผล |
|---|---|---|---|
| `animate-fade-in` | `fade-in` from opacity 0 | 160ms cubic-bezier(0.16,1,0.3,1) | overlay ของ dialog/drawer |
| `animate-pop-in` | `pop-in` from opacity0 translateY(4px) scale(.98) | 180ms | dialog, popover, toast |
| `animate-slide-in` | `slide-in` from translateX(-100%) | 220ms | mobile drawer |
| `animate-page-in` | `page-in` from opacity0 translateY(6px) | 260ms | template.tsx ทุกครั้งเปลี่ยนหน้า |
| `skeleton` (utility) | `shimmer` to background-position -200% 0 | 1.4s linear infinite | gradient 90deg surface-2 25% / surface-hover 50% / surface-2 75%, size 200% 100%, radius-sm |
| `.nav-progress` | `nav-progress` scaleX(0)→scaleX(0.92), origin left | 8s cubic-bezier(0.1,0.8,0.2,1) forwards | แถบโหลดบนสุดตอนกดเมนู |
| `.login-panel` | — | — | `linear-gradient(160deg,#0f1d3a 0%,#0b1530 55%,#08101f 100%)` |
| `.login-grid` | — | — | ตารางเส้น `rgb(255 255 255/0.035)` 1px ทุก 44px, mask radial ellipse at 30% 40% #000 20% → transparent 75% |
| `.login-glow` + `-a`/`-b` | `login-drift` to translate(5rem,-3rem) scale(1.15) | a: 26rem วงกลม left -6rem top 18% `rgb(37 99 235/.35)` 18s ease-in-out infinite alternate; b: 20rem right -5rem bottom 6% `rgb(14 165 233/.22)` 22s alternate-reverse | blur 70px, z -1 |
| `.login-rise` | `login-rise` from opacity0 translateY(14px) blur(4px) | 700ms cubic-bezier(0.16,1,0.3,1) both | |
| `.login-fade` | `login-fade` from opacity 0 | 900ms ease-out | แผงซ้าย |
| `.login-stagger > *` | login-rise | delay `320ms + i*80ms` (i=0..4 ตาม nth-child) | ช่องในฟอร์ม |
| `.login-pulse` | from opacity .9 scale(.9) → opacity0 scale(2.4) | 2.8s infinite | วงกะพริบป้อม |
| `.reveal` / `.reveal-stagger > *` | `reveal` from opacity0 translateY(18px) blur(6px) | 760ms, delay `var(--d)` (+ i*90ms) | ใช้ในหน้าอื่น |
| `.heat-in` | from opacity0 scale(.6) | 520ms | heatmap |

---

### 3. Shell layout (`lib/shell.tsx`)

#### 3.1 โครงรวม
```
<div class="min-h-dvh lg:pl-60">
  <aside fixed inset-y-0 left-0 z-30 hidden w-60 (240px) flex-col bg-sidebar lg:flex>
     Brand(dark) ใน div h-20 px-4 · NavLinks · UserBox
  <header sticky top-0 z-30 h-14 flex items-center gap-2 border-b border-border bg-surface/95 px-2 backdrop-blur lg:hidden>
     [ปุ่มเมนู] Brand(light) MobileBreached
  <main class="mx-auto max-w-[1280px] px-4 pt-5 pb-16 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
```
หน้าใน `(protected)` ห่อด้วย `template.tsx` → `<div class="animate-page-in">`.

#### 3.2 Brand
- **dark** (sidebar/drawer): Link `/incidents`, `flex flex-col gap-1.5 leading-tight` → `CitLogo tone="dark"` h-6 self-start; บรรทัดล่าง `text-xs text-sidebar-muted`: **`Go Inno Parking`** (font-semibold text-white) + ` · Service Console`
- **light** (mobile header): Link `/incidents`, `flex items-center gap-2.5` → `CitLogo tone="light"` h-5 · เส้นคั่น `h-6 w-px bg-border` · `Go Inno Parking` (text-sm font-semibold tracking-tight nowrap)

#### 3.3 เมนู (NavLinks) — `<nav aria-label="เมนูหลัก" class="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">`
เมนูหลัก (`ul flex-col gap-0.5`) ตามลำดับ:
| # | href | label | icon (lucide) | badge |
|---|---|---|---|---|
| 1 | `/incidents` | งานแจ้งซ่อม | `Wrench` | `<BreachedCount/>` |
| 2 | `/inspections` | ตรวจเช็กประจำวัน | `ClipboardCheck` | — |
| 3 | `/kpi` | KPI / SLA | `Gauge` | — |

กลุ่ม admin (แสดงเมื่อ `user.role === 'admin'`): หัวข้อ `p mb-1.5 flex items-center gap-1.5 px-2.5 text-xs font-medium text-sidebar-muted` = ไอคอน `BookCheck` size-3.5 + **`หลังบ้าน (Admin)`**
| # | href | label | icon |
|---|---|---|---|
| 1 | `/admin/users` | ผู้ใช้ & สิทธิ์ | `Users` |
| 2 | `/admin/sites` | จุดติดตั้ง & อุปกรณ์ | `MapPin` |
| 3 | `/admin/checklists` | รายการตรวจเช็ค | `ListChecks` |
| 4 | `/admin/problems` | ประเภทปัญหา | `Tags` |
| 5 | `/admin/sla` | ตั้งค่า SLA | `Timer` |

ลิงก์แต่ละอัน: `flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors`; icon size-4; label `truncate`.
- active: `bg-primary font-medium text-white shadow-[0_4px_12px_-4px_rgb(37_99_235/0.6)]`
- ปกติ: `text-sidebar-text hover:bg-sidebar-hover hover:text-white`
- `here` = `pathname === href || pathname.startsWith(href + '/')`; `aria-current="page"` เมื่อ here
- `prefetch` เปิด

**Pending nav**: คลิกลิงก์ที่ไม่ใช่หน้าปัจจุบัน (และไม่กด meta/ctrl/shift) → `pending = href`; ระหว่าง pending ไฮไลต์ active ย้ายไปที่ลิงก์ที่กดทันที, แสดง `Loader2` `ml-auto size-3.5 animate-spin` aria-label `กำลังเปิดหน้า`, และแถบ `span.nav-progress fixed inset-x-0 top-0 z-50 h-0.5 bg-primary`; reset เมื่อ pathname เปลี่ยน. ใน drawer เรียก `onNavigate` เพื่อปิด drawer.
**Dev warmup**: เฉพาะ `NODE_ENV==='development'` หลัง 1500ms fetch ทุก href ในเมนูตามลำดับ (ให้ compile ล่วงหน้า).
**loading.tsx** (Suspense ระหว่างโหลด): `role="status" aria-label="กำลังโหลดหน้า"` → Skeleton h-8 w-56, Skeleton h-4 w-80 max-w-full (ใน `mb-6 flex-col gap-2`), แล้ว Skeleton h-96 w-full

#### 3.4 SLA breach badge
- query: `useIncidents({ status: activeStatuses })` (ใช้ key เดียวกับหน้ารายการ) แล้วนับ `slaState(i, new Date()) === 'breached'`; n=0 → ไม่แสดง
- Sidebar (`BreachedCount`): `span.num ml-auto rounded-full bg-danger px-1.5 py-px text-[11px] font-semibold text-white`, title `เกิน SLA {n} งาน`, เนื้อหา `{n}` + sr-only ` งานเกิน SLA`
- Mobile header (`MobileBreached`): Link `/incidents` `mr-1 ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-medium nowrap text-danger-fg` → `TriangleAlert` size-3.5 + `เกิน SLA {n}`

#### 3.5 Mobile drawer (Radix Dialog)
- Trigger: `grid size-10 place-items-center rounded-md text-text hover:bg-surface-hover`, aria-label `เปิดเมนู`, icon `Menu` size-5
- Overlay: `fixed inset-0 z-40 bg-black/40 animate-fade-in`
- Content: `fixed inset-y-0 left-0 z-50 flex w-[min(85vw,300px)] flex-col bg-sidebar shadow-pop animate-slide-in`; sr-only Title `เมนู`, Description `เมนูหลักของ Service Console`
- แถวบน `h-14 justify-between pr-2 pl-4`: Brand dark + ปุ่ม Close (`size-10 text-sidebar-text hover:bg-sidebar-hover`, aria-label `ปิดเมนู`, icon `X` size-5)
- ตามด้วย NavLinks(onNavigate=ปิด) และ UserBox

#### 3.6 UserBox
`flex items-center gap-3 border-t border-sidebar-border p-3`
- Avatar: `grid size-9 rounded-full bg-sidebar-hover text-sm font-medium text-white` = ตัวอักษรแรกของ `user.name`
- ชื่อ `text-sm font-medium text-white truncate`; บรรทัดล่าง `text-xs text-sidebar-muted`: `{employeeCode} · {roleLabel[role]}` (เช่น `ADMIN · ผู้ดูแลระบบ`)
- ปุ่ม logout: `<a href="/api/auth/logout?next=%2Flogin%3Freason%3Dlogout">` onClick `markLoggingOut`, `size-9 rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-white`, aria-label/title `ออกจากระบบ`, icon `LogOut` size-4

#### 3.7 Unavailable (session check error)
`main grid min-h-dvh place-items-center px-4` → วงกลม size-12 `bg-danger-soft text-danger-fg` ไอคอน `CloudOff` size-6; h1 `เชื่อมต่อระบบไม่ได้` (text-lg semibold); p text-sm muted `เซิร์ฟเวอร์ไม่ตอบสนองในขณะนี้ กรุณาลองใหม่อีกครั้ง หากยังไม่ได้ให้แจ้งทีม CIT`; ลิงก์ `href=""` ปุ่ม `ลองใหม่` (h-10 rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover)

---

### 4. Login page (`/login`)

metadata title `เข้าสู่ระบบ` → แท็บ `เข้าสู่ระบบ · Service Console`. Server component อ่าน `searchParams.reason`, `searchParams.next`.

```tsx
<LoginScreen appName="Service Console"
  tagline="เข้าสู่ระบบด้วยรหัสพนักงาน สำหรับผู้ดูแลระบบ CIT"
  home="/incidents" reason next
  panel={<LoginPanel appName="Service Console"
     headline={['ดูแลทุกป้อมให้พร้อมรับรถ','ก่อนผู้ใช้จะรู้ว่ามีปัญหา']}
     points={[{icon:<Wrench/>,text:'เปิด มอบหมาย และปิดงานแจ้งซ่อม'},
              {icon:<ClipboardCheck/>,text:'ติดตามผลตรวจเช็กประจำวันจากช่าง'},
              {icon:<Timer/>,text:'เห็นงานที่ใกล้หรือเกิน SLA ก่อนเสมอ'}]}/>}/>
```
(`logoTone` default `light`)

#### 4.1 Layout
- มี panel: `main grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]` → ซ้าย `div.login-fade hidden lg:block` (panel), ขวา `grid place-items-center px-4 py-10 sm:px-8` (form)
- ฟอร์มกว้าง `max-w-[400px]`

#### 4.2 ส่วนหัวฟอร์ม (`login-rise mb-8`, delay 220ms)
- แถวโลโก้ (ซ่อนที่ lg เพราะมี panel): CitLogo light h-7 · เส้น h-6 w-px bg-border · `Go Inno <span class=text-primary>Parking</span>` (text-lg semibold)
- h1 `Service Console`: `mt-6 text-2xl font-semibold tracking-tight` (lg: `mt-0 text-3xl`)
- tagline `mt-1 text-sm text-muted`

#### 4.3 ฟอร์ม
`form.login-stagger flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6` (lg: ไม่มีกรอบ/พื้น/padding/เงา), `noValidate`
1. กล่อง error (ถ้ามี) `role=alert flex items-start gap-2 rounded-md px-3 py-2.5 text-sm` danger=`bg-danger-soft text-danger-fg` / warning=`bg-warning-soft text-warning-fg`, ไอคอน `TriangleAlert` mt-0.5 size-4
2. Field `รหัสพนักงาน`: Input name employeeCode, autoComplete username, autoCapitalize characters, autoFocus, placeholder `เช่น ADMIN`, class `h-11 uppercase placeholder:normal-case`
3. Field `รหัสผ่าน` (id `login-password`): Input type password/text `h-11 pr-11` + ปุ่มตา `absolute top-1/2 right-1.5 size-8 -translate-y-1/2 rounded text-muted hover:text-text` icon `Eye`/`EyeOff` size-4, aria-label `แสดงรหัสผ่าน` / `ซ่อนรหัสผ่าน`, aria-pressed
4. Button submit size lg `mt-1 w-full`: ปกติ icon `LockKeyhole` + `เข้าสู่ระบบ`; busy → spinner + `กำลังเข้าสู่ระบบ…`
5. `p text-center text-xs text-muted`: `ลืมรหัสผ่าน? ติดต่อผู้ดูแลระบบ CIT เพื่อรีเซ็ต`

#### 4.4 reason= ข้อความเริ่มต้น
| reason | tone | ข้อความ |
|---|---|---|
| `expired` | warning | เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง |
| `forbidden` | danger | บัญชีนี้ไม่มีสิทธิ์เข้าเว็บนี้ |
| `logout` | warning | ออกจากระบบแล้ว |
| อื่น ๆ | — | ไม่แสดง |

#### 4.5 Submit flow
- validate ด้วย `loginInputSchema` → error ใต้ช่อง: `กรอกรหัสพนักงาน`, `กรอกรหัสผ่าน`
- `POST /api/auth/login` JSON `{employeeCode,password}`
- ok → `window.location.assign(next ถ้าขึ้นต้น "/" และไม่ใช่ "//" ไม่งั้น "/incidents")`
- ไม่ ok → danger + `body.message` หรือ `เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่`; ถ้า 401 ล้างช่องรหัสผ่าน (ข้อความจาก backend เช่น 403 `บัญชีนี้ไม่มีสิทธิ์เข้าเว็บนี้` code `WRONG_APP`)
- network error → `เชื่อมต่อเครือข่ายไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่`

#### 4.6 LoginPanel (แผงซ้าย)
`div.login-panel relative isolate flex h-full flex-col justify-between overflow-hidden p-10 xl:p-14 text-[#c9d3e6]` + glow a, glow b, `login-grid absolute inset-0 -z-10`
- บน (login-rise delay 0): CitLogo dark h-8 · เส้น `h-8 w-px bg-white/15` · `Go Inno Parking` (block text-base semibold white) / `Service Console` (block text-xs `#8b98b3`)
- กลาง `max-w-lg`: h2 `text-3xl leading-snug font-semibold tracking-tight text-white xl:text-[2.6rem] xl:leading-[1.25]` บรรทัด 1 (delay 80ms) ขาว, บรรทัด 2 (delay 160ms) สี `#93c5fd`; ul `mt-8 flex-col gap-3 text-sm` แต่ละข้อ delay `260 + i*70`ms: กล่องไอคอน `size-8 rounded-lg bg-white/[0.06] text-white ring-1 ring-white/10` svg size-4 + ข้อความ
- ล่าง figure (delay 480ms): SVG viewBox 600×300 `w-full max-w-xl` aria-label `ผังย่อ 5 ป้อมของลานจอด`
  - ถนนหลักแนวนอน y=130 กว้าง 32 (half 16) สี `#1b2742`, ขอบ `rgb(255 255 255/.35)`, เส้นกลางคู่เหลือง `#eab308` op .8 ที่ y=128.8/131.2
  - ถนนแยก (half 14) ที่ x=230 (ป้อม4, ขึ้นเหนือ), x=340 (ป้อม5, ขึ้น), x=420 (ป้อม2, ลงใต้) เส้นกลางประ `8 6` เหลือง op .75 กว้าง 1.2
  - รถ: rect 12×6 rx2 + glow (blur 2.2) + กระจก `#0b1530` op .55; เลนบน (y 123) 3 คัน dur 12s สี `#60a5fa,#f8fafc,#fbbf24`; เลนล่าง (y 137) dur 13s สี `#f8fafc,#34d399,#60a5fa`; ถนนแยก วิ่งออก `#f8fafc` 5.5s / วิ่งเข้า `#fbbf24` 6s แบบ fade
  - หมุดป้อม (จาก `CHECKPOINTS`) วงกลม r9 `#2563eb` stroke `#0b1530` 3 เลขขาว 9.5px 600 + วงกะพริบ r10 stroke `#3b82f6` (delay i*0.55s); ชื่อ (ตัดคำ “ป้อม” ออก) 11.5px `#a7b2c8`; ตำแหน่ง: 1 (70,94,middle) 2 (450,236,start) 3 (540,94,middle) 4 (200,62,end) 5 (370,62,start)
  - figcaption `text-xs #8b98b3`: จุดเขียว emerald-400 (ping) + `ผังย่อ 5 ป้อมของลานจอด`
  - `prefers-reduced-motion`: ไม่มีรถ ไม่มี pulse ไม่มี ping

---

### 5. Auth & roles

#### 5.1 Config
`lib/app.ts`: `app = { id: 'service', allowedRoles: ['admin'] }`, `HOME = '/incidents'`
Cookies (httpOnly, `Path=/; SameSite=Lax; Max-Age=28800` (8 ชม.), `Secure` ใน production): `gip_service_session` (token), `gip_service_role` (role)

#### 5.2 middleware.ts
matcher `/((?!api/|_next/|brand/|favicon.ico|icon|apple-icon).*)`
- `/login`: มี cookie session และไม่มี `?reason` → redirect `/incidents`
- path อื่นไม่มี cookie → `/login` (+ `?next=<path+search>` ถ้า path ไม่ใช่ `/` หรือ `/incidents`)

#### 5.3 Protected layout (`getSession` → `GET {backend}/auth/me` Bearer token)
| status | เงื่อนไข | ผล |
|---|---|---|
| `ok` | 200 + user role อยู่ใน allowedRoles | `<SessionProvider user><Shell>` |
| `none` | ไม่มี cookie | `redirect('/login')` |
| `expired` | backend 401 | redirect `/api/auth/logout?next=/login?reason=expired` (encoded) |
| `forbidden` | role ไม่ใช่ admin | redirect `/api/auth/logout?next=/login?reason=forbidden` |
| `error` | อื่น ๆ / schema ผิด | `<Unavailable/>` |

`admin/layout.tsx`: ถ้าไม่ ok หรือ role ≠ admin → `redirect('/incidents?denied=admin')`

#### 5.4 Route handlers
| Route | Method | พฤติกรรม |
|---|---|---|
| `/api/auth/login` | POST | validate `loginInputSchema` (400 `ข้อมูลไม่ครบ`/ข้อความ zod) → POST `{backend}/auth/login` → ไม่ ok ส่งต่อ body/status (default `เข้าสู่ระบบไม่สำเร็จ`) → schema ผิด 502 `รูปแบบข้อมูลจากเซิร์ฟเวอร์ไม่ถูกต้อง` → role ไม่อยู่ใน allowedRoles: เรียก backend `/auth/logout` แล้ว 403 `{message:'บัญชีนี้ไม่มีสิทธิ์เข้าเว็บนี้', code:'WRONG_APP'}` → สำเร็จ set 2 cookies, ตอบ `{ user }` |
| `/api/auth/logout` | POST | เรียก backend `/auth/logout` (ถ้ามี token), ลบ cookies, `{ok:true}` |
| `/api/auth/logout` | GET `?next=` | เหมือน POST แล้ว 303 ไป `next` (รับเฉพาะขึ้นต้น `/` ไม่ใช่ `//`, default `/login`) |
| `/api/proxy/[...path]` | GET/POST/PATCH/PUT/DELETE (`dynamic='force-dynamic'`) | ไม่มี token → 401 `{message:'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', code:'UNAUTHORIZED'}`; ส่งต่อไป `{backend}/{path}{search}` พร้อม `Authorization: Bearer`, `Accept: application/json`, Content-Type เดิม, `x-mock-error` (เฉพาะ mock); backend 401 → ลบ cookies; ส่ง body/status กลับ |

Backend ล่ม (fetch throw) → 502 `{message:'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง', code:'BACKEND_DOWN'}`

#### 5.5 Client (`request()` ใน `client.ts`)
- baseUrl `/api/proxy`, `credentials: same-origin`, query ผ่าน `toSearch` (ข้ามค่าว่าง/null; array join ด้วย `,`)
- network error → `ApiError(0,'เชื่อมต่อเครือข่ายไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')`
- non-ok → `ApiError(status, body.message ?? statusMessages[status] ?? 500-msg, body.code)`; 401 เรียก `onUnauthorized`
- response ไม่ตรง zod → `ApiError(status,'รูปแบบข้อมูลจากเซิร์ฟเวอร์ไม่ถูกต้อง','SCHEMA')`

| status | ข้อความ default |
|---|---|
| 400 | ข้อมูลไม่ถูกต้อง |
| 401 | เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ |
| 403 | บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้ |
| 404 | ไม่พบข้อมูลที่ต้องการ |
| 409 | ข้อมูลซ้ำกับที่มีอยู่แล้ว |
| 500 | ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง |
| 502 | เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ |

#### 5.6 SessionProvider / useUser
- ให้ `User` ผ่าน context (`useUser()` throw `useUser ต้องอยู่ใน <SessionProvider>`)
- ตั้ง `onUnauthorized` → `location.assign('/api/auth/logout?next=' + encode('/login?reason=expired&next=' + encode(path+search)))` ยกเว้นกำลัง logout
- `markLoggingOut()` ถูกเรียกเมื่อกดออกจากระบบ และบน `beforeunload`/`pagehide`

---

### 6. Shared components (@gip/ui)

#### 6.1 Badge (base)
`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap`; icon size-3.5
| tone | class |
|---|---|
| success | `bg-success-soft text-success-fg` |
| primary | `bg-primary-soft text-primary-fg` |
| warning | `bg-warning-soft text-warning-fg` |
| danger | `bg-danger-soft text-danger-fg` |
| neutral | `bg-neutral-soft text-muted` |

#### 6.2 StatusBadge `{status}`
| status | label | tone | icon |
|---|---|---|---|
| open | เปิด | primary | CircleDot |
| assigned | มอบหมายแล้ว | primary | UserCheck |
| in_progress | กำลังดำเนินการ | warning | Wrench |
| waiting_parts | รออะไหล่ | warning | Package |
| closed | ปิดงาน | success | CircleCheck |
| cancelled | ยกเลิก | neutral | Ban |

#### 6.3 PriorityBadge `{priority}`
`inline-flex min-w-[5.5rem] items-center justify-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold nowrap`, icon size-3.5 strokeWidth 2.5
| priority | label | icon | class (สี) |
|---|---|---|---|
| low | ต่ำ | ChevronsDown | `bg-prio-low-bg text-prio-low-fg` (#dcf5e6/#136c37) |
| medium | ปานกลาง | Minus | `bg-prio-medium-bg text-prio-medium-fg` (#fdf0b8/#7a5200) |
| high | สูง | ChevronsUp | `bg-prio-high text-white` (#c2410c) |
| critical | วิกฤต | Siren | `bg-prio-critical text-white shadow-[0_2px_8px_-2px_var(--prio-critical)]` (#dc2626) |

#### 6.4 SlaBadge `{incident, now}` (class `num`)
`slaState`: cancelled→none; closed→ resolvedAt ≤ slaDueAt ? met : missed (ไม่มี resolvedAt → none); งานเปิด: remaining<0 → breached; remaining ≤ 25% (`SLA_WARNING_RATIO=0.25`) ของ (slaDueAt−openedAt) → warning; อื่น ok
| state | tone | icon | ข้อความ |
|---|---|---|---|
| ok | neutral | Clock | `เหลือ {duration}` |
| warning | warning | Hourglass | `เหลือ {duration}` |
| breached | danger | TriangleAlert | `เกิน {duration}` |
| met | success | CircleCheck | ทัน SLA |
| missed | danger | TriangleAlert | เกิน SLA |
| none | neutral | Ban | — |

`formatDuration(min)`: <1 → `ไม่ถึง 1 นาที`; <60 → `N นาที`; มีวัน → `D วัน H ชม.` (หรือ `D วัน`); อื่น → `H ชม. M นาที` (หรือ `H ชม.`). `now` มาจาก `useNow()` (ติ๊กทุก 30,000ms). Sort rank: breached 0, warning 1, ok 2, missed/met 3, none 4.

#### 6.5 EquipmentBadge `{status}`
| status | label | tone | icon |
|---|---|---|---|
| normal | ปกติ | success | CircleCheck |
| stuck | ค้าง | warning | Hourglass |
| down | เสีย | danger | TriangleAlert |

#### 6.6 Button (cva)
Base: `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition 150ms disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4`
| variant | class |
|---|---|
| primary (default) | `bg-primary text-on-primary hover:bg-primary-hover active:brightness-95` |
| secondary | `border border-border-strong bg-surface text-text hover:bg-surface-hover active:bg-surface-2` |
| ghost | `text-text hover:bg-surface-hover active:bg-surface-2` |
| danger | `bg-danger text-white hover:brightness-110 active:brightness-95` |
| danger-outline | `border border-danger/40 bg-surface text-danger-fg hover:bg-danger-soft` |

| size | class |
|---|---|
| sm | h-8 px-3 text-sm |
| md (default) | h-10 px-4 text-sm |
| lg | h-12 px-5 text-base |
| icon | size-10 |
| icon-sm | size-8 |
Prop `loading` → disabled + `aria-busy` + `Loader2 animate-spin` นำหน้า; default `type="button"`

#### 6.7 Form
- control ร่วม: `w-full rounded-md border border-border-strong bg-surface text-text placeholder:text-muted hover:border-muted/60 focus:border-primary focus:ring-3 focus:ring-primary/20 disabled:bg-surface-2 disabled:opacity-70 aria-invalid:border-danger aria-invalid:focus:ring-danger/20`
- `Input` h-10 px-3 text-sm · `Textarea` min-h-24 px-3 py-2 text-sm leading-relaxed · `Select` native, h-10 pr-9 pl-3 appearance-none + `ChevronDown` size-4 text-muted ด้านขวา (right-3)
- `Field {label, error?, hint?, required?, htmlFor?}`: `flex flex-col gap-1.5`; label text-sm font-medium (+ `*` text-danger-fg ml-0.5); error `text-sm text-danger-fg role=alert` (id `${id}-error`) / hint text-sm muted; ผูก id/aria-invalid/aria-describedby อัตโนมัติ
- `Switch {checked,onCheckedChange,label,description?,disabled?}`: ปุ่ม role=switch h-6 w-10 rounded-full (on `bg-primary` / off `bg-border-strong`), knob size-5 ขาว shadow-card translate 18px/2px; label text-sm font-medium + description block muted

#### 6.8 Dialog / ConfirmDialog
- Overlay `bg-black/50 animate-fade-in z-50`
- Content: มือถือ = bottom sheet `inset-x-0 bottom-0 max-h-[92dvh] rounded-t-lg`; ≥sm = กลางจอ `w-[calc(100%-2rem)] rounded-lg`; size sm `max-w-sm`, md `max-w-lg` (default), lg `max-w-2xl`; `border bg-surface shadow-pop animate-pop-in`
- Header `border-b px-5 py-4`: Title text-base semibold, Description mt-1 text-sm muted; ปุ่มปิด ghost icon-sm aria-label `ปิด` (X)
- Body `overflow-y-auto px-5 py-4`; Footer `border-t px-5 py-3 flex-col-reverse gap-2 sm:flex-row sm:justify-end`
- `ConfirmDialog {trigger,title,description,confirmLabel,tone='danger'|'primary',onConfirm}` size sm: ปุ่ม `ยกเลิก` (secondary) + ปุ่มยืนยัน (danger/primary, loading ระหว่างรอ, ปิดเมื่อสำเร็จ, ปิดไม่ได้ระหว่าง busy)

#### 6.9 Toast (`useToast()({title, description?, tone?: 'success'|'error'|'info'})`)
- เก็บสูงสุด 3 อัน, duration 4500ms, swipe right; error = foreground
- Viewport `fixed right-0 bottom-0 z-[60] w-full max-w-sm flex-col gap-2 p-4`
- Root `flex items-start gap-3 rounded-lg border bg-surface p-3 pr-2 shadow-pop animate-pop-in`; icon size-5: error `CircleAlert text-danger`, อื่น `CircleCheck text-success`; title text-sm font-medium; description text-sm muted; ปุ่มปิด `X` size-4 aria-label `ปิด`

#### 6.10 Tabs / SegmentedControl
- `TabsList`: `flex gap-1 overflow-x-auto border-b border-border`; `TabsTrigger`: `-mb-px border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted hover:text-text`, active `border-primary text-text`
- `SegmentedControl {value,onChange,options,label,size='md'}`: role radiogroup, `inline-flex rounded-md border border-border bg-surface-2 p-0.5`; ปุ่ม `rounded-[5px] font-medium`; sm `px-2.5 py-1 text-xs`, md `px-3 py-1.5 text-sm`; active `bg-surface text-text shadow-card ring-1 ring-border` / ไม่ active `text-muted hover:text-text`; ลูกศรซ้าย/ขวาวน

#### 6.11 DateRangePicker `{value:{from,to}, onChange, presets?, maxPastDays=365}`
- presetLabels: today `วันนี้`, yesterday `เมื่อวาน`, 7d `7 วัน`, 30d `30 วัน`, month `เดือนนี้`
- ≥md: SegmentedControl size sm label `ช่วงเวลา` + ปุ่มปฏิทิน; ปุ่ม: ตรง preset → ghost (แสดงแค่ไอคอนบน md), custom → secondary + `ring-1 ring-primary/40` แสดงช่วงวันที่; มือถือแสดง label + ChevronDown; aria-label `เลือกช่วงวันที่เอง (ตอนนี้: {label})`
- Popover (align end, offset 8) `w-[min(100vw-24px,340px)] rounded-lg border bg-surface p-3 shadow-pop`: มือถือมีปุ่ม preset; DayPicker range locale th, ปิดวันหลังวันนี้และก่อน maxPastDays; วัน size-10 rounded-md; today `font-semibold text-primary-fg`; selected `bg-primary-soft`; start/end `bg-primary text-on-primary`; ท้าย: ข้อความช่วง (หรือ `เลือกวันเริ่มต้น`) + ปุ่ม sm `ใช้ช่วงนี้`
- วันที่ตัดตาม `Asia/Bangkok`

#### 6.12 States
- `Skeleton {className}` → div class `skeleton`
- `EmptyState {icon?,title,description?,action?,compact?}`: กลาง, `gap-2 px-6 py-12` (compact `gap-1.5 px-4 py-6`), icon ในวง size-10 `bg-surface-2 text-muted`, title font-medium, description max-w-sm text-sm muted, action mt-2
- `ErrorState {error?,onRetry?,retrying?,compact?}` role alert: วง size-10 `bg-danger-soft text-danger-fg` `CloudOff`; หัว `โหลดข้อมูลไม่สำเร็จ`; ข้อความ = `error.message` (fallback `โหลดข้อมูลไม่สำเร็จ`); ปุ่ม secondary sm `RotateCw` + `ลองใหม่`
- `StaleBanner {onRetry?}`: `rounded-md bg-warning-soft px-3 py-1.5 text-xs text-warning-fg` `CloudOff` + `อัปเดตไม่สำเร็จ กำลังแสดงข้อมูลล่าสุดที่มี` + ปุ่ม underline `ลองใหม่`

#### 6.13 Panel / PageHeader
- `PageHeader {title,description?,actions?,back?}`: `mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between`; h1 `text-xl sm:text-2xl font-semibold tracking-tight`; description mt-1 text-sm muted; actions `flex shrink-0 flex-wrap gap-2`
- `Panel {title,description?,actions?,id?,bodyClassName?}`: section `rounded-lg border border-border bg-surface`; header `px-4 pt-4 sm:px-5 sm:pt-5` h2 text-base semibold + description mt-0.5 text-sm muted; body `p-4 sm:p-5`

#### 6.14 StatCard `{label,value,current?,previous?,compareLabel?,lowerIsBetter?,icon?,emphasis?,footer?,loading?}`
`rounded-lg border bg-surface p-4 sm:p-5 gap-3`; header text-sm muted (icon size-4 + h3 font-medium); value `num font-semibold leading-none tracking-tight` (emphasis `text-[2.5rem] sm:text-5xl` / ปกติ `text-[1.75rem] sm:text-[2rem]`); % เปลี่ยนแปลง: ArrowUpRight/ArrowDownRight/Minus, สี success-fg (ดี) / danger-fg / muted; sr-only `เพิ่มขึ้น`/`ลดลง`/`คงที่`; previous=0 → `ไม่มีข้อมูลช่วงก่อน`; รูปแบบ `+12.3%` / `−4.0%` (เครื่องหมายลบ U+2212); flat ถ้า |Δ|<0.05

#### 6.15 DataTable `{columns,rows,rowKey,rowHref?,rowLabel?,linkComponent?,rowClassName?,mobileCard?,cardsBelow='md',pageSize=20,initialSort?,loading?,empty?,caption?}`
- rows=[] และไม่ loading → render `empty`
- thead `border-b bg-surface-2`, th `h-10 px-3 font-medium text-muted first:pl-4 last:pr-4`; คอลัมน์ sortable เป็นปุ่ม + `ArrowUpDown` (op 40) / `ArrowUp` / `ArrowDown` size-3.5; คลิก: asc → desc → ไม่เรียง; เรียงแบบ localeCompare 'th', null ไว้ท้าย
- td `h-12 px-3 py-2`; แถวที่มี rowHref: ทั้งแถวคลิกได้ (link ในเซลล์แรก `after:absolute after:inset-0`), hover `shadow-[inset_0_0_0_999px_rgb(0_0_0/0.035)]`
- loading: ตาราง 8 แถว skeleton (h-4 max-w-32) / การ์ด 5 อัน
- mobileCard: `ul divide-y` แสดงต่ำกว่า md (หรือ lg), `p-4`
- แบ่งหน้าเมื่อเกิน pageSize: `nav aria-label="แบ่งหน้า"` `border-t px-4 py-3 text-sm text-muted`: `{a}–{b} จาก {n} รายการ` + ปุ่ม ghost icon-sm `หน้าก่อนหน้า`/`หน้าถัดไป` + `{page} / {count}`

#### 6.16 Photos
- `PhotoUploader {value,onChange,max=6,label='แนบรูป',error?,disabled?}`: grid 3 (sm:4) cols gap-2, รูป aspect-square rounded-md; ปุ่มลบ `size-7 rounded-full bg-black/60` aria `ลบรูปที่ {n}`; ช่องเพิ่ม dashed `border-border-strong` hover primary-soft, `ImagePlus` + label (`กำลังเตรียมรูป…` ขณะ busy) + `{n}/{max}`; รับ jpeg/png/webp/heic/heif ≤15MB; ย่อขอบยาวสุด 1600px JPEG q0.82 (data URL); error: `รองรับเฉพาะไฟล์รูป JPG, PNG, WEBP หรือ HEIC ขนาดไม่เกิน 15 MB`, `บางรูปเปิดไม่ได้ ลองเลือกรูปอื่น`, `แนบได้สูงสุด {max} รูป`
- `PhotoGallery {photos,label}`: ว่าง → `ไม่มีรูป`; grid thumbnails; คลิกเปิด Dialog lg title `{label} ({i}/{n})`, รูป max-h-[65dvh], ปุ่ม `รูปก่อนหน้า`/`รูปถัดไป`, คีย์ลูกศร

#### 6.17 CitLogo `{tone='dark'|'light', mark?}`
`<img alt="CIT">` — dark `/brand/cit-logo-white.png`, light `/brand/cit-logo.png` (661×128, default `h-6 w-auto`); mark `/brand/cit-mark.png` (256², `h-8`)

#### 6.18 Format helpers (`@gip/ui` lib/format) — locale `th-TH-u-ca-gregory-nu-latn`, TZ `Asia/Bangkok` (ปี ค.ศ.)
| ฟังก์ชัน | ตัวอย่าง |
|---|---|
| formatDate | `15 ต.ค. 2026` |
| formatDayMonth | `15 ต.ค.` |
| formatTime | `10:32` |
| formatDateTime | `15 ต.ค. 2026 10:32` |
| formatDateRange | `1–15 ต.ค. 2026` / `28 ก.ย. – 4 ต.ค. 2026` |
| formatRelative | `เมื่อสักครู่` / `N นาทีที่แล้ว` / `N ชม. ที่แล้ว` (<6 ชม.) / `วันนี้ 10:32` / `เมื่อวาน 10:32` / datetime |
| formatSlaRemaining | `เหลือ …` / `เกิน …` |
| formatBaht / formatNumber / formatPercent / formatHourRange | `฿1,234` / `1,234` / `+12.3%` / `08:00–09:00` |

---

### 7. Data model & API

#### 7.1 Enums + ป้ายไทย
**Role** (`roleLabel`): `executive` ผู้บริหาร · `admin` ผู้ดูแลระบบ · `operator` ช่างเทคนิค
**IncidentStatus**: ดูตาราง 6.2; `activeStatuses = ['open','assigned','in_progress','waiting_parts']`
**Priority**: `low` ต่ำ · `medium` ปานกลาง · `high` สูง · `critical` วิกฤต
**EquipmentType** (`equipmentTypeLabel`):
| value | label |
|---|---|
| esp | บอร์ดควบคุม ESP |
| controller | บอร์ดควบคุม |
| computer | คอมพิวเตอร์ |
| barrier | ไม้กั้น |
| ticket | ตู้จ่ายสลิป (Kiosk Entrance) |
| payment | ตู้ชำระเงิน (Kiosk Exit) |
| kiosk | Kiosk Payment |
| lpr | กล้องอ่านป้ายทะเบียน |
| face | กล้องจับใบหน้า |
| qr | เครื่องอ่าน QR |
| notouch | เซ็นเซอร์ไม่สัมผัส |
| loop | Loop Sensor |
| radar | เรดาร์ |
| intercom | Intercom |
`KIOSK_ZONE_ID = 'kiosk'` (Kiosk Payment ไม่สังกัดป้อม)
**EquipmentStatus**: `normal` ปกติ · `stuck` ค้าง · `down` เสีย
**Direction**: `in` ทางเข้า · `out` ทางออก
**PaymentChannel**: `cash` เงินสด · `credit` บัตรเครดิต · `ewallet` e-Wallet · `qr` QR พร้อมเพย์
**Log source**: `web` | `liff`
**CHECKPOINTS**: 1 ป้อมจตุรทิศ · 2 ป้อมเพชรบุรี · 3 ป้อมทางออกศูนย์วิจัย · 4 ป้อม I-HOUSE (A,B,C) · 5 ป้อม I-HOUSE (D,E); `checkpointLabel(n)` = `จุดที่ {n} {name}` (ตรงกับ `site.group`)
**DEFAULT_SLA** (นาที): critical 15/240 · high 30/480 · medium 60/1440 · low 240/4320 (response/resolve); `slaDueAt = openedAt + resolveMinutes`
**Date presets**: `today, yesterday, 7d, 30d, month`

#### 7.2 Entities (zod)
ชนิด: `isoDateTime` = ISO string มี offset; `isoDate` = `YYYY-MM-DD`

**User**: `id`, `employeeCode` (min1), `name` (min1), `role: Role`, `isTechnician: boolean`, `position: string|null`, `phone: string|null`, `active: boolean`
**UserInput**: `employeeCode` (trim, 2–20, `/^[A-Za-z0-9_-]+$/`; msgs `กรอกรหัสพนักงานอย่างน้อย 2 ตัวอักษร`, `รหัสพนักงานยาวเกิน 20 ตัวอักษร`, `ใช้ได้เฉพาะ A–Z, 0–9, - และ _`), `name` (`กรอกชื่อ-นามสกุล`), `role`, `isTechnician`, `position?` (≤60, nullable), `phone?` (`/^[0-9+\-\s]{0,20}$/` `เบอร์โทรใช้ได้เฉพาะตัวเลข + - และช่องว่าง`), `password?` (min8 `รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร`); + `active?` ตอนแก้ไข. กฎเพิ่ม `technicianPhoneError`: isTechnician ต้องมีเบอร์ → `ช่างเทคนิคต้องใส่เบอร์โทร เพื่อให้โทรตามได้เมื่อเกิดปัญหา`
**LoginInput**: `employeeCode` (trim min1 `กรอกรหัสพนักงาน`), `password` (min1 `กรอกรหัสผ่าน`); **LoginResponse**: `{ token, user }`

**Site**: `id`, `code` (`กรอกรหัสจุด`), `name` (`กรอกชื่อจุด`), `direction: 'in'|'out'`, `group: string|null`, `active`; SiteInput = ไม่มี id
**Equipment**: `id`, `siteId`, `type: EquipmentType`, `name` (`กรอกชื่ออุปกรณ์`), `status: normal|stuck|down`, `lastHeartbeatAt: string|null`, `statusNote: string|null`, `armOpen?: boolean|null` (barrier), `hwCode?: string|null` (เช่น ESP-001), `subCode?: string|null` (เช่น LPR_02); EquipmentInput = `{siteId,type,name}`
**EquipmentStatus** (array): `{ site: Site, normal, stuck, down: int, items: Equipment[] }`

**ProblemType**: `id`, `name` (`กรอกชื่อประเภทปัญหา`), `equipmentType: EquipmentType|null`, `active`
**Incident**: `id`, `code` (`/^INC-\d{4,}$/`), `siteId`, `equipmentId`, `problemTypeId`, `description`, `priority`, `status`, `assigneeId|null`, `cause|null`, `parts|null`, `photosBefore: string[]`, `photosAfter: string[]`, `openedAt`, `respondedAt|null`, `resolvedAt|null`, `slaDueAt`, `inspectionId|null`
**IncidentLog**: `id`, `incidentId`, `authorId`, `authorName`, `message`, `source: web|liff`, `createdAt`
**IncidentDetail** = Incident + `logs: IncidentLog[]`
**IncidentCreate**: `siteId` (`เลือกจุดติดตั้ง`), `equipmentId` (`เลือกอุปกรณ์`), `problemTypeId` (`เลือกประเภทปัญหา`), `priority`, `description` (trim ≥5 `อธิบายอาการอย่างน้อย 5 ตัวอักษร`), `photosBefore` (≤6 `แนบรูปได้ไม่เกิน 6 รูป`), `inspectionId?`
**IncidentPatch** (partial): `status`, `priority`, `assigneeId|null`, `cause|null`, `parts|null`
**IncidentClose**: `cause` (trim ≥3 `ระบุสาเหตุของปัญหา`), `parts?`, `photosAfter` (1–6, `แนบรูปหลังซ่อมอย่างน้อย 1 รูป`)
**IncidentFilter** (query): `q?`, `status?[]`, `priority?[]`, `siteId?`, `assigneeId?`, `from?`, `to?`

**ChecklistTemplate**: `id`, `equipmentType`, `name` (`กรอกชื่อเทมเพลต`), `items: {id, label (trim min1 'กรอกหัวข้อตรวจ')}[]` (min1 `ต้องมีหัวข้อตรวจอย่างน้อย 1 ข้อ`)
**InspectionResult**: `itemId`, `label`, `pass: boolean`, `note|null`, `photo|null`
**Inspection**: `id`, `siteId`, `equipmentId`, `inspectorId`, `inspectorName`, `date: isoDate`, `inspectedAt`, `results[]`, `incidentIds: string[]`

**SlaSetting**: `priority`, `responseMinutes` int>0, `resolveMinutes` int>0 (`ต้องมากกว่า 0 นาที`)
**TechnicianKpi**: `user: User`, `total`, `closed`, `open`, `avgResponseMinutes|null`, `avgResolveMinutes|null`, `slaMet`, `slaMeasured`
**SlaOverview**: `byPriority: {priority, measured, met}[]`, `trend: {date, measured, met}[]`
(Dashboard schemas — summary/revenue-trend/payment-channels/revenue-points/traffic-heatmap — ใช้เฉพาะเว็บ executive)
Error body: `{ message: string, code?: string }`

#### 7.3 Endpoints (ผ่าน `/api/proxy` → backend) + hooks
`POLL_INTERVAL_MS = NEXT_PUBLIC_POLL_INTERVAL_MS || 30000`; "live" = `refetchInterval: POLL`, `refetchIntervalInBackground: false`. Global staleTime 15s.

| Hook | Method & path | Query/Body | Response | Poll / staleTime / อื่น |
|---|---|---|---|---|
| `useMe` | GET `/auth/me` | — | User | stale 60s |
| `useIncidents(f)` | GET `/incidents` | `q,status(csv),priority(csv),siteId,assigneeId,from,to` | Incident[] | live 30s, keepPreviousData |
| `useIncident(id)` | GET `/incidents/:id` | — | IncidentDetail | live 30s |
| `useCreateIncident` | POST `/incidents` | IncidentCreate | Incident | invalidate incidents, equipment, kpi, inspections |
| `useUpdateIncident(id)` | PATCH `/incidents/:id` | IncidentPatch | Incident | เหมือนข้างบน |
| `useCloseIncident(id)` | POST `/incidents/:id/close` | IncidentClose | Incident | เหมือนข้างบน |
| `useAddIncidentLog(id)` | POST `/incidents/:id/logs` | `{message}` | IncidentLog | invalidate incident(id) |
| `useAddIncidentPhotos(id)` | POST `/incidents/:id/photos` | `{kind:'before'|'after', photos}` | Incident | invalidate incident(id) |
| `useInspections(date)` | GET `/inspections` | `date` | Inspection[] | live 30s, keepPrev |
| `useInspection(id)` | GET `/inspections/:id` | — | Inspection | ไม่ poll |
| `useTechnicianKpi(r)` | GET `/kpi/technicians` | `from,to` | TechnicianKpi[] | live, keepPrev |
| `useSlaOverview(r)` | GET `/kpi/sla` | `from,to` | SlaOverview | live, keepPrev |
| `useEquipmentStatus` | GET `/equipment/status` | — | EquipmentStatus | live |
| `useUsers` | GET `/users` | — | User[] | — |
| `useSaveUser` | POST `/users` / PATCH `/users/:id` | UserInput (+active) | User | invalidate users, kpi |
| `useResetPassword` | POST `/users/:id/reset-password` | — | `{temporaryPassword}` | — |
| `useSites` | GET `/sites` | — | Site[] | stale 5 นาที |
| `useSaveSite` | POST `/sites` / PATCH `/sites/:id` | SiteInput | Site | invalidate sites, equipment, dashboard |
| `useEquipment` | GET `/equipment` | — | Equipment[] | stale 60s |
| `useSaveEquipment` / `useDeleteEquipment` | POST `/equipment`, PATCH/DELETE `/equipment/:id` | EquipmentInput | Equipment / `{ok:true}` | invalidate equipment |
| `useChecklists` | GET `/checklist-templates` | — | ChecklistTemplate[] | — |
| `useSaveChecklist` / `useDeleteChecklist` | POST, PATCH/DELETE `/checklist-templates/:id` | ChecklistTemplateInput | | invalidate checklists |
| `useProblemTypes` | GET `/problem-types` | — | ProblemType[] | stale 5 นาที |
| `useSaveProblemType` / `useDeleteProblemType` | POST, PATCH/DELETE `/problem-types/:id` | ProblemTypeInput | | invalidate problem-types |
| `useSlaSettings` | GET `/sla-settings` | — | SlaSetting[] | — |
| `useSaveSla` | PUT `/sla-settings` | SlaSetting[] | SlaSetting[] | invalidate sla, kpi, incidents |
| (auth, server-only) | POST `/auth/login`, POST `/auth/logout`, GET `/auth/me` | | | Bearer token |

Query keys: `['auth','me']`, `['incidents','list',f]`, `['incidents','detail',id]`, `['inspections','list',date]`, `['inspections','detail',id]`, `['kpi',name,from,to]`, `['users']`, `['sites']`, `['equipment','list']`, `['equipment','status']`, `['checklist-templates']`, `['problem-types']`, `['sla-settings']`.

`useLookups()` (lib/lookups.ts): รวม sites/equipment/problems/users เป็น Map → `{ready, sites, equipment, problems, users, technicians (isTechnician && active), site(id), equip(id), problem(id), user(id|null)}`. `useNow(ms=30000)` นาฬิการ่วมสำหรับนับถอยหลัง SLA.

---

## ส่วนที่ 2 · งานแจ้งซ่อม (Incidents)


ไฟล์ต้นทาง: `apps/service/app/(protected)/incidents/{page.tsx, incident-list.tsx, new/page.tsx, [id]/page.tsx, [id]/action-panel.tsx, [id]/timeline.tsx}`, `apps/service/components/incident-form.tsx`, `apps/service/lib/lookups.ts`, `lib/use-now.ts`, `packages/api/src/{schemas/incident.ts, schemas/common.ts, labels.ts, calc/sla.ts, calc/dates.ts, hooks/index.ts, endpoints/index.ts, mocks/handlers.ts}`

ทุกหน้าอยู่ใต้ layout `(protected)` (admin เท่านั้น — ส่วน shell/sidebar อยู่ในส่วนอื่นของสเปก)

---

### B.0 ข้อมูลและ helper ที่ใช้ร่วมกัน

#### Enum และป้ายภาษาไทย (`@gip/api` – `labels.ts`, `schemas`)

| `incidentStatuses` (ลำดับ) | `statusLabel` |
|---|---|
| `open` | "เปิด" |
| `assigned` | "มอบหมายแล้ว" |
| `in_progress` | "กำลังดำเนินการ" |
| `waiting_parts` | "รออะไหล่" |
| `closed` | "ปิดงาน" |
| `cancelled` | "ยกเลิก" |

- `activeStatuses = ['open','assigned','in_progress','waiting_parts']` (งานยังไม่จบ)
- `priorities = ['low','medium','high','critical']` → `priorityLabel`: low "ต่ำ", medium "ปานกลาง", high "สูง", critical "วิกฤต"
  - ใน dropdown กรอง/แผงจัดการ ใช้ `[...priorities].reverse()` → วิกฤต, สูง, ปานกลาง, ต่ำ
  - ในฟอร์มเปิดงาน (SegmentedControl) ใช้ลำดับปกติ → ต่ำ, ปานกลาง, สูง, วิกฤต
- `equipmentTypeLabel` (ใช้ในฟอร์มขั้นที่ 2): esp "บอร์ดควบคุม ESP", controller "บอร์ดควบคุม", computer "คอมพิวเตอร์", barrier "ไม้กั้น", ticket "ตู้จ่ายสลิป (Kiosk Entrance)", payment "ตู้ชำระเงิน (Kiosk Exit)", kiosk "Kiosk Payment", lpr "กล้องอ่านป้ายทะเบียน", face "กล้องจับใบหน้า", qr "เครื่องอ่าน QR", notouch "เซ็นเซอร์ไม่สัมผัส", loop "Loop Sensor", radar "เรดาร์", intercom "Intercom"

#### Schema `Incident`
`id, code (/^INC-\d{4,}$/), siteId, equipmentId, problemTypeId, description, priority, status, assigneeId|null, cause|null, parts|null, photosBefore[], photosAfter[], openedAt, respondedAt|null, resolvedAt|null, slaDueAt, inspectionId|null` (เวลาเป็น ISO มี offset)

`IncidentDetail = Incident + logs: IncidentLog[]` โดย `IncidentLog = {id, incidentId, authorId, authorName, message, source: 'web'|'liff', createdAt}` (เซิร์ฟเวอร์เรียงใหม่สุดก่อน)

`incidentCreateSchema` (ข้อความ validation ตรงตัว):
- `siteId` min1 → "เลือกจุดติดตั้ง"
- `equipmentId` min1 → "เลือกอุปกรณ์"
- `problemTypeId` min1 → "เลือกประเภทปัญหา"
- `priority` enum
- `description` trim min5 → "อธิบายอาการอย่างน้อย 5 ตัวอักษร"
- `photosBefore` max6 → "แนบรูปได้ไม่เกิน 6 รูป"
- `inspectionId` nullable optional

`incidentPatchSchema` = partial `{status, priority, assigneeId|null, cause|null, parts|null}`

`incidentCloseSchema`:
- `cause` trim min3 → "ระบุสาเหตุของปัญหา"
- `parts` trim optional
- `photosAfter` min1 → "แนบรูปหลังซ่อมอย่างน้อย 1 รูป", max6

`IncidentFilter = {q?, status?[], priority?[], siteId?, assigneeId?, from?, to?}` — ส่งเป็น query string; array join ด้วย `,` (เช่น `status=open,assigned`), ค่าว่าง/undefined ไม่ส่ง

#### SLA (`@gip/api/calc` – `calc/sla.ts`)
- `DEFAULT_SLA` (ใช้เมื่อไม่มีค่าตั้ง): critical response 15 / resolve 240 นาที; high 30/480; medium 60/1440; low 240/4320
- `slaFor(priority, settings)` → หา setting ของ priority (fallback DEFAULT_SLA)
- `slaDueAt = openedAt + resolveMinutes` (เซิร์ฟเวอร์คำนวณตอนสร้าง และคำนวณใหม่เมื่อเปลี่ยน priority — ยังนับจาก openedAt เดิม)
- `slaState(i, now)`:
  - `cancelled` → `none`
  - `closed` → ไม่มี resolvedAt = `none`; resolvedAt ≤ due → `met`, มิฉะนั้น `missed`
  - ยังเปิด: remaining = due − now; <0 → `breached`; remaining ≤ 25% ของ (due − openedAt) (`SLA_WARNING_RATIO = 0.25`) → `warning`; อื่น ๆ → `ok`
- `slaRemainingMs(i, now) = slaDueAt − now` (ติดลบเมื่อเกิน)
- `slaSortRank`: breached 0, warning 1, ok 2, missed/met 3, none 4 — เซิร์ฟเวอร์ (mock) เรียง list ตาม rank; rank ≤2 เรียง `slaDueAt` น้อยก่อน; ที่เหลือ `openedAt` ใหม่ก่อน

#### `SlaBadge` (packages/ui)
Badge คลาส `num` โทน/ไอคอน/ข้อความตาม state: ok = neutral + Clock + "เหลือ {formatDuration}"; warning = warning + Hourglass + "เหลือ …"; breached = danger + TriangleAlert + "เกิน …"; met = success + CircleCheck + "ทัน SLA"; missed = danger + TriangleAlert + "เกิน SLA"; none = neutral + Ban + "—"

#### `presetRange` (`calc/dates.ts`) — วันที่ตามเวลาไซต์ (`toSiteDate`)
today = วันนี้–วันนี้; yesterday; `7d` = วันนี้−6 ถึงวันนี้; `30d` = วันนี้−29 ถึงวันนี้; `month` = วันที่ 01 ของเดือน ถึงวันนี้ (รูปแบบ `YYYY-MM-DD`)

#### `useLookups()` (`apps/service/lib/lookups.ts`)
รวม `useSites` (staleTime 5 นาที), `useEquipment` (60 วิ), `useProblemTypes` (5 นาที), `useUsers` → คืน `{ready (ทั้ง 4 โหลดแล้ว), sites, equipment, problems, users, technicians, site(id), equip(id), problem(id), user(id|null)}`
- **ผู้ที่มอบหมายได้ = `technicians` = users ที่ `isTechnician && active`** (เรียงตามลำดับจาก API)
- เบอร์โทรช่าง: schema user มี `phone` (nullable) และกฎ `technicianPhoneError` — "ช่างเทคนิคต้องใส่เบอร์โทร เพื่อให้โทรตามได้เมื่อเกิดปัญหา" ใช้ในหน้าจัดการผู้ใช้ (ไม่แสดงในหน้า incident ใด ๆ)

#### `useNow(intervalMs = 30_000)` — state `Date` ที่ setInterval อัปเดตทุก 30 วิ ให้ทุก badge SLA/เวลาสัมพัทธ์เดินพร้อมกัน

#### Polling
`POLL_INTERVAL_MS = NEXT_PUBLIC_POLL_INTERVAL_MS || 30000`; `useIncidents` และ `useIncident` ใช้ `refetchInterval` นี้ และ `refetchIntervalInBackground: false` (หยุดเมื่อแท็บไม่ active). `useIncidents` ใช้ `placeholderData: keepPreviousData` (เปลี่ยนตัวกรองแล้วข้อมูลเก่าค้างจนข้อมูลใหม่มา)

#### Hooks → API
| Hook | Method / Path | Body | Invalidate หลังสำเร็จ |
|---|---|---|---|
| `useIncidents(f)` | GET `/incidents?q&status&priority&siteId&assigneeId&from&to` | – | key `['incidents','list',f]` |
| `useIncident(id)` | GET `/incidents/{id}` → IncidentDetail | – | key `['incidents','detail',id]` |
| `useSlaSettings()` | GET `/sla-settings` | – | |
| `useCreateIncident()` | POST `/incidents` | IncidentCreate | `['incidents'],['equipment'],['kpi'],['inspections']` |
| `useUpdateIncident(id)` | PATCH `/incidents/{id}` | IncidentPatch | เหมือนบน |
| `useCloseIncident(id)` | POST `/incidents/{id}/close` | `{cause, parts?, photosAfter}` | เหมือนบน |
| `useAddIncidentLog(id)` | POST `/incidents/{id}/logs` | `{message}` | `['incidents','detail',id]` |

#### กฎฝั่งเซิร์ฟเวอร์ (อ้างอิง mock `handlers.ts` — พฤติกรรมที่ UI คาดหวัง)
- **GET list**: กรอง status/priority (รายการคั่นด้วย comma), siteId, `assigneeId=none` → เฉพาะ `assigneeId === null`, from/to เทียบกับวันที่เปิด (เวลาไซต์), `q` (lower-case) ค้นใน `code + description + ชื่ออุปกรณ์ + ชื่อจุด + รหัสจุด`; มี `limit` เสริม
- **GET detail**: รับทั้ง id หรือ code; ไม่พบ → 404 "ไม่พบงานแจ้งซ่อมนี้"
- **POST create**: อุปกรณ์ต้องอยู่ในจุดที่เลือก มิฉะนั้น 400 "อุปกรณ์ไม่ตรงกับจุดที่เลือก"; ประเภทปัญหาต้อง active มิฉะนั้น 400 "ประเภทปัญหาไม่ถูกต้อง"; สร้าง `code` ถัดไป (INC-xxxx), `status 'open'`, `assigneeId null`, `slaDueAt` ตาม SLA; **side-effect: อุปกรณ์ `status='down'`, `statusNote = "แจ้งซ่อม INC-xxxx"`**; เพิ่ม log "เปิดงาน: {ชื่อประเภทปัญหา}" (source web); ถ้ามี inspectionId → push id งานเข้า `inspection.incidentIds`; ตอบ 201
- **PATCH**:
  - งาน closed/cancelled → 409 "งานนี้ปิดแล้ว แก้ไขไม่ได้" (code `CLOSED`)
  - `status: 'closed'` → 400 "ปิดงานผ่านปุ่ม \"ปิดงาน\" เพื่อบันทึกสาเหตุและรูปหลังซ่อม"
  - เปลี่ยน assignee: ต้องเป็น user ที่ `isTechnician && active` มิฉะนั้น 400 "ผู้รับผิดชอบต้องเป็นช่างที่เปิดใช้งานอยู่"; log "มอบหมายให้ {ชื่อ}" หรือ "ยกเลิกการมอบหมาย"; **ถ้ามอบหมายช่างและงานเป็น `open` (และไม่ได้ส่ง status) → auto เป็น `assigned`**
  - เปลี่ยน priority: log "เปลี่ยนความเร่งด่วน {เดิม} → {ใหม่}" และคำนวณ `slaDueAt` ใหม่
  - เปลี่ยน status: ถ้าไม่ใช่ `open`/`cancelled` และยังไม่มีผู้รับผิดชอบ → 400 "มอบหมายช่างก่อนเปลี่ยนสถานะนี้"; log "เปลี่ยนสถานะ {เดิม} → {ใหม่}"; เปลี่ยนเป็น `in_progress` ครั้งแรก → ตั้ง `respondedAt = now`
  - ท้ายทุก PATCH: `setEquipmentStatus` — ถ้าอุปกรณ์ยังมีงาน active อื่น → `down` (statusNote เดิม หรือ "ตรวจสัญญาณไม่พบ (ไม่มี heartbeat)"), ไม่มีแล้ว → `normal`, statusNote null, lastHeartbeatAt = now
- **POST close**: closed/cancelled → 409 "งานนี้ปิดไปแล้ว"; ไม่มีผู้รับผิดชอบ → 400 "มอบหมายช่างก่อนปิดงาน"; ตั้ง status closed, cause, `parts || null`, ต่อ photosAfter, `resolvedAt = now`, `respondedAt ??= now`; log "ปิดงาน: {cause}"; setEquipmentStatus (อุปกรณ์กลับปกติถ้าไม่มีงานค้างอื่น)
- **POST logs**: message trim min1 "พิมพ์ข้อความก่อนบันทึก", max 1000; ตอบ 201 log ใหม่ (source web)
- **สรุป transition ที่ UI อนุญาต**: open ↔ assigned ↔ in_progress ↔ waiting_parts เลือกได้อิสระ (ทุกทิศ) เมื่อมีผู้รับผิดชอบ; ไม่มีผู้รับผิดชอบเลือกได้แค่ `open`; `closed` ได้ทางปุ่มปิดงานเท่านั้น (ต้องมีผู้รับผิดชอบ); `cancelled` ได้ทาง ConfirmDialog (ไม่ต้องมีผู้รับผิดชอบ); closed/cancelled เป็นสถานะสุดท้าย แก้ไม่ได้
- **ผลต่อ Dashboard**: งานสถานะ `in_progress` ทำให้ช่องทางแสดง “ปิดตรวจสอบ” ใน Dashboard ผู้บริหาร (ตามข้อความ hint)

---

### B.1 `/incidents` — รายการงานแจ้งซ่อม

- ไฟล์: `page.tsx` (server component, `metadata.title = 'งานแจ้งซ่อม'`) ห่อ `<Suspense>` รอบ `IncidentList` (client) เพราะใช้ `useSearchParams`
- จุดประสงค์: ดู/ค้น/กรองงานทั้งหมด เรียงงานเร่งด่วนตาม SLA ขึ้นก่อน กดแถวเพื่อเข้ารายละเอียด
- Query param: `?denied=<อะไรก็ได้>` → แสดงแถบเตือนสิทธิ์ (ถูก redirect มาจากหน้าที่ผู้ใช้ไม่มีสิทธิ์)

#### Wireframe (desktop ≥ lg)
```
งานแจ้งซ่อม                                                     [+ เปิดงานใหม่]
งานที่เกินหรือใกล้เกิน SLA เรียงขึ้นก่อน · อัปเดตอัตโนมัติทุก 30 วินาที

[! หน้าหลังบ้านใช้ได้เฉพาะผู้ดูแลระบบ]        <- เฉพาะเมื่อมี ?denied

┌──────────────────────────────────────────────────────────────────────────┐
│ [ค้างอยู่|ใกล้/เกิน SLA|ปิดแล้ว|ทั้งหมด]         [🔍 ค้นหาเลขงาน อุปกรณ์ จุด…] │
│ [ทุกสถานะ (ค้างอยู่)▾][ทุกความเร่งด่วน▾][ทุกจุด▾][ทุกผู้รับผิดชอบ▾]          │
│ [กรองตามวันที่เปิดงาน]                                      [× ล้างตัวกรอง] │
│ 12 งาน                                                                    │
├──────────────────────────────────────────────────────────────────────────┤
│ เลขงาน │ จุด / อุปกรณ์ │ ปัญหา        │ ความเร่งด่วน│ สถานะ │ ผู้รับผิดชอบ │   SLA │
│ INC-0012│ ไม้กั้น A1   │ ไม้กั้นค้าง   │ [สูง]      │[เปิด] │ ยังไม่มอบหมาย│[เกิน 2 ชม.]│ <- พื้นแดงอ่อน
│         │ ป้อม 1 ทางเข้า│ เปิด 3 ชม. ที่แล้ว │        │       │              │        │
│ ...                                                       (หน้าละ 25)     │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Mobile (< sm / < lg)
```
งานแจ้งซ่อม                 [+ เปิดงานใหม่]
คำอธิบาย…
┌────────────────────────────────┐
│ [ค้างอยู่|ใกล้/เกิน SLA|ปิดแล้ว|ทั้ง… ] (scroll แนวนอน)
│ [🔍 ค้นหา…                      ]
│ [⚙ ตัวกรอง (2)]                 │  <- เฉพาะ < sm; กดเพื่อเปิด/ปิด grid 2 คอลัมน์
│ [สถานะ▾]      [ความเร่งด่วน▾]     │
│ [จุด▾]        [ผู้รับผิดชอบ▾]     │
│ [กรองตามวันที่เปิดงาน  (col-span-2)]│
│ [× ล้างตัวกรอง]                  │
│ 12 งาน                           │
├────────────────────────────────┤
│ INC-0012 ไม้กั้น A1   [เกิน 2 ชม.]│  <- การ์ด (cardsBelow="lg")
│ ไม้กั้นค้าง · ยังไม่มอบหมาย        │
│ [สูง] [เปิด]                      │
└────────────────────────────────┘
```

#### Page header (`PageHeader`)
- title: "งานแจ้งซ่อม"
- description: "งานที่เกินหรือใกล้เกิน SLA เรียงขึ้นก่อน · อัปเดตอัตโนมัติทุก 30 วินาที"
- actions: `<Link href="/incidents/new">` สไตล์ `buttonVariants({size:'md'})` (primary) ไอคอน `Plus` + "เปิดงานใหม่"

#### แถบ ?denied
`<p role="alert" class="mb-4 flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-fg">` + ไอคอน `ShieldAlert size-4` + "หน้าหลังบ้านใช้ได้เฉพาะผู้ดูแลระบบ"

#### กล่องหลัก
`div.rounded-lg.border.border-border.bg-surface` ภายในมี
1. Toolbar: `flex flex-col gap-3 border-b border-border p-3 sm:p-4`
   - แถว 1: `flex flex-col gap-3 md:flex-row md:items-center`
     - `SegmentedControl` label (aria) "มุมมองงาน", options ตามลำดับ: `active` "ค้างอยู่" (default), `attention` "ใกล้/เกิน SLA", `closed` "ปิดแล้ว", `all` "ทั้งหมด"; className `self-start overflow-x-auto max-w-full`. **เปลี่ยนมุมมองจะรีเซ็ต dropdown สถานะเป็นว่าง**
     - ช่องค้นหา: wrapper `relative md:ml-auto md:w-72`, ไอคอน `Search` ซ้าย (`absolute left-3 size-4 text-muted`), `Input type="search"` `pl-9`, placeholder "ค้นหาเลขงาน อุปกรณ์ จุด หรืออาการ", aria-label "ค้นหางาน". ค่าผ่าน `useDeferredValue(search.trim())` แล้วส่งเป็น `q` (ไม่มี debounce อื่น)
   - ปุ่ม "ตัวกรอง" (`Button variant="secondary"`, `self-start sm:hidden`, ไอคอน `SlidersHorizontal`, `aria-expanded`, `aria-controls="incident-filters"`) toggle `showFilters` (default false). ถ้ามีตัวกรองที่ใช้งาน (นับ status, priority, siteId, assigneeId, range — ไม่นับคำค้น) แสดง pill `num rounded-full bg-primary px-1.5 text-[11px] text-white` เป็นตัวเลข
   - กลุ่มตัวกรอง `#incident-filters`: class `grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center` + (`grid animate-fade-in` เมื่อ showFilters, มิฉะนั้น `hidden`) → บน ≥sm แสดงเสมอแบบ flex-wrap (เพราะ `sm:flex` override hidden)
     1. Select สถานะ (aria "สถานะ", `sm:w-40`): option แรก value "" = "ทุกสถานะ" + (ถ้ามุมมองไม่ใช่ all) " ({ชื่อมุมมอง})" เช่น "ทุกสถานะ (ค้างอยู่)"; ตามด้วยทั้ง 6 สถานะตามลำดับ `incidentStatuses`
     2. Select ความเร่งด่วน (`sm:w-40`): "ทุกความเร่งด่วน", วิกฤต, สูง, ปานกลาง, ต่ำ
     3. Select จุดติดตั้ง (`sm:w-48`): "ทุกจุด" แล้ว `<optgroup label={site.group ?? 'ไม่ระบุป้อม'}>` (กลุ่มตามลำดับที่พบใน sites — รวมจุดที่ไม่ active ด้วย) แต่ละ option = "{site.code} · ทางเข้า|ทางออก" (`direction === 'in'`)
     4. Select ผู้รับผิดชอบ (`sm:w-44`): "ทุกผู้รับผิดชอบ" (""), "ยังไม่มอบหมาย" (`none`), แล้วรายชื่อ technicians
     5. ช่วงวันที่ (`col-span-2 flex items-center gap-1`): ถ้ายังไม่ตั้ง → `Button secondary md` "กรองตามวันที่เปิดงาน" กดแล้วตั้ง `presetRange('7d')`; ถ้าตั้งแล้ว → `DateRangePicker` presets `['today','7d','30d','month']`, `maxPastDays={180}` + ปุ่ม `ghost icon-sm` ไอคอน `CalendarX2` aria-label "ล้างช่วงวันที่" (ตั้ง range = null)
     6. ถ้า `filtered` (มี q/status/priority/siteId/assigneeId/range) → `Button ghost` ไอคอน `X` "ล้างตัวกรอง" (`col-span-2 justify-self-start sm:ml-auto`) — รีเซ็ตทุกอย่างยกเว้นมุมมอง
   - ตัวนับ (เมื่อมี data): `<p class="num text-sm text-muted" aria-live="polite">{formatNumber(rows.length)} งาน</p>`
2. `StaleBanner className="m-3"` เมื่อ error แต่ยังมีข้อมูลเก่า (onRetry = refetch)
3. ถ้า error และไม่มีข้อมูล → `ErrorState error onRetry retrying={isFetching}`; มิฉะนั้น `DataTable`

#### การสร้าง filter ส่ง API
- `status`: ถ้าเลือก dropdown → `[status]` (ไม่สนมุมมอง); else มุมมอง `closed` → `['closed','cancelled']`; `all` → ไม่ส่ง; `active`/`attention` → `activeStatuses`
- `priority: [priority]`, `siteId`, `assigneeId` (รวม `none`), `from/to` จาก range
- มุมมอง `attention` (และไม่ได้เลือกสถานะ): กรองฝั่ง client เหลือเฉพาะ `slaState ∈ {breached, warning}` (คำนวณด้วย now ทุก 30 วิ)

#### DataTable
props: caption "รายการงานแจ้งซ่อม", `rows` = undefined จนกว่า lookups ready, `loading = isPending || !lk.ready` (skeleton), `rowKey id`, `rowHref /incidents/{id}`, `rowLabel "เปิดงาน {code}"`, `linkComponent=Link`, `pageSize 25`, `cardsBelow="lg"` (ต่ำกว่า lg แสดงการ์ด)

คอลัมน์ (ลำดับเริ่มต้น = ลำดับจากเซิร์ฟเวอร์ คือเรียงตาม SLA rank; คลิกหัวเพื่อ sort เฉพาะคอลัมน์ที่มี sortValue):
| id | header | cell | sort | อื่น ๆ |
|---|---|---|---|---|
| code | "เลขงาน" | `span.num.font-medium.whitespace-nowrap.text-text` = code | code | `w-28` |
| equipment | "จุด / อุปกรณ์" | บรรทัด1 `truncate font-medium` ชื่ออุปกรณ์ (หรือ "—"); บรรทัด2 `truncate text-xs text-muted` ชื่อจุด | ชื่ออุปกรณ์ | `max-w-64` |
| problem | "ปัญหา" | บรรทัด1 `truncate` ชื่อประเภทปัญหา; บรรทัด2 `truncate text-xs text-muted` "เปิด {formatRelative(openedAt, now)}" title = formatDateTime(openedAt) | – | `max-w-56` |
| priority | "ความเร่งด่วน" | `PriorityBadge` | index ใน priorities (low→critical) | |
| status | "สถานะ" | `StatusBadge` | index ใน incidentStatuses | |
| assignee | "ผู้รับผิดชอบ" | ชื่อ (`whitespace-nowrap`) หรือ `span.text-muted` "ยังไม่มอบหมาย" | ชื่อ | |
| sla | "SLA" | `SlaBadge incident now` | closed/cancelled = MAX_SAFE_INTEGER, อื่น = slaRemainingMs | `align: 'right'` |

formatRelative: <1 นาที "เมื่อสักครู่", <60 "{n} นาทีที่แล้ว", <6 ชม. "{n} ชม. ที่แล้ว", จากนั้น "เมื่อวาน HH:mm" / วันที่เต็ม เช่น "12 ต.ค. 2026 10:32"

**Row highlight (`rowClassName`)**: slaState `breached` → `bg-danger-soft/60`; `warning` → `bg-warning-soft/60`; อื่น ๆ ไม่มี

**Mobile card**:
```
<div flex-col gap-2>
  <div flex items-start justify-between gap-3>
    <div min-w-0>
      <p text-sm><span num font-medium text-muted>{code}</span> <span font-medium>{ชื่ออุปกรณ์}</span></p>
      <p truncate text-sm text-muted>{ประเภทปัญหา} · {ผู้รับผิดชอบ ?? 'ยังไม่มอบหมาย'}</p>
    </div>
    <SlaBadge class shrink-0/>
  </div>
  <div flex flex-wrap gap-1.5><PriorityBadge/><StatusBadge/></div>
</div>
```

**Empty states** (ตามลำดับเงื่อนไข):
1. `filtered` → `EmptyState icon={SearchX}` title "ไม่พบงานที่ตรงกับตัวกรอง", description "ลองเปลี่ยนคำค้นหรือล้างตัวกรอง", action `Button secondary` "ล้างตัวกรอง"
2. มุมมอง attention → title "ไม่มีงานที่ใกล้หรือเกิน SLA", description "ทุกงานยังอยู่ในเวลาที่กำหนด"
3. มุมมอง active → title "ไม่มีงานค้าง 🎉", description "เมื่อได้รับแจ้งปัญหา กด “เปิดงานใหม่” เพื่อบันทึกและมอบหมายช่าง"
4. อื่น ๆ → title "ยังไม่มีงานในมุมมองนี้"

State ทั้งหมดของหน้า (view, ตัวกรอง, ค้นหา) เก็บใน `useState` เท่านั้น — ไม่ sync ลง URL, รีเฟรชแล้วกลับ default

---

### B.2 `/incidents/new` — เปิดงานแจ้งซ่อม

- ไฟล์ `new/page.tsx` (client) ห่อ Suspense
- Query params (prefill เมื่อมาจากผลตรวจเช็กที่ไม่ผ่าน): `siteId`, `equipmentId`, `note` → description, `inspectionId`; ถ้ามี `inspectionId` → priority เริ่มต้น `'high'` (มิฉะนั้น `'medium'`). ตัวอย่าง: `/incidents/new?siteId=s1&equipmentId=e3&note=...&inspectionId=insp9`
- ไม่มี metadata title แยก

#### Wireframe
```
← งานแจ้งซ่อม
เปิดงานแจ้งซ่อม
ระบบจะออกเลขงาน INC-xxxx และตั้งอุปกรณ์เป็น “ขัดข้อง” ให้อัตโนมัติ
┌──────────────────────────── max-w-3xl ───────────────────────┐
│ (1)─ จุดที่เกิดปัญหา   CP1-IN1 · ป้อม 1 ทางเข้า                  │
│ │   ป้อม 1                                                     │
│ │   [IN1      ][IN2  ⚠1][OUT1     ][OUT2     ]   (2/3/4 คอลัมน์) │
│ │   ทางเข้า    ทางเข้า    ทางออก     ทางออก                       │
│ (2)─ อุปกรณ์   ไม้กั้น A1                                        │
│ │   [ไม้กั้น A1 / ไม้กั้น      [ปกติ]][กล้อง LPR / … [เสีย]]       │
│ │   อุปกรณ์นี้มีงานซ่อมเปิดอยู่แล้ว ตรวจสอบก่อนว่าไม่ใช่การแจ้งซ้ำ        │
│ (3)─ ประเภทปัญหาและความเร่งด่วน   ไม้กั้นค้าง                       │
│ │   (ไม้กั้นค้าง) (ไม่ยก) (อื่น ๆ)        <- pill                    │
│ │   ความเร่งด่วน  [ต่ำ|ปานกลาง|สูง|วิกฤต]                          │
│ (4)  รายละเอียดและรูป                                           │
│     อาการที่พบ *  [textarea 4 แถว]                               │
│     เช่น ไม้กั้นค้างไม่ยกตั้งแต่ 9 โมง รถต่อคิว 10 คัน                 │
│     รูปก่อนซ่อม (ไม่บังคับ)  [PhotoUploader]                       │
│ [ข้อความ error จากเซิร์ฟเวอร์]                                    │
│ ─────────────────────────────────────────────────────────── │
│                          [ยกเลิก] [เปิดงานและตั้งอุปกรณ์เป็นขัดข้อง] │
└─────────────────────────────────────────────────────────────┘
```

#### Header
- back: `Link /incidents` class `mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-text` + `ArrowLeft size-4` + "งานแจ้งซ่อม"
- title: "เปิดงานแจ้งซ่อม"
- description: มี inspectionId → "สร้างจากผลตรวจเช็กที่ไม่ผ่าน ข้อมูลจุดและอุปกรณ์กรอกให้แล้ว"; ไม่มี → "ระบบจะออกเลขงาน INC-xxxx และตั้งอุปกรณ์เป็น “ขัดข้อง” ให้อัตโนมัติ"

#### Container
`div.max-w-3xl.rounded-lg.border.border-border.bg-surface.p-4.sm:p-6`
- lookups ยังไม่ ready → `div.space-y-3` มี `Skeleton h-6 w-40` + `Skeleton h-28 w-full`
- `lk.sites.length === 0` → `ErrorState` ข้อความ "ยังไม่มีจุดติดตั้ง ให้ผู้ดูแลระบบเพิ่มในหลังบ้านก่อน" (ไม่มีปุ่ม retry)
- มิฉะนั้น `IncidentForm`

#### Submit flow
`create.mutate(value)` → สำเร็จ: toast title "เปิดงาน {inc.code} แล้ว", description "มอบหมายช่างได้จากหน้านี้" แล้ว `router.push('/incidents/{inc.id}')`. ล้มเหลว: ส่ง `serverError = errorMessage(create.error)` ให้ฟอร์มแสดง. ยกเลิก → `router.back()`. ระหว่างส่ง `submitting = create.isPending`

#### `IncidentForm` (`components/incident-form.tsx`)
Props: `sites, equipment, problems, initial?, submitting?, serverError?, onSubmit, onCancel?`
State เริ่มต้น: `{siteId: initial ?? '', equipmentId ?? '', problemTypeId ?? '', priority ?? 'medium', description ?? '', photosBefore ?? [], inspectionId ?? null}`

`<form noValidate class="pl-3">` — wizard แบบ **progressive disclosure**: ขั้นถัดไปปรากฏเมื่อเลือกขั้นก่อนแล้ว (ขั้นที่ 1 เสมอ; 2 เมื่อมี site; 3 เมื่อมี equipment; 4 เมื่อมี problem)

**`Step` component**: `fieldset.relative.border-l-2.border-border.pb-8.pl-6.last:border-transparent.last:pb-0` (เส้นแนวตั้งเชื่อมขั้น); วงกลมเลข `num absolute top-0 -left-[13px] grid size-6 place-items-center rounded-full text-xs font-semibold ring-4 ring-bg` — done: `bg-primary text-on-primary` แสดงไอคอน `Check size-3.5`; ยังไม่ done: `bg-surface-2 text-muted` แสดงเลข; legend `float-left mb-3 w-full` = `span.font-semibold` title + (ถ้ามี) `span.ml-2.text-sm.text-muted` summary; เนื้อหาใน `div.clear-both`

**ปุ่มตัวเลือก (`choice`)**: `flex w-full items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:border-border-strong hover:bg-surface-hover aria-checked:border-primary aria-checked:bg-primary-soft aria-checked:ring-1 aria-checked:ring-primary` — เป็น `button type=button role=radio aria-checked`

1. **ขั้น 1 "จุดที่เกิดปัญหา"** — done เมื่อเลือก site; summary "{code} · {name}"
   - `div role=radiogroup aria-label="จุดติดตั้ง" flex-col gap-4`; จัดกลุ่ม `groupSites`: เฉพาะ `site.active` กลุ่มตาม `site.group ?? 'ไม่ระบุป้อม'` (ลำดับตามที่พบ)
   - หัวกลุ่ม `p.mb-1.5.text-xs.font-medium.text-muted`; grid `grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4`
   - ปุ่ม: บรรทัด1 `font-medium` = `code.replace(/^CP\d-/, '')` (ตัด prefix ป้อม); บรรทัด2 `text-xs text-muted truncate` "ทางเข้า"/"ทางออก"; ถ้ามีอุปกรณ์ status `down` ในจุดนั้น → ขวา `num text-xs text-danger-fg` ไอคอน `TriangleAlert size-3.5` + จำนวน; aria-label "{code} {name}[ ขัดข้อง {n}]"
   - คลิก: ตั้ง siteId, ล้าง equipmentId และ problemTypeId, ล้าง errors ทั้งหมด
   - error: `p.mt-2.text-sm.text-danger-fg role=alert`
2. **ขั้น 2 "อุปกรณ์"** — summary ชื่ออุปกรณ์
   - radiogroup aria "อุปกรณ์" `grid grid-cols-1 gap-2 sm:grid-cols-2`; อุปกรณ์ทั้งหมดที่ `siteId` ตรง
   - ปุ่ม: `truncate font-medium` ชื่อ + `text-muted` `equipmentTypeLabel[type]`; ขวา `EquipmentBadge` (ปกติ success / ค้าง warning / เสีย danger)
   - คลิก: ตั้ง equipmentId, ล้าง problemTypeId
   - ถ้าอุปกรณ์ที่เลือก status `down` → `p.mt-2.text-sm.text-warning-fg` "อุปกรณ์นี้มีงานซ่อมเปิดอยู่แล้ว ตรวจสอบก่อนว่าไม่ใช่การแจ้งซ้ำ" (เตือนเท่านั้น ไม่บล็อก)
3. **ขั้น 3 "ประเภทปัญหาและความเร่งด่วน"** — summary ชื่อปัญหา
   - radiogroup aria "ประเภทปัญหา" `flex flex-wrap gap-2`; ตัวเลือก = problems ที่ `active && (equipmentType === null || equipmentType === eq.type)`
   - pill: `rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-sm hover:bg-surface-hover aria-checked:border-primary aria-checked:bg-primary aria-checked:text-on-primary`
   - ด้านล่าง `mt-4 flex-col gap-1.5`: ป้าย `text-sm font-medium` "ความเร่งด่วน" + `SegmentedControl` (label "ความเร่งด่วน") ตัวเลือก ต่ำ, ปานกลาง, สูง, วิกฤต; default ปานกลาง (หรือ สูง เมื่อมาจากผลตรวจ)
4. **ขั้น 4 "รายละเอียดและรูป"** (done=false เสมอ)
   - `Field label="อาการที่พบ" required` hint "เช่น ไม้กั้นค้างไม่ยกตั้งแต่ 9 โมง รถต่อคิว 10 คัน" → `Textarea rows=4`
   - ป้าย `text-sm font-medium` "รูปก่อนซ่อม (ไม่บังคับ)" + `PhotoUploader` (max 6 ตาม schema)

ท้ายฟอร์ม:
- serverError → `p role=alert mt-6 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-fg`
- แถวปุ่ม `mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end`: `Button secondary` "ยกเลิก" (disabled ขณะส่ง) + `Button type=submit` "เปิดงานและตั้งอุปกรณ์เป็นขัดข้อง" (`loading=submitting`, **disabled จนกว่าจะเลือกประเภทปัญหา**) — มือถือปุ่มเต็มกว้างซ้อน โดยปุ่มหลักอยู่บน

Validation: submit → `incidentCreateSchema.safeParse`; ผิด → ตั้ง error รายฟิลด์ (ข้อความแรกของแต่ละฟิลด์) แสดงใต้ขั้นที่เกี่ยวข้อง/ใน Field; แก้ค่าฟิลด์ใดจะล้าง error ของฟิลด์นั้น

---

### B.3 `/incidents/[id]` — รายละเอียดงาน

- ไฟล์ `[id]/page.tsx` (client) `params: Promise<{id}>` ใช้ `use(params)`
- ข้อมูล: `useIncident(id)` (poll 30 วิ), `useLookups()`, `useSlaSettings()`, `useNow()`

#### Wireframe (≥ lg: 2 คอลัมน์ `minmax(0,1fr)_340px`)
```
← งานแจ้งซ่อม
INC-0012  ไม้กั้น A1 (สีเทา)
[เปิด] [สูง] [เหลือ 3 ชม. 20 นาที]
┌───────────────────────────────────────┐  ┌──────────────────────┐
│ รายละเอียด                              │  │ มอบหมายช่าง           │
│ ไม้กั้นค้างไม่ยก…                         │  │ [— ยังไม่มอบหมาย — ▾] │
│ 🔍 เปิดจากผลตรวจเช็ก ดูผลตรวจ            │  │ [      มอบหมาย      ] │
│ ───────────────────────────────────── │  │ ช่างจะเห็นงานใน LINE… │
│ จุด            อุปกรณ์                   │  │ ──────────────────── │
│ CP1-IN1 · …    ไม้กั้น A1               │  │ สถานะ      ความเร่งด่วน│
│ ประเภทปัญหา    ผู้รับผิดชอบ               │  │ [เปิด ▾]   [สูง ▾]    │
│ เปิดงาน        ครบกำหนด SLA             │  │ hint…                │
│ ช่างตอบรับ     ปิดงาน                    │  │ มอบหมายช่างก่อนจึง…   │
│ [สาเหตุ | อะไหล่ที่ใช้]  (เฉพาะ closed)   │  │ ──────────────────── │
└───────────────────────────────────────┘  │ [✔ ปิดงาน]            │
┌──────────────────┬────────────────────┐  │ ยกเลิกงาน (แจ้งซ้ำ/…) │
│ รูปก่อนซ่อม       │ รูปหลังซ่อม          │  └──────────────────────┘
│ [img][img][img]  │ [img]               │      (sticky top-8)
└──────────────────┴────────────────────┘
┌───────────────────────────────────────┐
│ ความคืบหน้า            📱 = ช่างอัปเดตจาก LINE│
│ [textarea บันทึกความคืบหน้า…]            │
│                               [➤ บันทึก]│
│ (🖥)─ สมชาย  2 นาทีที่แล้ว                │
│ │    มอบหมายให้ …                        │
│ (📱)─ ช่างเอ [LINE] 1 ชม. ที่แล้ว         │
└───────────────────────────────────────┘
```
< lg: คอลัมน์เดียว ลำดับ รายละเอียด → รูป → ความคืบหน้า → แผงจัดการ (อยู่ล่างสุด, ไม่ sticky)

#### Back link (ใช้ทุกสถานะ)
`Link /incidents` `mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-text` + `ArrowLeft size-4` "งานแจ้งซ่อม"

#### Loading (`q.isPending || !lk.ready`)
back + `Skeleton mb-6 h-8 w-72` + `grid gap-5 lg:grid-cols-[1fr_340px]` มี `Skeleton h-96` และ `Skeleton h-72`

#### Error / ไม่พบ (ไม่มี data)
back + `div.rounded-lg.border.border-border.bg-surface` ภายใน:
- `ApiError` status 404 → `ErrorState` ข้อความ "ไม่พบงานนี้ อาจถูกลบหรือพิมพ์ลิงก์ผิด" (ไม่มี retry)
- อื่น → `ErrorState error onRetry retrying`
- ถ้ามี data แต่ refetch error → `StaleBanner className="mb-4"` ใต้ header

#### Header
- title: `span.flex.flex-wrap.items-center.gap-x-3.gap-y-1` = `span.num` code + `span.text-muted.font-normal` ชื่ออุปกรณ์
- description: `span.mt-1.flex.flex-wrap.items-center.gap-1.5` = `StatusBadge`, `PriorityBadge`, `SlaBadge`
- `span.sr-only aria-live=polite` "สถานะ {statusLabel}" ท้ายหน้า (ประกาศเมื่อสถานะเปลี่ยนจากการ poll)

#### Layout
`div.grid.items-start.gap-5.lg:grid-cols-[minmax(0,1fr)_340px]` — ซ้าย `flex min-w-0 flex-col gap-5`

**Section "รายละเอียด"** (`rounded-lg border border-border bg-surface p-4 sm:p-5`, h2 `mb-3 font-semibold`):
- description `mb-4 whitespace-pre-line text-sm leading-relaxed`
- ถ้ามี inspectionId: `p.mb-4.flex.items-center.gap-1.5.text-sm.text-muted` ไอคอน `FileSearch size-4` "เปิดจากผลตรวจเช็ก " + `Link /inspections/{inspectionId}` class `text-primary-fg underline` "ดูผลตรวจ"
- `dl` `grid grid-cols-1 gap-x-6 gap-y-2.5 border-t border-border pt-4 text-sm sm:grid-cols-2`; แต่ละรายการ `div.flex.gap-3.sm:block` / `dt.w-28.shrink-0.text-muted.sm:w-auto` / `dd.num.min-w-0` (มือถือ: label ซ้าย value ขวา; ≥sm: label บน value ล่าง) ลำดับ:
  1. "จุด" — "{site.code} · {site.name}" หรือ "—"
  2. "อุปกรณ์" — ชื่อ หรือ "—"
  3. "ประเภทปัญหา" — ชื่อ หรือ "—"
  4. "ผู้รับผิดชอบ" — ชื่อ หรือ `span.text-muted` "ยังไม่มอบหมาย"
  5. "เปิดงาน" — formatDateTime(openedAt)
  6. "ครบกำหนด SLA" — "{formatDateTime(slaDueAt)} (แก้ไขภายใน {formatDuration(slaFor(priority, slaSettings).resolveMinutes)})"
  7. "ช่างตอบรับ" — formatDateTime(respondedAt) หรือ "—"
  8. "ปิดงาน" — formatDateTime(resolvedAt) หรือ "—"
- ถ้า status `closed`: `div.mt-4.grid.gap-2.5.rounded-md.bg-success-soft.p-3.text-sm.sm:grid-cols-2` สองช่อง: ป้าย `block text-xs text-success-fg` "สาเหตุ" + cause; "อะไหล่ที่ใช้" + (parts || "ไม่ได้เปลี่ยนอะไหล่")

**Section รูปภาพ** (aria-label "รูปภาพ", `grid gap-5 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 sm:p-5`): สองคอลัมน์ h2 `mb-3 text-sm font-semibold` "รูปก่อนซ่อม" / "รูปหลังซ่อม" แต่ละอันมี `PhotoGallery photos label className="sm:grid-cols-3"` (empty state ของ gallery อยู่ใน component catalog)

**Timeline** (ดู B.3.2)

**ขวา: `ActionPanel`** `key="{id}:{status}"` (remount เมื่อสถานะเปลี่ยน → รีเซ็ต dropdown มอบหมายให้ตรงค่าใหม่)

#### B.3.1 ActionPanel (`action-panel.tsx`)

**งาน closed/cancelled** → `aside.flex.flex-col.items-center.gap-2.rounded-lg.border.border-border.bg-surface.p-5.text-center.lg:sticky.lg:top-8`: ไอคอน `Lock size-5 text-muted`, `p.font-medium` "งานนี้{statusLabel}แล้ว" (→ "งานนี้ปิดงานแล้ว" / "งานนี้ยกเลิกแล้ว"), `p.text-sm.text-muted` "แก้ไขไม่ได้ หากปัญหาเกิดซ้ำให้เปิดงานใหม่"

**งานยังเปิด** → `aside aria-label="จัดการงาน"` `flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 sm:p-5 lg:sticky lg:top-8` แบ่ง 3 ส่วน (ส่วน 2–3 มี `border-t border-border pt-5`):

1. **มอบหมาย** (`flex-col gap-2`)
   - `Field label="มอบหมายช่าง"` → Select: "— ยังไม่มอบหมาย —" ("") + technicians; ค่าเริ่มต้น = assigneeId ปัจจุบัน; disabled ขณะ `update.isPending`
   - ปุ่ม: variant `secondary` ถ้ามีผู้รับผิดชอบแล้ว ไม่งั้น `primary`; ข้อความ "เปลี่ยนผู้รับผิดชอบ" / "มอบหมาย"; disabled เมื่อค่าเลือก = ค่าปัจจุบัน; loading เมื่อ pending และ mutation นั้นมี assigneeId
   - กด → PATCH `{assigneeId: value || null}`; toast สำเร็จ "มอบหมายให้ {ชื่อ} แล้ว" หรือ "ยกเลิกการมอบหมายแล้ว"
   - `p.text-xs.text-muted` "ช่างจะเห็นงานใน LINE ทันทีหลังมอบหมาย"
2. **สถานะ / ความเร่งด่วน** (`grid grid-cols-2 gap-3`)
   - `Field label="สถานะ"` hint: ถ้า in_progress "ช่องทางนี้แสดงว่า “ปิดตรวจสอบ” ใน Dashboard จนกว่างานจะเปลี่ยนสถานะ" มิฉะนั้น "ตั้งเป็น “กำลังดำเนินการ” เมื่อช่างเข้าหน้างาน ช่องทางจะปิดใน Dashboard"; Select value = status ปัจจุบัน, options `manualStatuses` = เปิด, มอบหมายแล้ว, กำลังดำเนินการ, รออะไหล่ — ทุกตัวยกเว้น "เปิด" `disabled` เมื่อยังไม่มีผู้รับผิดชอบ. เปลี่ยนแล้ว PATCH `{status}` ทันที (ไม่มีปุ่มยืนยัน); toast "เปลี่ยนสถานะเป็น “{label}” แล้ว"
   - `Field label="ความเร่งด่วน"` Select วิกฤต/สูง/ปานกลาง/ต่ำ; เปลี่ยนแล้ว PATCH `{priority}`; toast "เปลี่ยนความเร่งด่วนเป็น “{label}” แล้ว" (เซิร์ฟเวอร์คำนวณ slaDueAt ใหม่)
   - ทั้งสอง disabled ขณะ update pending
   - ถ้ายังไม่มีผู้รับผิดชอบ: `p.col-span-2.text-xs.text-muted` "มอบหมายช่างก่อนจึงเปลี่ยนเป็นสถานะอื่นได้"
   - PATCH ใดล้มเหลว → toast tone error title "บันทึกไม่สำเร็จ" description = errorMessage
3. **ปิด/ยกเลิก** (`flex-col gap-2`)
   - `CloseDialog` (ด้านล่าง)
   - `ConfirmDialog` trigger `Button ghost text-muted` "ยกเลิกงาน (แจ้งซ้ำ/แจ้งผิด)"; title "ยกเลิกงาน {code}?"; description "งานจะไม่ถูกนับใน KPI และอุปกรณ์จะกลับเป็นปกติถ้าไม่มีงานอื่นค้าง"; confirmLabel "ยกเลิกงาน"; onConfirm คืน Promise → PATCH `{status:'cancelled'}`; toast สำเร็จ "ยกเลิกงาน {code} แล้ว"; ล้มเหลว toast error "ยกเลิกไม่สำเร็จ" + errorMessage; resolve เมื่อ settled (dialog ปิด)

**CloseDialog**
- trigger `Button variant=primary` ไอคอน `CircleCheckBig` "ปิดงาน"; **disabled ถ้ายังไม่มีผู้รับผิดชอบ** พร้อม title tooltip "มอบหมายช่างก่อนปิดงาน"
- `Dialog` ปิดไม่ได้ระหว่าง `close.isPending`
- `DialogContent` title "ปิดงาน {code}", description "บันทึกสาเหตุและแนบรูปหลังซ่อม อุปกรณ์จะกลับเป็น “ปกติ”"
- body `flex-col gap-4`:
  - `Field label="สาเหตุของปัญหา" required` → Textarea rows 3 placeholder "เช่น เซนเซอร์ลูปเสื่อม เปลี่ยนใหม่แล้ว" (prefill `incident.cause ?? ''`)
  - `Field label="อะไหล่ที่ใช้"` hint "เว้นว่างได้ถ้าไม่ได้เปลี่ยนอะไหล่" → Input placeholder "เช่น เซนเซอร์ลูป 1 ชุด" (prefill parts)
  - ป้าย `text-sm font-medium` "รูปหลังซ่อม" + `span.text-danger-fg` "*" ; `PhotoUploader label="แนบรูปหลังซ่อม" error`
  - close error → `p role=alert rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-fg` errorMessage
- footer: `DialogClose` `Button secondary` "ยกเลิก" (disabled ขณะ pending) + `Button` "ยืนยันปิดงาน" (loading)
- submit: `incidentCloseSchema.safeParse({cause, parts, photosAfter})` → error ที่ cause ("ระบุสาเหตุของปัญหา") / photosAfter ("แนบรูปหลังซ่อมอย่างน้อย 1 รูป"); แก้ฟิลด์ล้าง error; สำเร็จ POST close → ปิด dialog + toast "ปิดงาน {code} แล้ว" description "{ชื่ออุปกรณ์} กลับเป็นปกติ"

#### B.3.2 Timeline (`timeline.tsx`)
`section aria-labelledby="timeline"` `rounded-lg border border-border bg-surface p-4 sm:p-5`
- หัว `mb-4 flex items-center justify-between gap-3`: h2 `font-semibold` "ความคืบหน้า"; ขวา `p.flex.items-center.gap-1.5.text-xs.text-muted` ไอคอน `Smartphone size-3.5` + " = ช่างอัปเดตจาก LINE"
- ฟอร์ม (แสดงเมื่องานยังไม่ closed/cancelled) `mb-5 flex flex-col gap-2`:
  - label sr-only "บันทึกความคืบหน้า"; `Textarea id=log rows=2 min-h-16` placeholder "บันทึกความคืบหน้า เช่น โทรประสานช่างแล้ว"; **Ctrl/⌘+Enter = ส่ง**
  - แถว `flex items-center justify-between`: ซ้าย `p.text-xs.text-danger-fg role=alert` errorMessage เมื่อ error; ขวา `Button type=submit size=sm` ไอคอน `Send` (ซ่อนขณะ loading) "บันทึก", disabled เมื่อข้อความ trim ว่าง
  - ส่ง: POST logs `{message: trim}` → สำเร็จล้าง textarea; invalidate detail (log ใหม่ขึ้นบนสุด)
- รายการ `ol.relative.flex.flex-col.gap-4` มีเส้นแนวตั้ง `before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-border`; แต่ละ `li.relative.flex.gap-3`:
  - วงกลม `z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-surface` — source `liff`: `bg-success-soft text-success-fg` ไอคอน `Smartphone size-4`; `web`: `bg-surface-2 text-muted` ไอคอน `Monitor size-4`
  - เนื้อหา `min-w-0 flex-1 pt-1`: บรรทัด `flex flex-wrap items-baseline gap-x-2 text-sm` = `font-medium` authorName, (liff) `Badge tone=success` "LINE", `time.text-xs.text-muted` formatRelative (title = formatDateTime); ข้อความ `mt-0.5 text-sm whitespace-pre-line text-text`
- ลำดับ: ใหม่สุดบนสุด (ตามที่ API ส่ง); ไม่มี empty state (งานใหม่มี log "เปิดงาน: …" เสมอ)
- log อัตโนมัติจากระบบ (ข้อความตรงตัว): "เปิดงาน: {ปัญหา}", "มอบหมายให้ {ชื่อ}", "ยกเลิกการมอบหมาย", "เปลี่ยนความเร่งด่วน {เดิม} → {ใหม่}", "เปลี่ยนสถานะ {เดิม} → {ใหม่}", "ปิดงาน: {สาเหตุ}"

---

### B.4 Navigation flows
- `/incidents` → "เปิดงานใหม่" → `/incidents/new` → submit สำเร็จ → `/incidents/{newId}` (toast); "ยกเลิก" → `router.back()`
- `/incidents` → คลิกแถว/การ์ด → `/incidents/{id}`
- `/incidents/{id}` และ `/incidents/new` → ลิงก์ "← งานแจ้งซ่อม" → `/incidents`
- `/incidents/{id}` (มี inspectionId) → "ดูผลตรวจ" → `/inspections/{inspectionId}`
- หน้าผลตรวจเช็ก (รายการไม่ผ่าน) → `/incidents/new?siteId=…&equipmentId=…&note=…&inspectionId=…` (prefill + priority สูง + description หัวหน้าต่างเปลี่ยน)
- guard สิทธิ์ redirect → `/incidents?denied=1` แสดงแถบ "หน้าหลังบ้านใช้ได้เฉพาะผู้ดูแลระบบ"
- หลัง mutation ใด ๆ ของงาน: invalidate `incidents`, `equipment`, `kpi`, `inspections` → รายการ/สถานะอุปกรณ์/KPI/ผลตรวจรีเฟรช

---

## ส่วนที่ 3 · ตรวจเช็กประจำวัน, KPI / SLA และหลังบ้าน


> ขอบเขต: `app/(protected)/inspections/**`, `kpi/page.tsx`, `kpi/sla-charts.tsx`, `admin/**`
> ทุกหน้าเป็น `'use client'` (ยกเว้น `admin/layout.tsx`, `admin/page.tsx` เป็น server component)
> ข้อความ UI ในเครื่องหมายคำพูดต้องคัดลอกตรงตัวอักษร (รวมช่องว่าง, `·`, `–`, `—`, `“ ”`)

---

### 0. ส่วนกลางที่ใช้ร่วมกัน

#### 0.1 API layer (`packages/api`)
- `request()` คืนค่าผ่าน zod schema; ทุก list/create/update/remove ของ master data ใช้ helper `crud(path, schema)`:
  - `list` → `GET {path}`; `create(body)` → `POST {path}`; `update(id, body)` → `PATCH {path}/{id}` (partial); `remove(id)` → `DELETE {path}/{id}`
- Polling "live" = `{ refetchInterval: POLL_INTERVAL_MS, refetchIntervalInBackground: false }`, `POLL_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS) || 30_000`
- mutation ทุกตัวสร้างด้วย `useInvalidating(fn, keys[])` → หลังสำเร็จ invalidate คีย์ที่ระบุ

| Hook | Method / Path | queryKey / invalidate | หมายเหตุ |
|---|---|---|---|
| `useInspections(date)` | `GET /inspections?date=YYYY-MM-DD` → `Inspection[]` | `['inspections','list',date]` | `keepPreviousData` + live |
| `useInspection(id)` | `GET /inspections/{id}` | `['inspections','detail',id]` | ไม่ poll |
| `useTechnicianKpi(range)` | `GET /kpi/technicians?from&to` → `TechnicianKpi[]` | `['kpi','technicians',from,to]` | keepPrev + live |
| `useSlaOverview(range)` | `GET /kpi/sla?from&to` → `{byPriority[], trend[]}` | `['kpi','sla',from,to]` | keepPrev + live |
| `useSlaSettings()` | `GET /sla-settings` → `SlaSetting[]` | `['sla-settings']` | |
| `useSaveSla()` | `PUT /sla-settings` body `SlaSetting[]` | inv. `['sla-settings']`,`['kpi']`,`['incidents']` | |
| `useUsers()` | `GET /users` | `['users']` | |
| `useSaveUser()` | ไม่มี id → `POST /users`; มี id → `PATCH /users/{id}` | inv. `['users']`,`['kpi']` | |
| `useResetPassword()` | `POST /users/{id}/reset-password` → `{temporaryPassword}` | ไม่ invalidate (useMutation ตรง) | |
| `useSites()` | `GET /sites` | `['sites']`, staleTime 5 นาที | |
| `useSaveSite()` | `POST /sites` / `PATCH /sites/{id}` | inv. `['sites']`,`['equipment']`,`['dashboard']` | |
| `useEquipment()` | `GET /equipment` | `['equipment','list']`, staleTime 60s | |
| `useSaveEquipment()` | `POST /equipment` / `PATCH /equipment/{id}` | inv. `['equipment']` | |
| `useDeleteEquipment()` | `DELETE /equipment/{id}` | inv. `['equipment']` | |
| `useChecklists()` | `GET /checklist-templates` | `['checklist-templates']` | |
| `useSaveChecklist()` | `POST /checklist-templates` / `PATCH /checklist-templates/{id}` | inv. `['checklist-templates']` | |
| `useProblemTypes()` | `GET /problem-types` | `['problem-types']`, staleTime 5 นาที | |
| `useSaveProblemType()` | `POST /problem-types` / `PATCH /problem-types/{id}` | inv. `['problem-types']` | |
| `useDeleteProblemType()` | `DELETE /problem-types/{id}` | inv. `['problem-types']` | |

`useLookups()` (`apps/service/lib/lookups.ts`): รวม `useSites/useEquipment/useProblemTypes/useUsers` → `{ ready (ทั้ง 4 โหลดเสร็จ), sites, equipment, problems, users, technicians (isTechnician && active), site(id), equip(id), problem(id), user(id) }`

#### 0.2 Label / enum (`packages/api/src/labels.ts`, schemas)
- `priorities = ['low','medium','high','critical']`; `priorityLabel`: low "ต่ำ", medium "ปานกลาง", high "สูง", critical "วิกฤต"
- `equipmentTypes` (ลำดับนี้ใช้ทุกที่): `esp, controller, computer, barrier, ticket, payment, kiosk, lpr, face, qr, notouch, loop, radar, intercom`
- `equipmentTypeLabel`: esp "บอร์ดควบคุม ESP", controller "บอร์ดควบคุม", computer "คอมพิวเตอร์", barrier "ไม้กั้น", ticket "ตู้จ่ายสลิป (Kiosk Entrance)", payment "ตู้ชำระเงิน (Kiosk Exit)", kiosk "Kiosk Payment", lpr "กล้องอ่านป้ายทะเบียน", face "กล้องจับใบหน้า", qr "เครื่องอ่าน QR", notouch "เซ็นเซอร์ไม่สัมผัส", loop "Loop Sensor", radar "เรดาร์", intercom "Intercom"
- `directionLabel = { in: 'ทางเข้า', out: 'ทางออก' }`
- `KIOSK_ZONE_ID = 'kiosk'` (Kiosk Payment ไม่สังกัดป้อม ใช้ค่านี้เป็น `siteId`)
- `DEFAULT_SLA` (ค่าชั่วคราว): critical 15/240, high 30/480, medium 60/1440, low 240/4320 (response/resolve นาที); `slaFor(priority, settings)` หา setting ตาม priority ไม่เจอ fallback DEFAULT_SLA
- วันที่: `toSiteDate(Date)` → `YYYY-MM-DD` เขตเวลา `Asia/Bangkok`; `addDays(iso, n)`; `presetRange('7d'|'30d'|'month'|...)` — 7d = วันนี้-6..วันนี้, 30d = วันนี้-29..วันนี้, month = วันที่ 01 ของเดือน..วันนี้
- `formatDuration(min)`: <1 → "ไม่ถึง 1 นาที"; <60 → "N นาที"; มีวัน → "D วัน H ชม." หรือ "D วัน"; อื่น ๆ → "H ชม. M นาที" หรือ "H ชม."
- `formatPercent(v, {digits})` → `"{v.toFixed(digits)}%"`

#### 0.3 Validation schemas (ข้อความ verbatim)
**`userInputSchema`**
- `employeeCode`: trim, min 2 "กรอกรหัสพนักงานอย่างน้อย 2 ตัวอักษร", max 20 "รหัสพนักงานยาวเกิน 20 ตัวอักษร", regex `/^[A-Za-z0-9_-]+$/` "ใช้ได้เฉพาะ A–Z, 0–9, - และ _"
- `name`: trim, min 1 "กรอกชื่อ-นามสกุล"
- `role`: enum `executive|admin|operator`; `isTechnician`: boolean
- `position`: trim, max 60, nullable optional (ไม่มีข้อความกำหนดเอง → ข้อความ default ของ zod)
- `phone`: trim, regex `/^[0-9+\-\s]{0,20}$/` "เบอร์โทรใช้ได้เฉพาะตัวเลข + - และช่องว่าง", nullable optional
- `password`: min 8 "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร", optional
- `technicianPhoneError({isTechnician, phone})` → ถ้า isTechnician และ phone (ตัดช่องว่าง/ขีด) ว่าง คืน `TECH_PHONE_REQUIRED` = "ช่างเทคนิคต้องใส่เบอร์โทร เพื่อให้โทรตามได้เมื่อเกิดปัญหา" ไม่งั้น `null`

**`siteInputSchema`** (= siteSchema ไม่มี id): `code` min1 "กรอกรหัสจุด", `name` min1 "กรอกชื่อจุด", `direction` `in|out`, `group` string|null, `active` boolean
**`equipmentInputSchema`**: `siteId`, `type` (enum equipmentTypes), `name` min1 "กรอกชื่ออุปกรณ์"
**`problemTypeInputSchema`**: `name` min1 "กรอกชื่อประเภทปัญหา", `equipmentType` enum|null, `active` boolean
**`checklistTemplateSchema`**: `items[].label` trim min1 "กรอกหัวข้อตรวจ", items min 1 "ต้องมีหัวข้อตรวจอย่างน้อย 1 ข้อ"
**`slaSettingSchema`**: `responseMinutes`/`resolveMinutes` int positive "ต้องมากกว่า 0 นาที"

#### 0.4 Data types
- `Inspection { id, siteId, equipmentId, inspectorId, inspectorName, date (YYYY-MM-DD), inspectedAt (ISO), results: {itemId,label,pass,note|null,photo|null}[], incidentIds: string[] }`
- `TechnicianKpi { user: User, total, closed, open, avgResponseMinutes|null, avgResolveMinutes|null, slaMet, slaMeasured }`
- `SlaOverview { byPriority: {priority,measured,met}[], trend: {date,measured,met}[] }`
- `User { id, employeeCode, name, role, isTechnician, position|null, phone|null, active }`
- `Site { id, code, name, direction, group|null, active }`; `Equipment { id, siteId, type, name, status: normal|stuck|down, statusNote|null, ... }`

#### 0.5 คอมโพเนนต์ `@gip/ui` ที่ใช้ (อธิบายรายละเอียดในสเปกแค็ตตาล็อก)
`PageHeader {title, description, actions, back}`, `Panel {title, description, className, bodyClassName}`, `DataTable {caption, columns, rows, loading, rowKey, initialSort, mobileCard, empty}` (คลิกหัวคอลัมน์ที่มี `sortValue` เพื่อเรียง; จอเล็กแสดงเป็น `mobileCard`), `Dialog/DialogContent {title, description, footer, size}`, `DialogClose`, `ConfirmDialog {trigger, tone, title, description, confirmLabel, onConfirm}` (onConfirm คืน Promise; ปุ่มยกเลิกใช้ default ของคอมโพเนนต์), `Field {label, required, hint, error, className}`, `Input`, `Select` (native `<option>`), `Switch {label, description}`, `Badge {tone, icon}`, `PriorityBadge`, `SegmentedControl {label, value, onChange, options}`, `DateRangePicker` (preset labels: '7d' "7 วัน", '30d' "30 วัน", month "เดือนนี้"), `Skeleton`, `EmptyState {icon, title, description, compact}`, `ErrorState {error, onRetry, retrying, compact}`, `StaleBanner`, `PhotoGallery`, `useToast()` → `toast({title, description?, tone?: 'error'})`, `errorMessage(e)`, `useUser()`, `buttonVariants`
- โทนสี: token `success/warning/danger/primary` พร้อม `-soft`, `-fg`; พื้น `bg`, `surface`, `surface-2`, `surface-hover`; ขอบ `border`, `border-strong`; ข้อความ `text`, `muted`
- คลาส `num` = ตัวเลข tabular

---

### 1. `/inspections` — ตรวจเช็กประจำวัน

**ไฟล์**: `app/(protected)/inspections/page.tsx` — `InspectionsPage`
**จุดประสงค์**: ดูผลตรวจเช็กประจำวันที่ช่างส่งผ่าน LINE ของวันที่เลือก จัดกลุ่มตามป้อม → ช่องทาง (site) → อุปกรณ์

#### 1.1 State & data
- `today = toSiteDate(new Date())`; `date` เริ่มต้น = `today`
- `q = useInspections(date)`; `lk = useLookups()`
- `groups`: ไซต์ที่ `active` เท่านั้น (ตามลำดับ `lk.sites`) → `items` = อุปกรณ์ทุกตัวของไซต์ (`e.siteId === site.id`) จับคู่ inspection ด้วย `equipmentId`; `fails` = จำนวน results ที่ `!pass`
  - `group.done` = จำนวนอุปกรณ์ที่มีผลตรวจ; `group.fails` = ผลรวมข้อไม่ผ่าน
- สรุป: `total` (อุปกรณ์ทั้งหมด), `done`, `fails`, `sitesDone` = ไซต์ที่ `done === items.length && items.length > 0`
- `loading = q.isPending || !lk.ready`
- `filter`: `'all' | 'fail' | 'pending'` เริ่ม `'all'`; `lanesFail` = ไซต์ที่ fails>0; `lanesPending` = ไซต์ที่ done<items.length
- `visible` = กรองตาม filter; `checkpoints` = จัดกลุ่ม visible ตาม `site.group ?? 'ไม่ระบุป้อม'` (ลำดับตามที่พบครั้งแรก)
- การกาง/ย่อ: `open: Set<siteId>` — ทุกครั้งที่ `date|loading` เปลี่ยนและโหลดเสร็จ จะ seed ให้เปิดเฉพาะไซต์ที่ `fails>0 || done<items.length` (ไซต์ที่ผ่านครบย่อไว้)
- `allOpen` = visible ไม่ว่าง และทุกตัวเปิดอยู่

#### 1.2 Page header
- title: "ตรวจเช็กประจำวัน"
- description: "ผลตรวจที่ช่างส่งผ่าน LINE · ข้อที่ไม่ผ่านสร้างเป็นงานซ่อมได้ทันที"
- actions: `div.flex.items-center.gap-1`
  1. ปุ่ม `Button variant="secondary" size="icon"` ไอคอน `ChevronLeft`, aria-label "วันก่อนหน้า" → `setDate(addDays(date,-1))` (ไม่มีขอบล่าง)
  2. `Input type="date"` value=`date`, `max={today}`, aria-label "วันที่ตรวจ", class `num w-40`; onChange เปลี่ยนเฉพาะเมื่อค่าไม่ว่าง
  3. ปุ่ม `ChevronRight` aria-label "วันถัดไป", `disabled={date >= today}` → `addDays(date,1)`

#### 1.3 แถบสรุป 3 ช่อง
`<dl class="mb-5 grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-surface">` แต่ละช่อง `px-3 py-3 sm:px-5 sm:py-4`:
- `dt`: `text-xs text-muted sm:text-sm`; `dd`: `num mt-1 flex items-center gap-1.5 text-xl font-semibold sm:text-2xl` + tone

| label (dt) | ค่า | tone |
|---|---|---|
| "จุดที่ตรวจครบ" | `${sitesDone}/${groups.length}` | `text-text` เสมอ |
| "อุปกรณ์ที่ยังไม่ตรวจ" | `formatNumber(total-done)` | >0 → `text-warning-fg` |
| "ข้อที่ไม่ผ่าน" | `formatNumber(fails)` | >0 → `text-danger-fg` |

- ขณะ loading: แทนค่าด้วย `Skeleton h-7 w-14`
- ถ้า tone ไม่ใช่ `text-text` แสดงไอคอน `TriangleAlert size-5` หน้าตัวเลข

#### 1.4 เนื้อหา (ลำดับเงื่อนไข)
1. `q.isError && q.data` → `StaleBanner className="mb-4" onRetry=refetch` (แสดงด้านบน แล้วยังแสดงข้อมูลเดิมต่อ)
2. `q.isError && !q.data` → การ์ด `rounded-lg border border-border bg-surface` + `ErrorState(error, onRetry, retrying=isFetching)`
3. `loading` → `grid gap-4 md:grid-cols-2` มี `Skeleton h-64` ×4
4. `done === 0` → การ์ด + `EmptyState icon=CircleDashed`
   - title: `ยังไม่มีผลตรวจของวันที่ ${formatDate(date)}`
   - description: ถ้า date = today → "ช่างเริ่มตรวจประมาณ 7 โมงเช้า ผลจะขึ้นที่นี่อัตโนมัติ" ไม่งั้น "วันนั้นไม่มีการส่งผลตรวจ"
5. มีข้อมูล:
   - แถวเครื่องมือ `mb-4 flex flex-wrap items-center justify-between gap-3`
     - `SegmentedControl label="แสดงช่องทาง"` options ตามลำดับ: "ทั้งหมด" / `มีข้อไม่ผ่าน {lanesFail}` / `ตรวจไม่ครบ {lanesPending}` (ตัวเลขใน span `num`)
     - ปุ่ม `Button variant="ghost" size="sm"` ไอคอน `ChevronsUpDown` ข้อความ "ย่อทั้งหมด" (เมื่อ allOpen) / "ขยายทั้งหมด" — toggle เปิด/ปิดทุก visible
   - ถ้า visible ว่าง → การ์ด + `EmptyState icon=CircleCheck compact` title: filter='fail' → "ไม่มีข้อที่ไม่ผ่าน" ไม่งั้น "ทุกช่องทางตรวจครบแล้ว"
   - ไม่งั้น: `flex flex-col gap-6` → ต่อป้อม `<section aria-label={ป้อม}>`:
     - หัว `h2.mb-2.flex.items-center.gap-2.text-sm.font-semibold` ไอคอน `MapPin size-4 text-primary-fg` + ชื่อป้อม
     - กล่อง `overflow-hidden rounded-lg border border-border bg-surface` ภายในเป็น `Lane` ต่อไซต์

#### 1.5 Lane (แถวช่องทาง แบบกาง/ย่อ)
- wrapper `border-b border-border last:border-b-0`
- ปุ่มหัว (ทั้งแถว) `flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover`, `aria-expanded`, `aria-controls`
  - `ChevronDown size-4 text-muted transition-transform duration-200`; ย่ออยู่ → `-rotate-90`
  - บรรทัด 1: `{site.code}` ตัวหนา `text-sm font-semibold truncate` + `<span class="font-normal text-muted">· ทางเข้า|ทางออก</span>`
  - บรรทัด 2 (`mt-1.5 flex items-center gap-2`): progress bar `h-1 w-24 sm:w-32 rounded-full bg-surface-2` เติม `width = done/total*100%` (`transition-[width] duration-500`) สี: fails>0 `bg-danger`; ครบ `bg-success`; ไม่งั้น `bg-warning` + ข้อความ `num text-xs text-muted` "ตรวจแล้ว {done}/{total}"
  - Badge ขวา: fails>0 → `danger` ไอคอน `TriangleAlert` "ไม่ผ่าน {fails} ข้อ"; ครบ → `success` `CircleCheck` "ครบ"; อื่น → `warning` `CircleDashed` "ยังไม่ครบ"
- เมื่อเปิด: `<ul class="grid border-t border-border bg-bg animate-fade-in sm:grid-cols-2">` ต่ออุปกรณ์ `<li class="border-b border-border last:border-b-0 sm:odd:border-r">`
  - เนื้อในแถว: `flex min-h-12 items-center gap-3 py-2 pr-4 pl-11`, `title={equipment.name}`
    - บรรทัดบน `text-sm truncate`: `equipmentTypeLabel[type]`
    - บรรทัดล่าง `text-xs text-muted truncate`: มีผล → `${formatTime(inspectedAt)} · ${inspectorName}` ไม่มี → "ยังไม่มีผลตรวจ"
    - Badge: ไม่มีผล → `neutral` `CircleDashed` "ยังไม่ตรวจ"; f>0 → `danger` `TriangleAlert` "ไม่ผ่าน {f} ข้อ"; อื่น → `success` `CircleCheck` "ผ่าน"
  - มีผลตรวจ → เป็น `Link href=/inspections/{inspection.id}` + `hover:bg-surface-hover`; ถ้า f>0 พื้น `bg-danger-soft`. ไม่มีผล → `div` เฉย ๆ (คลิกไม่ได้)

#### 1.6 Wireframe
```
ตรวจเช็กประจำวัน                                    [<] [ 2026-10-23 ] [>]
ผลตรวจที่ช่างส่งผ่าน LINE · ข้อที่ไม่ผ่านสร้างเป็นงานซ่อมได้ทันที
┌───────────────┬──────────────────────┬───────────────┐
│จุดที่ตรวจครบ   │อุปกรณ์ที่ยังไม่ตรวจ      │ข้อที่ไม่ผ่าน     │
│ 5/8           │ ⚠ 12                 │ ⚠ 3           │
└───────────────┴──────────────────────┴───────────────┘
[ทั้งหมด | มีข้อไม่ผ่าน 2 | ตรวจไม่ครบ 3]                  ⇕ ย่อทั้งหมด
📍 จุดที่ 1 ป้อมจตุรทิศ
┌──────────────────────────────────────────────────────┐
│ ▾ IN-A · ทางเข้า                       [⚠ ไม่ผ่าน 2 ข้อ]│
│   ▓▓▓▓▓░░ ตรวจแล้ว 4/6                                │
│ ├────────────────────────┬───────────────────────────┤│
│ │   ไม้กั้น        [⚠ไม่ผ่าน 2 ข้อ]│  กล้องอ่านป้ายทะเบียน [✓ผ่าน]││
│ │   07:12 · สมชาย          │  07:15 · สมชาย            ││
│ └────────────────────────┴───────────────────────────┘│
│ ▸ OUT-A · ทางออก                               [✓ ครบ] │
└──────────────────────────────────────────────────────┘
```

---

### 2. `/inspections/[id]` — รายละเอียดผลตรวจ

**ไฟล์**: `inspections/[id]/page.tsx` — `InspectionPage({ params: Promise<{id}> })` ใช้ `use(params)`
- data: `useInspection(id)`, `useLookups()`
- ลิงก์ย้อนกลับ (`back`): `Link href="/inspections"` class `mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-text` ไอคอน `ArrowLeft size-4` + "ตรวจเช็กประจำวัน"

#### สถานะ
- loading (`q.isPending || !lk.ready`): back + `Skeleton mb-6 h-8 w-72` + `Skeleton h-80 max-w-3xl`
- ไม่มีข้อมูล: back + การ์ด `rounded-lg border border-border bg-surface` + `ErrorState(error,onRetry,retrying)`

#### Header
- `PageHeader back={back}`
- title: `eq?.name ?? 'ผลตรวจ'`
- description: `` `${site?.code} · ${site?.name} · ตรวจ ${formatDate(insp.date)} ${formatTime(insp.inspectedAt)} โดย ${insp.inspectorName}` ``
- actions (แสดงเฉพาะเมื่อมีข้อไม่ผ่าน `failed.length > 0`):
  - ถ้า `insp.incidentIds.length` → `Link href=/incidents/{incidentIds[0]}` สไตล์ `buttonVariants({variant:'secondary'})` ไอคอน `Wrench` "ดูงานซ่อมที่สร้างแล้ว"
  - ไม่งั้น → `Link` สไตล์ปุ่ม primary ไอคอน `Wrench` "สร้างงานซ่อมจากข้อไม่ผ่าน" → `/incidents/new?siteId=..&equipmentId=..&inspectionId=..&note=..` โดย `note = "ตรวจเช็กประจำวัน {formatDate(date)} ไม่ผ่าน: {labels คั่นด้วย ', '}"` (URLSearchParams)

#### รายการผล
`<ol class="max-w-3xl divide-y divide-border rounded-lg border border-border bg-surface">` ต่อข้อ `<li class="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">` ข้อไม่ผ่านพื้น `bg-danger-soft/40`
- เลขลำดับ `num w-6 shrink-0 text-sm text-muted` → "1."
- เนื้อหา: `p.font-medium` label; ถ้ามี note → `p.mt-0.5.text-sm.text-danger-fg`; ถ้ามี photo → `PhotoGallery photos=[photo] label className="mt-3 max-w-40 grid-cols-1 sm:grid-cols-1"`
- Badge: pass → `success` `CircleCheck` "ผ่าน"; ไม่ผ่าน → `danger` ไอคอน `X` "ไม่ผ่าน"

```
← ตรวจเช็กประจำวัน
ไม้กั้น IN-A-1                               [🔧 สร้างงานซ่อมจากข้อไม่ผ่าน]
IN-A · ทางเข้า A · ตรวจ 23 ต.ค. 2569 07:12 โดย สมชาย
┌──────────────────────────────────────────────┐
│1. ไม้กั้นยกลงปกติ                     [✓ ผ่าน] │
│2. แขนไม้กั้นไม่บิ่น                   [✕ ไม่ผ่าน]│  (พื้นแดงอ่อน)
│   แขนบิ่นปลาย                                 │
│   [รูป]                                        │
└──────────────────────────────────────────────┘
```

---

### 3. `/kpi` — KPI / SLA

**ไฟล์**: `kpi/page.tsx` (`KpiPage`) + `kpi/sla-charts.tsx`
- `range` เริ่มต้น `presetRange('30d')`
- data: `tech = useTechnicianKpi(range)`, `sla = useSlaOverview(range)`, `settings = useSlaSettings()`
- `pct(met, measured) = measured ? met/measured*100 : null`
- `totals` = ผลรวม met/measured ของ `byPriority`; `overall = pct(totals)`; `measuredDays` = จำนวนวันใน trend ที่ `measured>0`

#### เกณฑ์สี (ค่าคงที่)
- `SLA_TARGET = 90`; `slaTone(v)`: `v>=90` success, `v>=75` warning, อื่น danger
- `PctCell({value})`: null → `<span class="text-muted">—</span>`; อื่น → `num inline-flex items-center gap-1 font-medium` สี ≥90 `text-success-fg`, ≥75 `text-warning-fg`, ต่ำกว่า `text-danger-fg`; ไอคอน ≥90 `CircleCheck size-3.5` ไม่งั้น `TriangleAlert size-3.5`; ข้อความ `formatPercent(v,{digits:0})` เช่น "92%"

#### Header
- title "KPI / SLA"; description "วัดจากงานที่ปิดในช่วงที่เลือก · ยกเลิกไม่นับ"
- actions: `DateRangePicker value onChange presets={['7d','30d','month']} maxPastDays={89}`

#### Layout
`grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]` (มือถือ 1 คอลัมน์, lg ซ้าย 1/3 ขวา 2/3)

**Panel ซ้าย** title "ผ่าน SLA รวม"; description: มี totals → `${formatNumber(met)} จาก ${formatNumber(measured)} งานที่ปิด` ไม่งั้น `' '`
- pending → `Skeleton h-48`; error ไม่มีข้อมูล → `ErrorState compact`
- ไม่งั้น: `SlaRing value={overall}` จัดกลาง + `<ul class="mt-6 flex flex-col gap-3.5">` ต่อ priority (ตามลำดับที่ API ส่ง):
  - แถวบน `mb-1 flex items-baseline justify-between gap-2 text-sm`: ซ้าย `priorityLabel` + `<span class="text-xs text-muted">ภายใน {formatDuration(slaFor(p, settings.data).resolveMinutes)}</span>`; ขวา `PctCell` + `<span class="ml-2 text-xs text-muted">{met}/{measured}</span>`
  - `GrowBar value delay={250 + i*90}`

**Panel ขวา** title "% ผ่าน SLA รายวัน"; description "สีตามเกณฑ์ · จุดจาง = วันที่ไม่มีงานปิด"
- pending → `Skeleton h-[260px]`; `measuredDays < 1` → `EmptyState icon=Gauge compact` title "ยังไม่มีงานปิดในช่วงนี้" description "ลองเลือกช่วงที่ยาวขึ้น"; ไม่งั้น `SlaDailyBars days={trend}`

**Panel ล่าง** title "KPI รายช่าง" `className="mt-5"` `bodyClassName="px-0 pb-0 sm:px-0 sm:pb-0"`
- error ไม่มีข้อมูล → `ErrorState compact`
- `DataTable caption="KPI รายช่าง" rowKey=user.id initialSort={{id:'total',dir:'desc'}} loading=tech.isPending`

| id | header | align | sortValue | cell |
|---|---|---|---|---|
| name | "ช่าง" | ซ้าย | user.name | `font-medium` ชื่อ |
| total | "งานทั้งหมด" | right | total | `num` formatNumber |
| closed | "ปิดแล้ว" | right | closed | `num` |
| open | "ค้าง" | right | open | `num` |
| resp | "ตอบสนองเฉลี่ย" | right | avgResponseMinutes | formatDuration หรือ "—" (`whitespace-nowrap`) |
| resolve | "แก้ไขเฉลี่ย" | right | avgResolveMinutes | formatDuration หรือ "—" |
| sla | "% ผ่าน SLA" | right | pct(slaMet,slaMeasured) | `PctCell` |

- mobileCard: แถวบนชื่อ (`font-medium`) ซ้าย + `PctCell` ขวา; ล่าง `p.num.text-muted`: "งาน {total} · ปิด {closed} · ค้าง {open}" `<br/>` "ตอบสนองเฉลี่ย {..|—} · แก้ไขเฉลี่ย {..|—}"
- empty: `EmptyState` title "ยังไม่มีช่างในระบบ" description "เพิ่มผู้ใช้และติ๊ก “เป็นช่าง” ในหลังบ้าน"

#### 3.1 กราฟ (`sla-charts.tsx`)
- `useEntered()`: false ในเฟรมแรก → true หลัง 2× `requestAnimationFrame` (ใช้ทำแอนิเมชันเริ่มจาก 0)

**`SlaRing({value, size=168})`** — โดนัท SVG
- กล่อง `relative grid place-items-center` ขนาด 168×168; svg `viewBox 0 0 100 100` `size-full -rotate-90` (เริ่มที่ 12 นาฬิกา ตามเข็ม)
- r=42, c=2πr
- วงพื้น: stroke `var(--surface-2)` width 9
- ขีดเป้า 90%: stroke `var(--text-muted)` opacity 0.5 width 11, `strokeDasharray="0.6 c"`, `strokeDashoffset = -(c*90/100)`
- วงค่า (เมื่อ value ไม่ null): stroke ตาม tone `var(--success|--warning|--danger)`, width 9, `strokeLinecap="round"`, `dasharray=c`, `dashoffset = on ? c*(1-v/100) : c`; transition `stroke-dashoffset 1400ms cubic-bezier(0.16,1,0.3,1)`, `motion-reduce:transition-none`
- กลาง: `p.num.text-4xl.font-semibold.tracking-tight` ค่า `formatPercent(v,{digits:0})` หรือ "—" (fade-in `transition-opacity duration-700`) + `p.text-xs.text-muted` "ผ่าน SLA"

**`GrowBar({value, delay})`**: ราง `h-2 overflow-hidden rounded-full bg-surface-2`; แท่ง `h-full rounded-full` สีตาม `slaTone` (`bg-success|bg-warning|bg-danger`, null ไม่มีสี), width `on ? value% : 0%`, `transition-[width] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]`, `transitionDelay = delay ms`

**`SlaDailyBars({days})`** — แท่งแนวตั้งรายวัน (ทำด้วย div ไม่ใช่ไลบรารีกราฟ)
- `<figure>` + `figcaption.sr-only`: "{n} วันที่มีงานปิด ผ่านเป้า {m} วัน"
- แถวบน `mb-3 flex min-h-10 flex-wrap items-end justify-between gap-2`:
  - ซ้าย (`aria-live="polite"`): ไม่ hover → `p.text-xs.text-muted` "ชี้ที่แท่งเพื่อดูรายละเอียดของวัน"; hover → `p.text-xs.text-muted` "{formatWeekday(date)} {formatDate(date)}" + `p.num.text-sm.font-semibold` "{xx%} " + `<span class="font-normal text-muted">· ทัน {met} จาก {measured} งาน</span>` หรือถ้า measured=0 "ไม่มีงานปิดวันนี้"
  - ขวา legend `ul.flex.items-center.gap-3.text-xs.text-muted aria-label="คำอธิบายสี"`: สี่เหลี่ยม `size-2.5 rounded-sm` + "ผ่านเป้า ≥ 90%" (success), "75–89%" (warning), "ต่ำกว่า 75%" (danger)
- พื้นที่กราฟ `relative h-[220px] pl-9` (mouseleave → ล้าง hover)
  - เส้นกริดที่ 0%, 50%, 100%: `absolute right-0 left-9 border-t border-border` + ป้าย `num text-[11px] text-muted` "0%"/"50%"/"100%" ชิดซ้าย (`-left-9 w-7 text-right -top-2`)
  - เส้นเป้าที่ 90%: `border-t border-dashed border-success` + ป้าย "เป้า" (`-left-9 -top-2.5 w-8 rounded bg-success-soft text-[10px] font-semibold text-success-fg text-center z-10`)
  - แท่ง: `flex h-full items-end gap-[3px]`; ต่อวันเป็น `<button>` `flex-1 h-full` (focus ring `ring-2 ring-primary`), aria-label `"{formatDate}: {xx% (met/measured) | ไม่มีงานปิด}"`; hover/focus → พื้นหลัง `bg-surface-hover`
    - วันที่ไม่มีงานปิด: จุด `size-1.5 rounded-full bg-border-strong mb-0.5`
    - มีงาน: แท่ง `w-full max-w-5 rounded-t-[3px] origin-bottom` สีตาม tone, height `max(v,2)%`, `scaleY(0→1)` `duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]` delay `i*22ms` (ไล่ซ้าย→ขวา); เมื่อ hover แท่งอื่น → `opacity-50`
- แกน X: `mt-2 flex gap-[3px] pl-9` ป้าย `num text-[11px] text-muted` `formatDayMonth(date)` แสดงทุก `labelEvery = max(1, ceil(n/8))` วัน

```
KPI / SLA                                        [ 7 วัน | 30 วัน | เดือนนี้ 📅 ]
วัดจากงานที่ปิดในช่วงที่เลือก · ยกเลิกไม่นับ
┌ ผ่าน SLA รวม ───────────┐ ┌ % ผ่าน SLA รายวัน ─────────────────────────────┐
│ 45 จาก 50 งานที่ปิด       │ │ ชี้ที่แท่งเพื่อดูรายละเอียดของวัน   ■ผ่านเป้า≥90% ■75–89% ■ต่ำกว่า75% │
│      ╭───╮               │ │100%┤                                        │
│     │ 90% │              │ │เป้า┤- - - - - - - - - - - - - - - - - - - -  │
│      ╰───╯ ผ่าน SLA      │ │ 50%┤ █ █   █ █ · █ █                         │
│ วิกฤต ภายใน 4 ชม.  ✓95% 19/20│ │  0%┴─────────────────────────────────────── │
│ ▓▓▓▓▓▓▓▓▓▓▓░             │ │     24 ก.ย.     28 ก.ย. ...                  │
│ สูง ...                    │ └─────────────────────────────────────────────┘
└─────────────────────────┘
┌ KPI รายช่าง ──────────────────────────────────────────────────────────────┐
│ ช่าง │ งานทั้งหมด │ ปิดแล้ว │ ค้าง │ ตอบสนองเฉลี่ย │ แก้ไขเฉลี่ย │ % ผ่าน SLA │
└───────────────────────────────────────────────────────────────────────────┘
```

---

### 4. `/admin` — Layout และ index

- `admin/layout.tsx` (server, async): `getSession(cookie header, app)`; ถ้า `session.status !== 'ok'` หรือ `session.user.role !== 'admin'` → `redirect('/incidents?denied=admin')`; ไม่งั้นคืน children ตรง ๆ (ไม่มี chrome เพิ่ม — sidebar/nav มาจาก layout `(protected)`)
- `admin/page.tsx`: `redirect('/admin/users')`

---

### 5. `/admin/users` — ผู้ใช้งาน & สิทธิ์การเข้าถึง

#### 5.1 ระดับสิทธิ์ (`LEVELS`, ลำดับนี้)
| value | label | hint |
|---|---|---|
| admin | "ผู้ดูแลระบบ (Admin)" | "สิทธิ์สูงสุด · เข้าได้ทั้งเว็บ Service (รวมหลังบ้าน) และเว็บ Dashboard ผู้บริหาร" |
| executive | "ผู้บริหาร" | "ดูได้เฉพาะเว็บ Dashboard ผู้บริหาร · เข้าเว็บ Service ไม่ได้" |
| technician | "ช่างเทคนิค" | "รับงานซ่อมและส่งผลตรวจผ่าน LINE · นับ KPI" |
- `levelOf(u)`: role `operator` → technician; อื่นใช้ role ตรง
- `toRole(level)`: technician → `{role:'operator', isTechnician:true}`; อื่น → `{role: level, isTechnician:false}`

#### 5.2 Header
- title "ผู้ใช้งาน & สิทธิ์การเข้าถึง"; description "เพิ่มพนักงานหรือผู้ดูแลระบบ และกำหนดระดับการใช้งานระบบ"
- action: `Button` (primary) ไอคอน `Plus` "เพิ่มพนักงาน" → เปิด UserDialog โหมดเพิ่ม

#### 5.3 การ์ดนับ
`<dl class="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">` — 3 การ์ด (ตาม LEVELS) แต่ละใบ `rounded-lg border border-border bg-surface px-4 py-3`; `dt.text-sm.text-muted` = label; `dd.num.mt-1.text-2xl.font-semibold` = จำนวนผู้ใช้ที่ **active** ในระดับนั้น (ยังไม่โหลด → `Skeleton h-7 w-10`). (grid 4 คอลัมน์บน lg แต่มี 3 ใบ → ช่องที่ 4 ว่าง)

#### 5.4 ตาราง
การ์ด `rounded-lg border border-border bg-surface`; error ไม่มีข้อมูล → `ErrorState`
`DataTable caption="รายชื่อผู้ใช้งาน" rowKey=id initialSort={{id:'active',dir:'asc'}}` (active ขึ้นก่อน)

| id | header | sortValue | cell |
|---|---|---|---|
| code | "รหัส" | employeeCode | `num font-medium` (+`text-muted` ถ้าปิดใช้งาน) |
| name | "ชื่อ" | name | ข้อความ (+muted ถ้าปิด) |
| position | "ตำแหน่ง" | position ?? '' | ค่า หรือ muted "—" |
| phone | "โทร" | — (ไม่เรียงได้) | `<a href="tel:{ตัดเหลือ 0-9 และ +}" class="num text-primary-fg underline-offset-2 hover:underline">` หรือ "—" |
| level | "ระดับสิทธิ์" | index ใน LEVELS | `Badge tone = admin ? 'primary' : 'neutral'` label |
| active | "สถานะ" | active?0:1 | `Badge success` "ใช้งาน" / `Badge neutral` "ปิดใช้งาน" |
| actions | sr-only "จัดการ" | — | align right |

**คอลัมน์จัดการ** (`flex justify-end gap-1`, ปุ่ม `ghost icon-sm`):
1. `Pencil` aria "แก้ไข {name}" → เปิด UserDialog โหมดแก้ไข
2. `KeyRound` aria "รีเซ็ตรหัสผ่าน {name}", disabled ถ้าไม่ active → `ConfirmDialog tone="primary"` title "รีเซ็ตรหัสผ่านของ {name}?" description "ระบบจะสร้างรหัสผ่านชั่วคราว รหัสเดิมใช้ไม่ได้อีก" confirmLabel "รีเซ็ตรหัสผ่าน" → `resetPw.mutateAsync(id)` สำเร็จ → เปิด dialog รหัสชั่วคราว; ล้มเหลว → toast error title "รีเซ็ตไม่สำเร็จ" description errorMessage
3. ถ้าเป็นตัวเอง (`u.id === me.id`) → ช่องว่าง `span.size-8`; ไม่งั้นปุ่ม `UserX` (active) / `UserCheck` (ปิดอยู่), aria "ปิดใช้งาน {name}" / "เปิดใช้งาน {name}" → ConfirmDialog
   - tone: active → `danger` ไม่งั้น `primary`
   - title: "ปิดใช้งาน {name}?" / "เปิดใช้งาน {name}?"
   - description: "ผู้ใช้จะถูกออกจากระบบทันทีและเข้าสู่ระบบไม่ได้ ประวัติงานยังอยู่ครบ" / "ผู้ใช้จะเข้าสู่ระบบได้อีกครั้ง"
   - confirmLabel: "ปิดใช้งาน" / "เปิดใช้งาน"
   - action: `PATCH /users/{id}` body `{active: !active}` → toast "ปิดใช้งาน {name} แล้ว" / "เปิดใช้งาน {name} แล้ว"; error → toast error "บันทึกไม่สำเร็จ"

- mobileCard: `flex items-center gap-3`; ซ้าย `p.text-sm` "<num font-medium>{code}</num> · {name}" + `p.truncate.text-xs.text-muted` "{levelLabel}{ · position}{ · ปิดใช้งาน}"; ขวา = ปุ่มจัดการชุดเดียวกัน
- empty: `EmptyState title="ยังไม่มีผู้ใช้"`

#### 5.5 UserDialog (เพิ่ม / แก้ไข)
- title: แก้ไข → "แก้ไข {name}"; เพิ่ม → "เพิ่มพนักงาน"; description (เฉพาะเพิ่ม) "สร้างบัญชีพนักงาน ช่างเทคนิค ผู้บริหาร หรือผู้ดูแลระบบ"
- footer: `DialogClose` → `Button secondary` "ยกเลิก"; ปุ่มหลัก "บันทึก" (แก้ไข) / "เพิ่มพนักงาน" (เพิ่ม), `loading=save.isPending`
- เมื่อเปิด: reset ฟอร์ม (แก้ไข = ค่าผู้ใช้, password ''), ล้าง errors, `save.reset()`
- ค่าเริ่มต้นเพิ่ม: ทุกช่องว่าง, level = `technician`
- ฟอร์ม `grid gap-4 sm:grid-cols-2`:
  1. "รหัสพนักงาน" required — Input แปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ, `autoComplete="off"`
  2. "ชื่อ-นามสกุล" required
  3. "ตำแหน่ง" placeholder "เช่น ช่างเทคนิค, หัวหน้ากะ"
  4. "เบอร์โทร" required เฉพาะ level=technician; hint (เฉพาะช่าง) "จำเป็นสำหรับช่าง ใช้โทรตามเมื่อเกิดปัญหา"; `inputMode="tel"` placeholder "เช่น 081-234-5678"
  5. "ระดับสิทธิ์" required, `sm:col-span-2`, Select options ตาม LEVELS (ลำดับ admin, ผู้บริหาร, ช่างเทคนิค); hint = hint ของระดับที่เลือก (เปลี่ยนตาม)
  6. (เฉพาะเพิ่ม) "รหัสผ่านเริ่มต้น" required, hint "อย่างน้อย 8 ตัวอักษร", `sm:col-span-2`, `autoComplete="new-password"` (input ธรรมดา ไม่ใช่ type=password)
- พิมพ์ในช่องใดล้าง error ของช่องนั้น
- Submit: body = `{employeeCode, name, ...toRole(level), position: trim||null, phone: trim||null, (เพิ่ม) password}`; schema = แก้ไข `userInputSchema.omit({password})` / เพิ่ม `userInputSchema.required({password})`; รวม error ตาม field (ข้อความแรก) + `technicianPhoneError` ลงช่อง phone; ไม่ผ่าน → ไม่ส่ง
- สำเร็จ → toast title: แก้ไข "บันทึกข้อมูล {name} แล้ว"; เพิ่ม "เพิ่ม {name} ({employeeCode}) แล้ว" description "แจ้งรหัสพนักงานและรหัสผ่านเริ่มต้นให้ผู้ใช้"; ปิด dialog
- API error → กล่อง `role="alert" mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-fg` ข้อความ `errorMessage(save.error)` ใต้ฟอร์ม

#### 5.6 Dialog รหัสผ่านชั่วคราว
- `size="sm"` title "รหัสผ่านชั่วคราว" description "แจ้งรหัสนี้ให้ {name} ({employeeCode}) ระบบจะไม่แสดงอีก"
- เนื้อหา `flex items-center gap-2 rounded-md bg-surface-2 p-3`: `<code class="num flex-1 text-lg font-semibold tracking-wide">{password}</code>` + `Button secondary sm` ไอคอน `Copy` "คัดลอก" → clipboard แล้ว toast "คัดลอกแล้ว"
- footer: `DialogClose` → `Button` "เสร็จสิ้น"

```
ผู้ใช้งาน & สิทธิ์การเข้าถึง                              [+ เพิ่มพนักงาน]
เพิ่มพนักงานหรือผู้ดูแลระบบ และกำหนดระดับการใช้งานระบบ
┌ผู้ดูแลระบบ (Admin)┐┌ผู้บริหาร┐┌ช่างเทคนิค┐
│ 2               ││ 3      ││ 8       │
└─────────────────┘└────────┘└─────────┘
┌────────────────────────────────────────────────────────────────┐
│รหัส │ชื่อ │ตำแหน่ง │โทร │ระดับสิทธิ์ │สถานะ │            │
│T001 │สมชาย│ช่างเทคนิค│081-..│[ช่างเทคนิค]│[ใช้งาน]│ ✎ 🔑 👤✕ │
└────────────────────────────────────────────────────────────────┘
```

---

### 6. `/admin/sites` — จุดติดตั้ง & อุปกรณ์

#### Header
- title "จุดติดตั้ง & อุปกรณ์"; description "ป้อมทางเข้า–ออก Kiosk Payment และอุปกรณ์ประจำแต่ละจุด"
- action: `Button` ไอคอน `Plus` "เพิ่มจุดใหม่" → SiteDialog โหมดเพิ่ม

#### Data / สถานะ
- `useSites()`, `useEquipment()`; `error = sites.error ?? equipment.error`
- error และไม่มี sites → การ์ด + `ErrorState` onRetry refetch ทั้งสอง
- ยังโหลดไม่ครบ → `grid gap-4 lg:grid-cols-2` + `Skeleton h-72` ×4
- `sites.length === 0` → การ์ด + `EmptyState icon=MapPin` title "ยังไม่มีจุดติดตั้ง" description "เพิ่มจุดทางเข้า–ออกก่อน แล้วจึงเพิ่มอุปกรณ์ในแต่ละจุด"
- ปกติ: `flex flex-col gap-8`
  - จัดกลุ่ม sites (รวม inactive) ตาม `group ?? 'ไม่ระบุป้อม'`; ต่อกลุ่ม `<section>`: `h2.mb-3.flex.items-center.gap-2.text-base.font-semibold` ไอคอน `MapPin size-4 text-primary-fg` + ชื่อป้อม + `<span class="text-sm font-normal text-muted">· {n} ช่องทาง</span>`; การ์ดใน `grid gap-4 lg:grid-cols-2`
    - SiteCard: title "{code} <muted font-normal>· {name}</muted>"; badges `Badge neutral` directionLabel + (ถ้าไม่ active) `Badge warning` "ปิดใช้งาน"; types = `LANE_TYPES` (equipmentTypes ยกเว้น kiosk); defaultType `barrier`; มีปุ่มแก้ไขจุด
  - Section สุดท้าย "Kiosk Payment": หัวมีไอคอน `MonitorSmartphone` + "Kiosk Payment" + "· {n} เครื่อง"; SiteCard เดียว title "Kiosk Payment", items = equipment ที่ `siteId === 'kiosk'`, types `['kiosk']`, defaultType kiosk, **ไม่มี** ปุ่มแก้ไขจุด/badges

#### SiteCard
- `section.flex.flex-col.rounded-lg.border.border-border.bg-surface`
- header `flex items-start gap-3 border-b border-border px-4 py-3`: `h3.font-semibold` title; badges `p.mt-1.flex.flex-wrap.gap-1.5`; ปุ่ม `Pencil` ghost icon-sm aria "แก้ไขจุด"
- `ul.flex-1.divide-y.divide-border`: ว่าง → `li.px-4.py-6.text-center.text-sm.text-muted` "ยังไม่มีอุปกรณ์"
  - ต่ออุปกรณ์ `li.flex.items-center.gap-3.px-4.py-2`: ชื่อ `text-sm truncate` + ประเภท `text-xs text-muted`; สถานะ `text-xs text-muted` จุด `size-2.5 rounded-full` (normal `bg-success` "ปกติ", stuck `bg-warning` "ค้าง", down `bg-danger` "เสีย") tooltip = statusNote; ปุ่ม `Pencil` aria "แก้ไข {name}" → EquipmentDialog; ปุ่ม `Trash2` (`text-danger-fg hover:bg-danger-soft`) aria "ลบ {name}" → ConfirmDialog (tone default) title "ลบ {name}?" description "ลบได้เฉพาะอุปกรณ์ที่ไม่มีประวัติงานซ่อม ถ้ามีประวัติให้แก้ชื่อหรือย้ายจุดแทน" confirmLabel "ลบอุปกรณ์" → `DELETE /equipment/{id}`; toast "ลบ {name} แล้ว" / error "ลบไม่สำเร็จ"
- AddEquipmentRow (form `border-t border-border p-3`, `flex gap-2`): Input placeholder "ชื่ออุปกรณ์" aria "ชื่ออุปกรณ์ใหม่" (`min-w-0 flex-1`) + Select aria "ประเภทอุปกรณ์" `w-40 shrink-0` (default ตาม defaultType) + ปุ่ม `secondary icon` `Plus` aria "เพิ่มอุปกรณ์" (loading แทนไอคอน). Enter = submit. Validate `equipmentInputSchema({siteId,type,name.trim()})` → error แรก (เช่น "กรอกชื่ออุปกรณ์") แสดง `p.mt-1.5.text-xs.text-danger-fg role=alert`. สำเร็จ → toast "เพิ่ม {name} แล้ว", ล้างชื่อ (ประเภทคงเดิม); API error → แสดงใต้ช่อง

#### SiteDialog
- title: "แก้ไข {code}" / "เพิ่มจุดติดตั้ง"; footer "ยกเลิก" (secondary, DialogClose) + "บันทึก" (loading)
- ค่าเริ่ม: code '', name '', direction 'in', group null, active true
- ฟอร์ม `grid gap-4 sm:grid-cols-2`:
  1. "รหัสจุด" required hint "เช่น IN-D" — แปลงตัวพิมพ์ใหญ่
  2. "ทิศทาง" required — Select: "ทางเข้า"(in), "ทางออก"(out)
  3. "ชื่อจุด" required `sm:col-span-2`
  4. "ป้อม" hint "ช่องทางที่อยู่ป้อมเดียวกันจะถูกจัดกลุ่มด้วยกัน" placeholder "เช่น จุดที่ 1 ป้อมจตุรทิศ" `sm:col-span-2` (ว่าง → null)
  5. `Switch` label "เปิดใช้งาน" description "ปิดแล้วจะไม่แสดงใน Dashboard และฟอร์มเปิดงาน" (`sm:col-span-2`)
- validate `siteInputSchema` → errors code/name ("กรอกรหัสจุด"/"กรอกชื่อจุด"); body ส่งทั้ง object (แก้ไขส่ง site เดิมรวม field id ด้วยเพราะ setV(site) — zod strip ทิ้ง)
- สำเร็จ toast "บันทึกจุด {code} แล้ว" ปิด dialog; API error → กล่อง alert แดง

#### EquipmentDialog (แก้ไข เท่านั้น — เปิดจากปุ่มดินสอ)
- title "แก้ไข {name}" (โหมดเพิ่ม title "เพิ่มอุปกรณ์" มีในโค้ดแต่ไม่มีจุดเปิด)
- ฟิลด์ (`grid gap-4 sm:grid-cols-2`):
  1. "จุดติดตั้ง" required — ซ่อนถ้า siteId = 'kiosk'; options "{code} · {name}" ของทุก site (ย้ายจุดได้)
  2. "ประเภท" required hint "ใช้เลือกเทมเพลตตรวจเช็กและประเภทปัญหา" — ทุก equipmentTypes
  3. "ชื่ออุปกรณ์" required `sm:col-span-2` placeholder "เช่น ไม้กั้น IN-A-3"
- validate `equipmentInputSchema` → error ของ name; สำเร็จ toast "บันทึก {name} แล้ว"; API error กล่อง alert

```
จุดติดตั้ง & อุปกรณ์                                     [+ เพิ่มจุดใหม่]
ป้อมทางเข้า–ออก Kiosk Payment และอุปกรณ์ประจำแต่ละจุด
📍 จุดที่ 1 ป้อมจตุรทิศ · 2 ช่องทาง
┌ IN-A · ทางเข้า A        ✎┐ ┌ OUT-A · ทางออก A       ✎┐
│ [ทางเข้า] [ปิดใช้งาน]      │ │ [ทางออก]                 │
├──────────────────────────┤ ├──────────────────────────┤
│ ไม้กั้น IN-A-1  ●ปกติ ✎ 🗑 │ │ ยังไม่มีอุปกรณ์            │
│ ไม้กั้น                    │ │                          │
├──────────────────────────┤ ├──────────────────────────┤
│[ชื่ออุปกรณ์    ][ไม้กั้น ▾][+]│ │[ชื่ออุปกรณ์    ][ไม้กั้น ▾][+]│
└──────────────────────────┘ └──────────────────────────┘
🖥 Kiosk Payment · 3 เครื่อง
┌ Kiosk Payment ───────────┐
```

---

### 7. `/admin/checklists` — รายการตรวจเช็คประจำวัน

- Header: title "รายการตรวจเช็คประจำวัน" (สะกด "เช็ค"), description "รายการเหล่านี้จะแสดงให้ช่างตรวจในแอปตามประเภทอุปกรณ์"; ไม่มี actions
- error → การ์ด + ErrorState; pending → `grid gap-4 md:grid-cols-2` `Skeleton h-56` ×4
- ปกติ: `grid items-start gap-4 md:grid-cols-2` — 1 TypeCard ต่อ **ทุก** `equipmentTypes` (14 ใบ ตามลำดับ) จับคู่ template ด้วย `equipmentType`

#### TypeCard
- `section.flex.flex-col.rounded-lg.border.border-border.bg-surface`
- header `flex items-baseline justify-between gap-2 px-4 pt-4 pb-2`: `h2.font-semibold` equipmentTypeLabel; ขวา `num text-xs text-muted` "{n} รายการ"
- `ul.flex-1.divide-y.divide-border.px-4`: ว่าง → `li.py-4.text-sm.text-muted` "ยังไม่มีรายการตรวจ เพิ่มรายการแรกด้านล่าง"; ต่อข้อ `li.flex.items-center.gap-2.py-2.5` label `text-sm` + ปุ่ม `Trash2` ghost icon-sm `text-danger-fg hover:bg-danger-soft` aria "ลบรายการ {label}" disabled ขณะบันทึก — **ลบทันทีไม่มี confirm**
- form `p-4 pt-2`, `flex gap-2`: Input placeholder "เพิ่มรายการตรวจ" aria "เพิ่มรายการตรวจของ {typeLabel}" + ปุ่ม `secondary icon` `Plus` aria "เพิ่มรายการ" (loading)
- ข้อความ error `mt-1.5 text-xs text-danger-fg role=alert`

#### Business rules
- add: trim ว่าง → "พิมพ์รายการตรวจก่อนเพิ่ม"; ซ้ำ (label ตรงกัน) → "มีรายการนี้อยู่แล้ว"; ไม่งั้นล้างช่องแล้ว persist `[...items, {id:'', label}]` toast `เพิ่ม “{text}” แล้ว`
- remove: ถ้าเหลือ ≤1 ข้อ → toast error title "ลบไม่ได้" description "ต้องมีรายการตรวจอย่างน้อย 1 ข้อ"; ไม่งั้น persist รายการที่เหลือ toast `ลบ “{text}” แล้ว`
- persist: `useSaveChecklist` `{id: template?.id, body: {equipmentType, name: template?.name ?? "ตรวจเช็กประจำวัน — {typeLabel}", items}}` → ไม่มี template = `POST /checklist-templates`, มี = `PATCH /checklist-templates/{id}` (ส่ง items ทั้งชุด); error → toast error "บันทึกไม่สำเร็จ" + errorMessage

```
รายการตรวจเช็คประจำวัน
รายการเหล่านี้จะแสดงให้ช่างตรวจในแอปตามประเภทอุปกรณ์
┌ บอร์ดควบคุม ESP   3 รายการ┐ ┌ บอร์ดควบคุม     0 รายการ┐
│ ไฟสถานะติด            🗑 │ │ ยังไม่มีรายการตรวจ เพิ่ม... │
│ ...                      │ │                          │
│ [เพิ่มรายการตรวจ     ][+] │ │ [เพิ่มรายการตรวจ     ][+] │
└──────────────────────────┘ └──────────────────────────┘
```

---

### 8. `/admin/problems` — ประเภทปัญหา

- Header: title "ประเภทปัญหา"; description "แยกตามโมดูลฮาร์ดแวร์ · ตอนแจ้งปัญหาจะแสดงเฉพาะปัญหาของอุปกรณ์ที่เลือก (รวมปัญหาทั่วไป)"
- error → การ์ด + ErrorState; pending → `grid gap-4 md:grid-cols-2` `Skeleton h-48` ×4
- ปกติ: `grid items-start gap-4 md:grid-cols-2` — ModuleCard ต่อ equipmentTypes (14) + ใบสุดท้าย `type=null` "ปัญหาทั่วไป (ทุกอุปกรณ์)"
- items ต่อการ์ด = problem ที่ `equipmentType === type` เรียง active ก่อน inactive

#### ModuleCard
- โครงเหมือน TypeCard: header title + "{n} ปัญหา"; ว่าง → "ยังไม่มีปัญหาของอุปกรณ์นี้ เพิ่มรายการแรกด้านล่าง"
- ต่อรายการ `li.flex.items-center.gap-1.py-2`: ชื่อ `text-sm` (inactive → `text-muted line-through decoration-1`) + (inactive) `Badge neutral` "ปิดใช้งาน" + ปุ่ม ghost icon-sm:
  1. `Pencil` aria "แก้ไข {name}" → ProblemDialog
  2. `CircleOff` (active) / `CirclePlay` (inactive), aria "ปิดใช้งาน {name}"/"เปิดใช้งาน {name}" → ConfirmDialog tone danger/primary, title `ปิดใช้งาน “{name}”?` / `เปิดใช้งาน “{name}”?`, description "จะไม่แสดงในฟอร์มเปิดงานใหม่ งานเดิมยังแสดงชื่อนี้ตามปกติ" / "จะกลับมาแสดงในฟอร์มเปิดงาน", confirmLabel "ปิดใช้งาน"/"เปิดใช้งาน" → `PATCH /problem-types/{id}` `{active:!active}` toast "ปิดใช้งานแล้ว"/"เปิดใช้งานแล้ว"; error "บันทึกไม่สำเร็จ"
  3. `Trash2` (`text-danger-fg hover:bg-danger-soft`) aria "ลบ {name}" → ConfirmDialog title `ลบ “{name}”?` description "ลบได้เฉพาะประเภทที่ยังไม่เคยถูกใช้เปิดงาน ถ้ามีงานใช้อยู่ให้ปิดใช้งานแทน เพื่อเก็บประวัติไว้" confirmLabel "ลบประเภทปัญหา" → `DELETE /problem-types/{id}` toast `ลบ “{name}” แล้ว`; error "ลบไม่สำเร็จ"
- ฟอร์มเพิ่ม: placeholder "เพิ่มปัญหา" aria "เพิ่มปัญหาของ {title}"; ปุ่ม aria "เพิ่มปัญหา". Rules: ชื่อซ้ำในการ์ด → "มีปัญหานี้อยู่แล้ว"; ว่าง → "กรอกชื่อประเภทปัญหา" (จาก schema); `POST /problem-types {name, equipmentType: type, active:true}` → toast `เพิ่ม “{name}” แล้ว` ล้างช่อง; API error แสดงใต้ช่อง

#### ProblemDialog (แก้ไข)
- `size="sm"` title "แก้ไขประเภทปัญหา" (problem=null → "เพิ่มประเภทปัญหา"); footer "ยกเลิก" + "บันทึก"
- Field "ชื่อปัญหา" required placeholder "เช่น ไม้กั้นไม่ยก"; error = validation หรือ errorMessage ของ API
- Field "โมดูล / อุปกรณ์" hint "ย้ายปัญหาไปโมดูลอื่นได้ · “ปัญหาทั่วไป” แสดงกับอุปกรณ์ทุกชนิด" — Select: "ปัญหาทั่วไป (ทุกอุปกรณ์)" (value '') แล้วตาม equipmentTypes
- submit: `{name: trim, equipmentType: type||null, active: problem?.active ?? true}` → toast `บันทึก “{name}” แล้ว` ปิด dialog

---

### 9. `/admin/sla` — ตั้งค่า SLA

- Header: title "ตั้งค่า SLA"; description "เวลาตอบสนองและเวลาแก้ไขตามระดับความเร่งด่วน"
- การ์ด `max-w-3xl rounded-lg border border-border bg-surface`
  - แถบแจ้งเตือนบนสุด (แสดงเสมอ): `flex items-start gap-2 border-b border-border bg-primary-soft/60 px-4 py-3 text-sm text-primary-fg` ไอคอน `Info size-4 mt-0.5` + "ค่าปัจจุบันเป็นค่าเริ่มต้นชั่วคราว รอยืนยันตัวเลขจริงจาก CIT"
  - error ไม่มีข้อมูล → `ErrorState`; ยังไม่มี rows → `space-y-3 p-4` `Skeleton h-12` ×4
  - ปกติ `p-4 sm:p-5`:
    - หัวตาราง (เฉพาะ ≥sm) `hidden sm:grid grid-cols-[120px_1fr_1fr] gap-4 pb-2 text-sm font-medium text-muted`: "ความเร่งด่วน" | "ตอบสนองภายใน" | "แก้ไขเสร็จภายใน"
    - แถว (ลำดับ `priorities` กลับด้าน: วิกฤต, สูง, ปานกลาง, ต่ำ) `grid grid-cols-2 items-start gap-x-4 gap-y-2 py-3 sm:grid-cols-[120px_1fr_1fr]` คั่น `divide-y`:
      - `PriorityBadge` (`col-span-2 pt-2 sm:col-span-1`)
      - 2 cell: ป้าย (มือถือเท่านั้น) `text-xs font-medium text-muted sm:hidden`; `Input type="number" inputMode="numeric" min=1 class="num pr-14"` aria "{label} ระดับ{priorityLabel} (นาที)" มีหน่วย "นาที" วางทับขวา (`absolute right-3 text-sm text-muted`); ใต้ช่อง `num text-xs text-muted` → `= {formatDuration(n)}` ถ้า n>0 ไม่งั้นเว้นว่าง
    - error กล่อง `mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-fg role=alert`
    - ปุ่ม `mt-4 flex justify-end gap-2 border-t border-border pt-4`: "คืนค่าเดิม" (secondary, disabled ถ้าไม่ dirty หรือกำลังบันทึก → reset rows) + "บันทึก" (primary, loading, disabled ถ้าไม่ dirty)
- `dirty` = JSON ของ rows ≠ ค่าจาก server
- Validation ต่อแถวตามลำดับ (หยุดที่แรกที่ผิด):
  - ไม่ใช่จำนวนเต็มหรือ ≤0 → `ระดับ{priorityLabel}: กรอกเป็นจำนวนนาทีที่มากกว่า 0` (เช่น "ระดับวิกฤต: กรอก...")
  - response > resolve → `ระดับ{priorityLabel}: เวลาตอบสนองต้องไม่เกินเวลาแก้ไข`
- บันทึก: `PUT /sla-settings` body `[{priority, responseMinutes, resolveMinutes}×4]` → toast title "บันทึกค่า SLA แล้ว" description "มีผลกับงานที่เปิดใหม่และงานที่เปลี่ยนความเร่งด่วน"; error → แสดงในกล่อง error

```
ตั้งค่า SLA
เวลาตอบสนองและเวลาแก้ไขตามระดับความเร่งด่วน
┌──────────────────────────────────────────────────────────┐
│ ⓘ ค่าปัจจุบันเป็นค่าเริ่มต้นชั่วคราว รอยืนยันตัวเลขจริงจาก CIT  │
├──────────────────────────────────────────────────────────┤
│ ความเร่งด่วน   ตอบสนองภายใน            แก้ไขเสร็จภายใน       │
│ [วิกฤต]       [ 15        นาที]        [ 240       นาที]     │
│               = 15 นาที                = 4 ชม.               │
│ [สูง]         [ 30        นาที]        [ 480       นาที]     │
│ ...                                                       │
│                                      [คืนค่าเดิม] [บันทึก]   │
└──────────────────────────────────────────────────────────┘
```
