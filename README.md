# RTKM — Transport Management SaaS (Web + Mobile)

A **Next.js** web app + **React Native (Expo)** mobile app on a **MongoDB** backend. It started as the
[rtkm-44911.web.app](https://rtkm-44911.web.app/) fuel calculator and grew into a full tanker/transport
management platform: loads, fuel, tolls, salaries, freight reconciliation and analytics — with PDF and
Gmail ingestion so paperwork turns into data automatically.

---

## What it does

- **Public calculator** (drivers, no login): depot → pump → mileage → **Diesel = RTKM ÷ mileage**. EN / हिंदी.
- **Transport management** (logged in): transports → trucks/tankers → drivers/managers → loads, maintenance,
  meter readings, spend & profit analytics.
- **Money, reconciled** — fed by PDF / Gmail import:
  - **Invoices → Loads**, **Freight statements → deliveries + shortages**, **Bank advice → settlements**.
  - **FASTag / tolls (BlackBuck)** — per-tanker tolls vs BOSS wallet, flagging non-toll charges to dispute.
  - **Salaries** with oil-shortage deductions, joining-date / leave proration, and meal allowance.
- **Notifications** — in-app bell + OS push (web + mobile) on every import and admin approval.

---

## Roles

| Role | Login | Can do |
|---|---|---|
| **Driver (public)** | none | Calculator; **submit a missing pump** → pending admin approval. |
| **Driver (employee)** | phone + PIN | **My trips**, **my payslips**, **meter readings**, **upload invoice / shortage PDFs**. Login gated by `appAccessEnabled`. |
| **Manager** | phone + PIN | Run a transport day-to-day: trucks, drivers, loads, maintenance, uploads (no salary settings). |
| **Transport owner** | phone + PIN (self-register) | Owns **many transports**; full control + **salaries / shortage deductions** + spend & profit. |
| **Admin** | **phone + PIN** *or* Google | Master RTKM pumps, **approve/reject** driver submissions & RTKM changes, owners, transporter oversight. |

The public calculator is one simple screen. Everything else is behind login:
- **`/login`** — phone + PIN for every role (owners self-register).
- **`/app/*`** — role-aware dashboard for owner / manager / driver.
- **`/admin/*`** — master-data console (admins; phone + PIN **or** Google — see [Admin setup](#admin-setup)).

Mobile tabs: **Calculator · My Fleet (role-aware) · Settings**.

---

## Tech stack

- **Web**: Next.js 14 (App Router, JS) · MUI · SWR · NextAuth (Google) · Mongoose 8 · pdf-parse · recharts · web-push · zod.
- **Mobile**: Expo SDK 56 · expo-router · expo-sqlite (offline pump cache) · expo-notifications.
- **Shared**: `packages/shared` — depot constants + `calcOil()` + zod schema, used by both apps.
- **DB**: MongoDB (local or Atlas).

---

## Monorepo layout

```
rtkm/
  data/                    # seed JSON (3 depots, ~1,840 pumps)
  packages/shared/         # DEPOTS, AVERAGES, calcOil(), normalize(), zod schema (web + mobile)
  apps/web/
    lib/models/            # Pump, User, Transport, Truck, Load, Maintenance, Shortage, SalaryRecord,
                           #   Leave, Expense, ExtraOil, Upload, MeterReading, Gmail, Notification,
                           #   PushSubscription, RtkmRequest, Fastag(Txn/WalletTxn), Settlement
    lib/auth/              # pin (scrypt) + session (requireAuth role gate + transport scoping)
    lib/pdf/               # extract (pdf-parse) + parsers (invoice/ledger/fastag) + ingest
    lib/services/          # ledger, salary, fastag, notifications, push
    lib/google/            # Gmail OAuth + read helpers
    components/            # ui.js kit, UploadFlow.js, Charts.js, icons.js
    app/                   # / (driver) · /login · /app/* (dashboard) · /admin/* · /api/*
    scripts/               # seed.js, create-admin.js
    uploads/               # stored PDFs (dev; gitignored)
  apps/mobile/             # Expo app: Calculator · My Fleet (role-aware) · Settings
```

`packages/shared` keeps the calculation + constants identical across apps. The mobile app talks **only**
to the web REST API (never to MongoDB directly).

> **npm workspaces** cover `packages/*` and `apps/web`. **`apps/mobile` is intentionally not a workspace** —
> install it separately (RN peer-deps differ).

---

## Quick start

### Prerequisites
- Node ≥ 18
- MongoDB running locally (`brew services start mongodb-community`) **or** a MongoDB Atlas URI

### 1. Install + configure
```bash
# from repo root
npm install

cp apps/web/.env.example apps/web/.env.local
# edit apps/web/.env.local — at minimum set MONGODB_URI and NEXTAUTH_SECRET
```

### 2. Seed pumps (imports data/*.json)
```bash
npm run seed -w apps/web          # → ~1,839 pumps across 3 depots (idempotent)
```
> Seeding loads **pump master data only** — no demo users. Create your first login below.

### 3. Run the web app
```bash
npm run dev -w apps/web           # http://localhost:3000
```
> ⚠️ Run **only one** dev server. Two `next dev` processes corrupt `.next` (random 404 / stuck loading).
> If that happens: stop all, `rm -rf apps/web/.next`, start one.

### 4. Get in
- **Owner**: open `/login` → **Register** (phone + PIN) → you're in at `/app`.
- **Admin**: create one from the CLI (next section), then log in at `/login` or `/admin/signin`.

### 5. Run the mobile app
```bash
cd apps/mobile
npm install --legacy-peer-deps    # RN peer-deps; --legacy-peer-deps is expected
npx expo start                    # Expo Go (scan QR) or a simulator
```
In the app's **Settings** tab set the **Server URL**:
- Simulator: `http://localhost:3000`
- Physical phone: your computer's LAN IP, e.g. `http://192.168.1.5:3000`

Then **Sync now** — the calculator works fully offline from the local SQLite cache afterwards.

---

## Admin setup

An admin can sign in **two ways** (both reach the same `/admin` master console):

**A. Phone + PIN** (no Google needed)
```bash
node apps/web/scripts/create-admin.js <phone> <pin> "<name>"
# PIN defaults to the phone number if omitted, e.g.:
node apps/web/scripts/create-admin.js 9876543210            # login 9876543210 / 9876543210
```
Then log in at `/login` (or `/admin/signin`) — admins are routed to `/admin`.

**B. Google**
1. Create an OAuth client at <https://console.cloud.google.com/apis/credentials> (type: **Web**).
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
3. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env.local`.
4. Add allowed admin emails to `ADMIN_EMAILS` (comma-separated). Only these may sign in.

---

## Environment variables

Copy `apps/web/.env.example` → `apps/web/.env.local` and fill in. `.env.local` is **gitignored** — never commit secrets.

| Variable | Required | What it's for |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string (e.g. `mongodb://127.0.0.1:27017/rtkm`). |
| `NEXTAUTH_SECRET` | ✅ | NextAuth session signing secret (any long random string). |
| `NEXTAUTH_URL` | ✅ | App base URL (`http://localhost:3000` in dev). Also derives the Gmail redirect URL. |
| `MOBILE_JWT_SECRET` | ✅ | HS256 secret for phone+PIN tokens (mobile + owner cookie). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | for Google admin **and** Gmail import | OAuth web client (shared by both). |
| `ADMIN_EMAILS` | for Google admin | Comma-separated allowlist of admin Gmail addresses. |
| `GOOGLE_MOBILE_CLIENT_IDS` | optional | Allowed audiences for mobile Google sign-in (comma-separated). |
| `GMAIL_TOKEN_SECRET` | for Gmail import | AES key that encrypts the stored Gmail refresh token. **Set before connecting Gmail.** Falls back to `MOBILE_JWT_SECRET` if unset. |
| `GMAIL_REDIRECT_URI` | optional | Override the Gmail OAuth callback (defaults to `${NEXTAUTH_URL}/api/integrations/gmail/callback`). |
| `GOOGLE_GEOCODING_KEY` | optional | Use Google geocoding instead of free OSM Nominatim for pump coords. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_SUBJECT` | for web push | Web Push (VAPID). Generate: `node -e "console.log(require('web-push').generateVAPIDKeys())"` (public goes in both `VAPID_PUBLIC_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`). |
| `CRON_SECRET` | for background Gmail scan | Bearer secret guarding `/api/cron/check-gmail`. |

---

## Gmail import (optional)

Connect a Gmail inbox (one per transport) and pull invoice / shortage / freight / payment / FASTag PDFs
straight in — manual upload still works everywhere.

**Google Cloud setup** (same OAuth client as `GOOGLE_CLIENT_ID`):
1. **Enable the Gmail API** (APIs & Services → Library → Gmail API → Enable).
2. **Credentials** → your OAuth web client → add redirect URI
   `http://localhost:3000/api/integrations/gmail/callback`.
3. **OAuth consent screen** → add scopes `gmail.readonly` and `userinfo.email`; add your inbox as a **Test user**.
4. Set `GMAIL_TOKEN_SECRET` in `.env.local` (before connecting).

**Use it** — `/app → Settings → Connect Gmail`, then either:
- **Import all statements at once** — pick sender domains (e.g. `@nayaraenergy.com`) + a period → auto-files
  every PDF (duplicates skipped by content hash). Mobile: *Upload → From email → Import all*.
- **One at a time** — *Loads* / *Shortages* → Upload → *From email* → Scan inbox → pick a PDF.

Refresh tokens are stored AES-encrypted; access is **read-only**.

---

## Push notifications (optional)

In-app bell works out of the box. For **OS push** (app closed):
- **Web**: set the VAPID env vars, open the app over https (localhost is fine), click **Enable push** in the bell menu.
- **Mobile**: needs an **EAS build** (`eas init` + `eas build`) for a push token — does **not** work in Expo Go.
- **Background scan**: schedule an external cron to hit `GET /api/cron/check-gmail?secret=<CRON_SECRET>` every
  few minutes (it notifies on new Gmail PDFs; it does not auto-import).

---

## Key flows

- **Invoice PDF → Load** — fields auto-extracted (invoice no, from/to, pump code, qty, tanker) → review → saved;
  tanker→driver auto-mapped; master RTKM auto-filled or queued for admin approval if it differs.
- **Shortage / Freight statement → deduction** — rows matched to loads by **invoice number** → a Shortage is
  recorded per driver → on **payslip generate**, `net = prorated base − Σ(shortage L × ₹/L) + meal allowance`.
- **Bank Payment Advice → settlement** — matches each load by invoice/shipment, captures gross / TDS / company
  shortage cut / net received, marks loads **settled** vs **pending**.
- **FASTag (BlackBuck)** — upload per-tanker (IDFC) statements + the monthly BOSS wallet statement; per-tanker
  tolls are the source of truth, reconciled against wallet outflow; non-toll charges are flagged with their
  Transaction IDs to **dispute** (Expected / Disputed), and tolls flow into Spend & Profit.

---

## Scripts

| Command | What |
|---|---|
| `npm run dev -w apps/web` | Run the web app (dev). |
| `npm run build -w apps/web` | Production build of the web app. |
| `npm run seed -w apps/web` | Seed/refresh pump master data from `data/*.json` (idempotent). |
| `node apps/web/scripts/create-admin.js <phone> [pin] [name]` | Create/update a phone+PIN admin. |
| `cd apps/mobile && npx expo start` | Run the mobile app. |
| `cd apps/mobile && npx expo export --platform ios` | Bundle-check the mobile app. |

---

## Notes & security

- Owner/driver/admin PINs are hashed with **scrypt**; tokens are HS256 (`MOBILE_JWT_SECRET`). Auth resolves in
  order: NextAuth admin session → `Authorization: Bearer <JWT>` (mobile) → `rtkm_token` cookie (web).
- **cmsCode is not globally unique** across depots — RTKM reconciliation only acts when a code maps to exactly
  one pump, to avoid corrupting the wrong depot.
- Re-seeding preserves admin-edited coordinates (`$setOnInsert`) while refreshing RTKM.
- Geocoding defaults to free OSM Nominatim; set `GOOGLE_GEOCODING_KEY` to use Google.
- `npm audit` may show deep transitive advisories (dev-time tooling via `next-auth` / RN) that don't affect runtime.
