# Zona Fit

Admin app for a small gym: members, monthly plans and fees, fixed weekly
classes with attendance, and a shop with stock. Mobile-first PWA, made for an
iPhone Home Screen. The screens are in Spanish; the code is in English.

Built from the Ms Dany's Place school app (a separate project).

**Stack:** React + Vite (plain JS) · Supabase (Postgres + Auth) · GitHub Pages

## Project structure

```
index.html                  iPhone/PWA meta tags
vite.config.js              build settings + PWA manifest and service worker
supabase/
  schema.sql                all tables, functions and security rules (run once)
  reset-test-data.sql       ⚠️ erases all data (only before loading real data)
src/
  main.jsx                  starts React, the router and the crash screen
  App.jsx                   login check, routes, offline banner
  index.css                 all styles (colors/sizes at the top)
  lib/
    sessions.js             which classes happen on which day (the core logic)
    payments.js             fee statuses: pagada / parcial / sin pagar / vencida
    shop.js                 products, sales, stock
    members.js              age, birthdays
    attendance.js           attendance % per member and class
    bigText.js              detects a large iPhone text size (data-big-text)
    format.js               dates, months, money (Argentine format, Spanish names)
    useLoad.js              loading data in a screen (+ unwrap)
    backup.js, csv.js       CSV export and import
    phone.js, groups.js, errors.js, supabase.js, useOnline.js, vcard.js, asset.js
  components/               reusable pieces (tab bar, toast, pay panel, ...)
  screens/                  one file per screen
public/                     icons (copied as-is)
.github/workflows/          deploy to GitHub Pages + keep Supabase awake
```

**Words:** in the code a class is a `group` (the table is `groups`), one class
on one day is a `session`, and a socio is a `member`.

**How classes work:** weekly classes are never stored in advance. For each
day the app calculates them from `group_slots`, and mixes in rows from
`sessions` for classes that were cancelled, moved, had attendance saved, or
are extras (see `src/lib/sessions.js`).

**How fees work:** each member has a plan, and each plan has a price history
(`plan_prices`). When the Pagos screen opens a month, `ensure_charges` creates
one fee per member, copying the plan and its price for that month. A price or
plan change only updates fees with no payments and no hand edit, and plan
changes never touch past months.

**How the shop works:** `products.stock` is only changed by the database
functions `record_sale`, `undo_sale` and `add_stock`, which change the sale
and the stock together. Each sale keeps the price it was sold at.

## One-time setup

### 1. Supabase
1. Create a free project at [supabase.com](https://supabase.com). Pick the
   São Paulo region (closest to Argentina).
2. **SQL Editor → New query**: paste all of `supabase/schema.sql` and press **Run**.
3. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up".
4. **Authentication → Users → Add user → Create new user**: Nadia's email and a
   password, with "Auto Confirm User" ticked.
5. **Project Settings → API Keys**: copy the Project URL and the **publishable**
   key (or the legacy "anon" key).

### 2. Run it on your computer
```
cp .env.example .env     # then paste the URL and key into .env
npm install
npm run dev
```
Open the "Network" address it prints (e.g. `http://192.168.0.10:5173`) on a
phone on the same Wi-Fi to try it there.

### 3. GitHub Pages
1. Repo **Settings → Secrets and variables → Actions → New repository secret**:
   add `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`.
2. Repo **Settings → Pages → Source**: choose **GitHub Actions**.
3. Every push to `main` now deploys to `https://<user>.github.io/<repo>/`.
   You can watch it run in the **Actions** tab (re-run it after adding the
   secrets).

### 4. Install on the iPhone
Open the site in **Safari** → Share button → **Add to Home Screen**. Open the
app from the new icon and log in once. The Home Screen app keeps its own login,
separate from Safari.

## Loading the gym's data
First, erase the test data: paste `supabase/reset-test-data.sql` in the SQL
Editor and run it (this can't be undone).

Then Clases → gear → **Importar desde una planilla**. Import in this order:
plans, classes, members. Commas or semicolons both work (Excel in Spanish uses `;`).

```
nombre,precio
3 veces por semana,28000

nombre,horarios,notas
Funcional,Lun 19:00 60 / Mie 19:00 60,

nombre,telefono,plan,clase,nacimiento,empezo,emergencia_nombre,emergencia_telefono,notas
Sofía Pérez,11 5555-1234,3 veces por semana,Funcional,12/03/1995,01/03/2026,Laura (mamá),11 5555-9876,
```
Rows with problems are shown before anything is saved. Names that already
exist are skipped, so importing the same file twice is safe.

## Good to know
- **Keep-alive:** Supabase pauses free projects after 7 days without use.
  `keep-alive.yml` pings it every 3 days. GitHub turns off scheduled workflows
  in repos with no commits for 60 days and emails you first. If that happens,
  re-enable it in the Actions tab.
- **Backups:** the free plan has no automatic backups. Ajustes → **Hacer copia
  de seguridad** → **Guardar archivos** exports every table as CSV (on the
  iPhone it opens the Share sheet: save to Files/Drive or email it). Do it monthly.
- **Nothing is ever deleted** by the app: payments, fees, absences and sales get
  a `deleted_at` date instead, and the database doesn't even allow deleting them.
- **Updates:** after a deploy, the phone picks up the new version the next time
  the app is opened (sometimes it takes a second open).
- **Logo:** the icons in `public/` and `logo-mark.png` (the woman on the round
  Inicio button, white on transparent) were cut from a photo of the logo. If a
  cleaner logo file turns up, replace them with the same names and sizes. The
  colors (black and purple) are at the top of `src/index.css`.
