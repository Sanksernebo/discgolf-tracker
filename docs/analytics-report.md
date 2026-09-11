# Course Analytics — Data Sheet & Sales Pitch

**Product:** Disc Golf Tracker admin analytics
**Audience:** Course owners, park operators, municipalities, tourism boards
**Version:** 1.0 — September 2026

---

## 1. Why this matters

Every disc golf course today runs on hunches. Owners guess how busy Saturday morning will be, when to schedule mowing, whether to open earlier in July, whether their new hole 7 is more or less popular than the old one. The player app already knows the answer to all of those questions — it just doesn't usually tell the operator.

This module turns the check-in stream that visitors already generate on their phones into an operational dashboard the course owner sees in a browser. Same data, presented with intent.

**Elevator pitch:**
> "Every time a player scans your QR or checks in, we already record it — so you can see the peaks, the quiet slots and the returning visitors. No cameras, no surveys, no manual counts, and no personal data leaves your course."

---

## 2. What the dashboard shows

The admin panel adds a new **Analytics** tab. Each metric can be filtered by **time range** (24 h / 7 days / 30 days / 365 days / all time) and by **course** (superuser can also see the "all courses" roll-up).

| Metric | What it answers | Example decision it unlocks |
|---|---|---|
| **Players** | How many people played, counting groups per person | Staff scheduling, event pricing |
| **Check-ins** | How many rounds started | Round-length assumptions, tee-time spacing |
| **Unique visitors** | How many distinct devices played in the window | True demand vs. repeat traffic |
| **% returning** | Share of devices that came ≥2 times | Loyalty / word-of-mouth strength |
| **Avg party size** | Mean players per round | Family vs. solo character of the course |
| **Avg round length** | Mean session duration | Whether a 9-hole extension would fit demand |
| **On-course now** | Live player count | Real-time overcrowding, dispatch mowing |
| **Peak hour** | Busiest hour of the day | When to schedule tournaments or maintenance |
| **Peak weekday** | Busiest day of the week | Weekend vs. weekday staffing |
| **Daily trend chart** | Players per day across the range | Seasonality, weather correlation |
| **Hour-of-day chart** | 24-bar histogram | Opening hours, café hours, marshal shifts |
| **Weekday chart** | 7-bar histogram | Weekly rhythm at a glance |
| **Weekday × hour heatmap** | 168-cell grid, darker = busier | Reveals combined patterns (e.g. "Friday 17:00 slot") |
| **% change vs. previous period** | Delta chip on every summary card | Are we growing? Was that push campaign worth it? |
| **Per-course breakdown** | Ranked table when multiple courses are in scope | Portfolio view for chains / municipalities |

Every chart is exportable by view (screenshot). All numbers respect the time zone `Europe/Tallinn`, so "18:00" means the local hour the player was actually on the course.

---

## 3. Data behind the numbers

The entire analytics module reads from **exactly one table**: `CheckIn`. That's a deliberate design choice — the smaller the personal-data surface, the smaller the compliance surface.

### 3.1 What is collected

Each `CheckIn` row contains six fields:

| Column | Type | Source | Why it's stored |
|---|---|---|---|
| `courseId` | string | The QR the player scanned, or the button on the course page | To scope the round to the right course |
| `deviceId` | random 32-char token | Browser cookie `dg_device` (set only on check-in) | To distinguish repeat sessions and prevent duplicates |
| `partySize` | integer 1–8 | Player picks from the +/– UI | To count all players in a group, not just the phone |
| `startedAt` | timestamp | Server clock when the check-in POST arrives | To time-bucket the round |
| `lastPingAt` | timestamp | Refreshed by the player's phone every 5 minutes | To know if the round is still live |
| `endedAt` | timestamp \| null | Set on "End round" click or by the 3-hour hard cap | To compute round length |

That's it. **Not collected:** no name, no email, no phone number, no IP address stored on the row, no GPS coordinates, no card details, no photos, no scoring history. The `deviceId` is a random token — it can't be reversed into an identity without additional data we don't have.

### 3.2 How each metric is derived

| Dashboard number | Formula |
|---|---|
| Players | `SUM(partySize)` over rows in the window |
| Check-ins | `COUNT(*)` over rows in the window |
| Unique visitors | `COUNT(DISTINCT deviceId)` over rows in the window |
| % returning | `COUNT(deviceId with ≥2 rows in window) / COUNT(DISTINCT deviceId)` |
| Avg party size | `SUM(partySize) / COUNT(*)` |
| Avg round length | `AVG(COALESCE(endedAt, lastPingAt) - startedAt)` in minutes |
| On-course now | `SUM(partySize) WHERE endedAt IS NULL AND lastPingAt > now-3h AND startedAt > now-3h` |
| Daily bucket | Group by `startedAt::date` in Europe/Tallinn |
| Hourly bucket | Group by hour(`startedAt` in Europe/Tallinn), 0–23 |
| Weekday bucket | Group by weekday(`startedAt` in Europe/Tallinn), Monday-first |
| Heatmap cell | Group by (weekday, hour) — 7 × 24 = 168 cells |
| Δ vs. previous period | Same computation over `[from - windowLength, from)` |
| Per-course row | Same aggregates grouped by `courseId` |

Everything is computed on the server, filtered by the admin's course scope, then delivered as JSON to the browser. There is no client-side data warehouse and no cross-course leakage.

### 3.3 Access control

- **Superuser** (platform operator) — sees aggregates for all courses; can filter to any one.
- **Course admin** — only sees courses assigned to their account. Enforced server-side in `editableCourseIds(admin)`; a course admin trying to pass a foreign `courseId=…` in the URL gets an empty result, not someone else's data.
- **Public players** — cannot see analytics at all. They see only the live traffic bubble on the map, which is the same aggregate `SUM(partySize)` that has always been public.

---

## 4. Privacy posture (this is a selling point)

Because the platform never gathers personal data in the first place, it side-steps most of what makes analytics products a compliance chore:

- **No third-party analytics or ad cookies.** Not Google Analytics, not Meta Pixel, not Hotjar. Nothing.
- **No IP addresses stored** on check-in or issue rows.
- **No profile** — a `deviceId` is a random string, never linked to a name, email, phone, or payment method.
- **Course admins never see individual device IDs.** The dashboard only ever shows sums and averages.
- **Right-to-erasure is a public button.** Any visitor can hit "Delete my data" on the privacy page and every row keyed to their device disappears, atomically.
- **Retention is bounded.** Raw check-ins are pruned after 24 months; closed issue reports after 12 months. Analytics aggregates are unaffected because they're derived counts, not personal data.
- **EU-hosted.** All data lives on European Economic Area infrastructure.
- **Transparent legal basis.** Documented per data category in the privacy policy: performance-of-service for the check-in cookie, legitimate interest for course operator analytics, consent for push notifications.
- **GDPR & ePrivacy compliant.** The only cookies set without prior consent are strictly functional under ePrivacy Art 5(3)(b) — session auth, language preference, and the check-in identifier that the user explicitly triggered.

**In one sentence:** "You get a proper analytics dashboard about your course, and we still don't hold a single row of personal data about your players."

---

## 5. Value propositions by customer type

### Independent course owners
> "Which hours are you paying staff for that nobody uses? Which Saturday actually needs a marshal? When did visits drop off — was it weather, or that closed hole? The dashboard answers all three, in the same tab, before you finish your coffee."

- Peak-hour + weekday × hour heatmap → **staffing decisions**.
- Return rate + monthly delta → **is the course still fun / are your improvements working**.
- Live "on-course now" → **maintenance windows without disturbing anyone**.

### Municipalities & park authorities
> "Justify the budget line with numbers, not vibes."

- Yearly player counts per course → **usage reports for city council**.
- Delta vs. previous year → **ROI on capital improvements** (new tees, better signage).
- Portfolio view of all municipal courses in one table → **compare and rebalance investment**.

### Tourism boards & disc-golf destinations
> "Prove the season and prove the reach."

- Seasonality on the daily chart → **when to run campaigns**.
- Returning-visitor rate → **loyalty and word-of-mouth strength**.
- Weekday × hour heatmap → **when to schedule events and clinics**.

### Course chains / franchises
> "One login, every course, ranked."

- Superuser view ranks courses by traffic → **spot underperformers early**.
- Same schema everywhere → **portfolio-level KPIs without integration work**.
- Course admins get their own scoped view → **local managers still own their data**.

---

## 6. What we do **not** offer (and why)

Being upfront about the boundaries is part of the pitch:

- **No individual player tracking.** We can't tell you that "Karl played 12 rounds this month" because we don't know it's Karl. We can tell you 12 rounds happened on some device.
- **No scorecards or throws.** This is a traffic and check-in system, not a scoring app.
- **No location tracing.** We know a player checked in to a course; we don't follow their phone between check-ins.
- **No demographic breakdowns.** We don't ask age, gender, home town, or any of it.
- **No API access to raw rows.** Only aggregated results leave the database toward the admin browser.

If any of those are must-haves, the customer needs a different (heavier, riskier) product. Everyone else gets a leaner one.

---

## 7. Roadmap (if the customer asks "what's next?")

- **CSV export** on each panel, so numbers can drop into the customer's own report.
- **Weather correlation** — we already cache Open-Meteo forecasts per course; overlaying observed weather onto the daily chart would explain "why did last Thursday flatline" in one glance.
- **Alerts** — email or push when today's traffic is 2× the trailing average, or drops to zero for the first time in the week.
- **Event overlays** — mark tournament days on the daily chart so before/after impact is obvious.

Each of these is additive; none of them requires collecting more personal data than we already do.

---

## 8. One-page summary for a slide

> Disc Golf Tracker turns anonymous check-ins into a real analytics dashboard for course owners: live occupancy, daily / weekly / yearly trends, hour-of-day and weekday-hour heatmaps, unique and returning visitor counts, average group size and round length, and period-over-period growth — all scoped per course. All of it is built on a single database column (`CheckIn`), all of it is aggregated before it leaves the server, and none of it involves personal profiles, ad cookies, or third-party trackers. GDPR- and ePrivacy-compliant by design, with a public one-click "delete my data" button. Operationally useful today; commercially defensible tomorrow.

---

## 9. Contact

Digiarendus OÜ — info@digiarendus.ee
