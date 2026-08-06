# Discgolfi jälgija · Disc Golf Tracker

A small, self-hostable web app for the Estonian disc golf community. Players
can see which courses exist, check the current weather, see how busy each
course is right now, and check in via a QR code at the tee so others can see
they're on the course.

Built as a personal / community project by [info@digiarendus.ee](mailto:info@digiarendus.ee).
Native language is Estonian; English is a first-class second locale.

---

## Table of contents

- [Project scope](#project-scope)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [NPM scripts](#npm-scripts)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [API surface](#api-surface)
- [Internationalisation](#internationalisation)
- [Theming](#theming)
- [Privacy and GDPR](#privacy-and-gdpr)
- [Accessibility](#accessibility)
- [Testing](#testing)
- [Deployment notes](#deployment-notes)
- [Contributing](#contributing)
- [License](#license)
- [Contact and support](#contact-and-support)

---

## Project scope

### In scope

- Browsable map of disc golf courses across Estonia, drillable from county to
  individual course.
- Per-course view with hole/PAR table, current weather, live traffic count and
  a check-in button.
- Anonymous, device-based check-in with a heartbeat that auto-checks-out an
  inactive session.
- QR-code entry point (`/checkin/<courseId>`) so a printed sign at the course
  can start a session with one scan.
- Bilingual UI (Estonian default, English secondary) driven by URL locale.
- Light / dark / system theme with no flash on first paint.
- GDPR-friendly cookie disclosure banner; no analytics, no third-party
  tracking, no advertising cookies.
- Role-based admin area:
  - **Superuser** (the project owner) — manages every course, admin, and
    issue report; bootstrapped from environment variables on first login.
  - **Course admins** — assigned to one or more specific courses; can edit
    those courses' data (hole layout, description, coordinates, etc.) and
    manage issue reports on them, but cannot create/delete courses or manage
    other admins.
- Community "report an issue" flow (maintenance issue on the course, or bug in
  the app) surfacing to the admin panel, filtered by role.

### Explicitly out of scope (for now)

- Real user accounts, scoring, round history, or leaderboards. Check-in is
  anonymous and ephemeral.
- Push notifications. The "still on the course?" reminder is an in-app timer
  only; adding Web Push is possible later but not planned.
- Native mobile apps. The web app is responsive and installable as a PWA
  candidate, but no iOS/Android bundles are produced.
- Payment integration. The "Support the project" link points at an external
  service; no payments are handled by this app.
- Course discovery outside Estonia. County list and default map centre are
  Estonian; nothing hard-codes the country, but the seed data and translations
  assume it.

---

## Features

- **Estonia map** – Leaflet + OpenStreetMap tiles. County-level bubbles sized
  by course count and coloured by live traffic; click a county to drill down
  to individual course markers plus a list view.
- **Course page** – hole/PAR table, total PAR, current-weather card, current
  traffic count, check-in / check-out button, embedded mini-map and a
  "report an issue" button.
- **Check-in** – anonymous device cookie, `/api/checkin` creates or refreshes
  a session, `/api/ping` heartbeat keeps it alive, `/api/checkout` ends it.
  Any session whose last ping is older than `ACTIVE_WINDOW_MINUTES` is
  automatically excluded from traffic counts.
- **QR scan** – `/checkin/<courseId>` is a route handler that mints the
  device cookie, opens (or refreshes) the session and 307-redirects to the
  course page.
- **Weather** – server-side fetch of Open-Meteo current conditions
  (temperature, wind, precipitation, WMO weather code), cached for 10 minutes
  per course.
- **Admin panel** – email + password login at `/admin`; superuser can add /
  edit / delete courses and hole layouts, print per-course QR sheets, manage
  admin users and their course assignments, and triage all issue reports.
  Course admins see only the courses they've been assigned to and only the
  issues reported on those courses.
- **i18n** – `next-intl` with `et` (default) and `en`; language switcher
  preserves the current path.
- **Theming** – three-state light / dark / system toggle, persisted in
  `localStorage`, applied via a pre-hydration inline script.
- **A11y** – skip-to-content link, visible focus outlines, ARIA on all
  dialogs, `min-h-11` touch targets, `prefers-reduced-motion` honoured,
  colour-independent traffic labels.

---

## Tech stack

| Layer          | Choice                                                    |
| -------------- | --------------------------------------------------------- |
| Framework      | Next.js 16 (App Router, Turbopack), React 19              |
| Language       | TypeScript (strict)                                       |
| Styling        | Tailwind CSS v4 (CSS-first config)                        |
| DB / ORM       | SQLite via Prisma 6                                       |
| Validation     | Zod                                                       |
| i18n           | `next-intl`                                               |
| Maps           | `react-leaflet` + OpenStreetMap tiles                     |
| Weather        | Open-Meteo (public, no API key)                           |
| QR generation  | `qrcode.react`                                            |
| Tests          | Vitest + `vite-tsconfig-paths` (real Prisma against test DB) |
| Runtime target | Node.js ≥ 20 (any Vercel / VPS / Docker host)             |

---

## Getting started

### Prerequisites

- Node.js 20+ (tested on 22)
- npm (repo is committed with `package-lock.json`)

### Install & run

```bash
git clone <your-fork-url>
cd discgolf-tracker
npm install
cp .env.example .env      # or edit .env directly, see below
npx prisma migrate dev    # applies migrations, creates dev.db
npm run seed              # optional: seed six sample Estonian courses
npm run dev
```

Open http://localhost:3000. The Estonian home page is at `/`; English at `/en`.

### First-time admin bootstrap

The admin area is at `/admin`. On a fresh database the very first login using
the credentials in your `.env` — `SUPERUSER_EMAIL` (default `admin@local`)
plus `ADMIN_PASSWORD` (default `admin123`) — creates the initial superuser
account and signs you in. From then on:

- Only accounts stored in the DB can log in.
- The superuser can add / edit / delete **course admins** from the Users tab
  and assign each of them to specific courses.
- Course admins log in with the email + password the superuser set for them.
- `ADMIN_PASSWORD` continues to be used to sign session cookies, so rotating
  it invalidates every outstanding session.

**Change `ADMIN_PASSWORD` before deploying anywhere.**

---

## Environment variables

| Name                     | Default                                | Purpose                                                                                            |
| ------------------------ | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | `file:./dev.db`                        | Prisma datasource. SQLite for dev / small self-host.                                               |
| `ADMIN_PASSWORD`         | `admin123`                             | Bootstrap password for the first-ever superuser login **and** the HMAC secret for admin sessions. |
| `SUPERUSER_EMAIL`        | `admin@local`                          | Email of the superuser account that gets created on first login.                                   |
| `NEXT_PUBLIC_DONATE_URL` | `https://buymeacoffee.com/digiarendus` | URL for the "Support the project" footer link.                                                     |

Create a `.env` file at the repo root:

```env
DATABASE_URL="file:./dev.db"
SUPERUSER_EMAIL="you@example.com"
ADMIN_PASSWORD="pick-something-long"
NEXT_PUBLIC_DONATE_URL="https://buymeacoffee.com/yourhandle"
```

---

## NPM scripts

| Script              | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Start Next.js dev server on port 3000                  |
| `npm run build`     | Production build                                       |
| `npm start`         | Serve the production build                             |
| `npm run lint`      | Run ESLint                                             |
| `npm run seed`      | Populate the DB with sample Estonian courses           |
| `npm test`          | Run the full Vitest suite once                         |
| `npm run test:watch`| Vitest in watch mode                                   |

---

## Project structure

```
src/
  app/
    [locale]/          # localised pages (ET default, EN)
      layout.tsx       # HTML shell, theme script, header/footer, cookie banner
      page.tsx         # Home: Estonia map with county → course drill-down
      course/[id]/     # Course detail: holes, weather, traffic, check-in
      admin/           # Password-gated admin area
    checkin/[courseId]/route.ts   # QR landing (route handler, redirects)
    api/
      checkin/         # POST create/refresh a session
      ping/            # POST heartbeat
      checkout/        # POST end current session
      issues/          # POST report; GET (admin) list
      admin/
        login/         # POST password
        logout/        # POST clear session
        courses/       # GET list; POST create; [id] PUT / DELETE
        issues/[id]/   # PATCH open/closed
  components/
    map/               # EstoniaMap + CourseMiniMap (client, dynamic import)
    course/            # CheckInPanel, ReportIssueButton
    admin/             # AdminLogin, AdminDashboard, CourseEditor, CourseQr
    SiteHeader.tsx     # Nav (admin link hidden until authed)
    SiteFooter.tsx     # Attribution + support link
    ThemeToggle.tsx    # Light / dark / system pill
    ThemeScript.tsx    # Pre-hydration inline script
    CookieBanner.tsx   # GDPR disclosure
    LanguageSwitcher.tsx
  i18n/                # next-intl routing / navigation / request config
  lib/
    prisma.ts          # PrismaClient singleton
    constants.ts       # ACTIVE_WINDOW_MINUTES, PING_INTERVAL_MS, county list
    traffic.ts         # Active-session query helpers
    device.ts          # Anonymous device cookie (get/create)
    admin.ts           # Admin password + session
    weather.ts         # Open-Meteo fetcher
  middleware.ts        # next-intl locale routing
messages/
  et.json              # Estonian strings
  en.json              # English strings
prisma/
  schema.prisma        # Course, Hole, CheckIn, IssueReport
  migrations/          # Prisma migrations
  seed.ts              # Sample data
test/
  setup.ts             # Fresh test DB per run, truncate per test
  helpers.ts           # Cookie mock, seed helpers, jsonRequest
  lib/                 # Pure-function tests
  api/                 # Route-handler tests
```

---

## Data model

Defined in `prisma/schema.prisma`:

- **Course** — `id`, `nameEt`, `nameEn`, `county`, `city?`, `latitude`,
  `longitude`, `descriptionEt?`, `descriptionEn?`.
- **Hole** — `courseId`, `number`, `par`, `distance?`. Unique on
  (`courseId`, `number`).
- **CheckIn** — `courseId`, `deviceId`, `startedAt`, `lastPingAt`, `endedAt?`.
  Indexed on (`courseId`, `endedAt`) and (`deviceId`, `endedAt`) for the
  active-session queries.
- **IssueReport** — `courseId?`, `category` (`course` / `app` / `other`),
  `message`, `deviceId?`, `status` (`open` / `closed`), `createdAt`.
- **Admin** — `email` (unique), `passwordHash` (scrypt, salted), `role`
  (`superuser` / `courseAdmin`), timestamps.
- **CourseAdmin** — composite-PK join between `Course` and `Admin`, defining
  which courses each course-admin may edit.

"Active" means `endedAt IS NULL AND lastPingAt > now - ACTIVE_WINDOW_MINUTES`.
Nothing is ever hard-deleted through user actions — check-outs set `endedAt`.

---

## API surface

All endpoints return JSON. Cookies used are `HttpOnly`, `SameSite=Lax`.

### Public

| Method | Path                       | Purpose                                             |
| ------ | -------------------------- | --------------------------------------------------- |
| GET    | `/checkin/<courseId>`      | Mint device cookie, create/refresh session, redirect |
| POST   | `/api/checkin`             | Create or refresh a session for the given course    |
| POST   | `/api/ping`                | Heartbeat; refreshes `lastPingAt`                   |
| POST   | `/api/checkout`            | End all active sessions for the device              |
| POST   | `/api/issues`              | Submit an issue report                              |

### Admin (require `dg_admin` cookie)

Permission rules referenced below:

- **Any admin** = signed in as either role.
- **Superuser only** = requires `role = 'superuser'`.
- **Course-admin scoped** = superuser is allowed on any course; a course
  admin is allowed only if they're assigned to the target course.

| Method  | Path                              | Purpose                             | Who                    |
| ------- | --------------------------------- | ----------------------------------- | ---------------------- |
| POST    | `/api/admin/login`                | Email+password login, sets cookie   | Public                 |
| POST    | `/api/admin/logout`               | Clear session cookie                | Any admin              |
| GET     | `/api/admin/me`                   | Current identity + assigned course ids | Any admin           |
| GET     | `/api/admin/courses`              | Courses (filtered to assigned for course admins) | Any admin |
| POST    | `/api/admin/courses`              | Create a course + holes             | Superuser only         |
| PUT     | `/api/admin/courses/<id>`         | Replace course + holes; superuser may also rewrite admin assignments | Course-admin scoped |
| DELETE  | `/api/admin/courses/<id>`         | Delete a course                     | Superuser only         |
| GET     | `/api/issues`                     | Issue reports (filtered to assigned courses; app-level reports are superuser-only) | Any admin |
| PATCH   | `/api/admin/issues/<id>`          | Update status (`open` / `closed`)   | Course-admin scoped    |
| GET     | `/api/admin/admins`               | List admins with their assignments  | Superuser only         |
| POST    | `/api/admin/admins`               | Create an admin (email, password, role, courses) | Superuser only |
| PUT     | `/api/admin/admins/<id>`          | Update email / password / role / assignments (blocks demoting the last superuser) | Superuser only |
| DELETE  | `/api/admin/admins/<id>`          | Delete an admin (blocks deleting yourself or the last superuser) | Superuser only |

---

## Internationalisation

- `messages/et.json` is the source of truth (this is a native-Estonian app);
  `messages/en.json` mirrors it.
- `next-intl` runs with `localePrefix: "as-needed"` — Estonian is at `/`,
  English at `/en/…`. Users are redirected by browser `Accept-Language`
  unless they explicitly switch, in which case a `NEXT_LOCALE` cookie sticks.
- All user-visible strings live in the message files. Add a key to both
  before referencing it in a component. Pluralisation uses ICU (`{count,
  plural, ...}`).

---

## Theming

- Tailwind v4 is configured to enable the `dark:` variant on `html.dark`.
- The three-state toggle stores `theme` in `localStorage` as
  `light | dark | system`.
- A tiny inline script (`ThemeScript.tsx`) reads that value before React
  hydrates and sets `html.dark` accordingly, so the first paint uses the
  correct theme — no white flash in dark mode.
- Choosing "system" hooks `matchMedia('(prefers-color-scheme: dark)')` so
  the theme follows the OS in real time.

---

## Privacy and GDPR

- **No analytics, no ad networks, no third-party trackers** are wired in.
- **Cookies used** — all strictly functional. The disclosure banner lists
  them by name so users can see exactly what is set and why:
  - `dg_device` — anonymous 32-hex random ID, set only when the user
    explicitly checks in to a course (via button or QR scan).
  - `dg_admin` — admin session, set only after a successful admin login.
  - `NEXT_LOCALE` — language preference (set by `next-intl`).
  - `theme` — light/dark preference, stored in `localStorage` (not a cookie).
- **Third-party data flow** — the OpenStreetMap tile layer is loaded
  directly from `tile.openstreetmap.org` in the user's browser. OSM's tile
  servers may see the visitor's IP; they do not set cookies. This is
  disclosed in the banner. Weather data from Open-Meteo is fetched
  server-side, so users' IPs are not sent to Open-Meteo.
- **Data retention** — check-ins persist as historical rows (`endedAt` is
  set on check-out; the row itself is not deleted). Issue reports persist
  until an admin removes them. There is no personal data on either.

---

## Accessibility

Reasonable baseline; not audited to WCAG-AA but written with it in mind.

- Skip-to-main link, focus-visible outline on every interactive element.
- ARIA on all dialogs (`role="dialog"`, `aria-modal`, labelledby, initial
  focus, Escape closes).
- Icon-only buttons carry `aria-label`; theme toggle uses `aria-pressed`;
  nav has `aria-label="Primary"`.
- Touch targets are at least 44×44px on interactive header/footer / dialog
  controls (`min-h-11`).
- Traffic-colour semantics are always paired with a text label — colour is
  never the only signal.
- `prefers-reduced-motion` disables the map fly-to animation and other
  transitions.

---

## Testing

```bash
npm test           # one-shot
npm run test:watch # dev feedback loop
```

- **73 tests, 6 files.** Vitest runs against a dedicated
  `prisma/test.db` (gitignored) that's reset via `prisma migrate deploy` at
  the start of a run and truncated before every test.
- `test/setup.ts` sets `DATABASE_URL` and `ADMIN_PASSWORD` before any app
  code imports the Prisma singleton.
- Route handlers are tested by calling the exported `GET` / `POST` / etc.
  directly with a real `Request`, so tests exercise the full validation +
  DB code paths. `next/headers` is mocked per test file with a
  controllable in-memory cookie store.

What's covered:

- `lib/weather.ts` — WMO emoji mapping, Open-Meteo mapping / failure /
  URL-shape.
- `lib/admin.ts` — `scrypt` hash/verify, salt uniqueness, role helpers
  (`isSuperuser`, `canEditCourse`, `editableCourseIds`).
- `lib/traffic.ts` — active-window boundary, zero-fill behaviour,
  per-course / per-device filtering.
- `/api/checkin` — validation, cookie minting, refresh vs create,
  ending stale sessions on other courses.
- `/api/ping`, `/api/checkout` — presence-based state transitions.
- `/api/issues` — validation, anonymous submit, device-id attachment,
  admin-only list with role-scoped filtering.
- `/api/admin/*` — email/password login and superuser bootstrap; permission
  gates for course create/edit/delete and issue PATCH; full `/api/admin/admins`
  CRUD with the "can't demote the last superuser" and "can't delete yourself"
  guards.

Not yet covered: React components (dialog behaviour, theme toggle,
banner) — add `@testing-library/react` if you want to close that gap.

---

## Deployment notes

- **Any Node host works** — Vercel, Fly, a plain VPS, a Docker container.
  The only runtime dependency is Node ≥ 20 and a writable disk for SQLite.
- **Do change `ADMIN_PASSWORD` and `SUPERUSER_EMAIL`** before deploying
  anywhere. `ADMIN_PASSWORD` is (a) the bootstrap password used to create the
  very first superuser account and (b) the HMAC secret for admin session
  cookies — rotating it invalidates every outstanding admin session.
- **Switching to Postgres** is a change of `datasource` in
  `prisma/schema.prisma` plus a new migration; the app does not use any
  SQLite-specific features.
- **Reverse proxy** — ensure `X-Forwarded-Proto` is forwarded so cookies
  are marked secure in production. Next.js handles this when
  `Node.js` runs behind a trusted proxy.
- **HTTPS is required in production** for `Secure` cookies and
  service-worker-adjacent features.

### Docker (sketch)

A minimal `Dockerfile` is easy to add — install deps, `npm run build`,
`CMD ["npm", "start"]`, and mount a volume for the SQLite file. Not
included in the repo today.

---

## Contributing

This is a small personal project; PRs are welcome but the scope is
deliberately kept tight — see [Project scope](#project-scope) above before
proposing new features.

House rules:

- Keep the app bilingual: every new user-visible string goes into both
  `messages/et.json` and `messages/en.json`.
- Prefer editing existing files over adding new ones.
- Every new API route ships with at least one Vitest test.
- Anonymity is a feature; do not add user accounts, session identifiers
  beyond `dg_device`, or any form of tracking without a very good reason.

---

## License

MIT. See `LICENSE` (add one if you fork; the upstream repo will carry
MIT once published).

---

## Contact and support

Built by [info@digiarendus.ee](mailto:info@digiarendus.ee).

If the project is useful to you, you can leave a tip at the URL configured
in `NEXT_PUBLIC_DONATE_URL` (default:
[buymeacoffee.com/digiarendus](https://buymeacoffee.com/digiarendus)).
Every euro goes toward hosting and course-data upkeep.

For bug reports and course additions, open an issue in this repository, or
use the in-app "Report an issue" button which routes to the admin panel.
