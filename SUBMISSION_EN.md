# Project submission – HackYeah 2026 (HackTribe)

> Draft due today 20:00, editable until tomorrow 11:00. Fields in [BRACKETS] still need filling in.

## 1. Project Name
Halo Miasto ("Hello, City")

## 2. Published
No (draft stage)

## 3. Problem
Reporting a broken streetlight or a pothole still means phoning or e-mailing the right city unit – and residents rarely know which one. Kraków's Municipal Roads Authority (ZDMK) alone received over 30,000 reports from residents in 2023 (as of end of October), about 80% of them by phone – roughly 3,000 calls a month, with an average wait of about 53 seconds to get through. The most common were road infrastructure defects (3,772), traffic light failures (3,402) and damaged road signs (3,003). And ZDMK is only one of several units: roads, city guard, greenery, water and waste each have their own reporting channel.

Both sides lose. Residents give up because they don't know where or how to report (especially older people without e-mail). The city receives reports with no precise location, no priority and many duplicates, which staff have to retype and sort by hand.

Source: ZDMK Annual Report 2023, https://zdmk.krakow.pl/wp-content/uploads/2023/12/WEB_ZDMK_raport_roczny_2023.pdf

## 4. Solution
Halo Miasto is a mobile web app (PWA) where reporting a city problem takes as long as taking a photo. It closes the loop between three roles:

- **Resident** signs in with a phone number (no e-mail, no password), takes a photo – location is attached automatically – and sends it in two taps. They follow the status live, and see an "after" photo once it's fixed.
- **AI** (OpenAI vision with structured outputs) turns one photo into a category (1 of 11), a 1–10 priority with a reason, and a ready-to-send formal report addressed to the right one of 6 Kraków city units.
- **City office** gets a map with priority pins and a heatmap, KPIs, merged duplicates ("reported by 5 people"), and assigns a **field worker**, who closes the task with a mandatory photo of the fix.

**Humans stay in control:** residents review and can edit the report before sending; low AI confidence triggers a retake or manual category choice; the city can correct, reassign or reroute any report. **Privacy:** faces are blurred on the phone before upload; licence plates are kept only for parking reports; all API keys live server-side.

**Prototype limits:** SMS code is simulated (always 123-123), e-mails go to a test inbox, and the category-to-unit routing is our assumption, still to be verified with the city.

## 5. Challenges
OPEN TASK: SMART CITY

## 6. Cover image
[TO ADD – e.g. phone with the "Check report" screen + the city panel map]

## 7. Idea stage
New idea

## 8. What's done so far and goal of your project
**Before the official start (about 30 min, Oct 3, ~10:20–10:51):** the idea and plan, a Next.js app skeleton (project setup, empty start screen), the first database schema, and config files listing categories and city units. This is visible in the repository history (first two commits).

**During HackYeah:** design system and screens (Claude Design); the full resident app (GDPR consent, phone sign-in, camera, AI analysis, report preview and editing, map location picker, live status, "My reports"); on-device face blurring; AI photo analysis in Supabase Edge Functions; report storage with duplicate detection and rate limiting; e-mail delivery; the city panel (map, heatmap, KPIs, filters, statuses, rerouting, worker assignment); the field-worker app with an after-repair photo; Kraków demo data; deployment on Vercel.

**Goal:** a pilot in one Kraków district, integrated with the city's existing reporting system instead of e-mail. We would measure time from report to acceptance, the share of reports made without a phone call, and the number of duplicates merged automatically.

## 9. Team status
Full team

## 10. Current team size
[2 or 3]

## 11. Needed skills
– (not looking for teammates)

## 12. Skills comment
–

## 13. Your video presentation
[YOUTUBE LINK – unlisted]

## 14. Website
https://halo-miasto.vercel.app

## 15. Code Repository
[REPO LINK]

## 16. Instructions on how to open project
The demo runs in the browser, best on a phone (camera and GPS need HTTPS, which the link provides). On a desktop you can pick a photo from disk instead of using the camera. The interface is in Polish.

**Resident – https://halo-miasto.vercel.app**
1. Accept the consent screen and sign in with any phone number. The (simulated) SMS code is **123-123**.
2. Take a photo of a problem (pothole, streetlight, rubbish, car blocking a gate) or pick one from the gallery.
3. Check the AI result, optionally edit the report text, tap "Wyślij zgłoszenie" (Send report).
4. Tap "Śledź status" (Track status) – it updates live when the city changes it.

**City office – https://halo-miasto.vercel.app/panel** (best on a computer)
Password: **[PANEL PASSWORD]**. Map with pins and heatmap, filterable list, report details, status changes, worker assignment. The panel contains demo data (about 40 sample reports in Kraków).

**Field worker – https://halo-miasto.vercel.app/pracownik**
Number **500 100 100** (Jan Kowalski, Roads Authority), code **123-123**. A task assigned in the panel appears immediately; closing it requires an after-repair photo. Other accounts: 500 200 200 (City Guard), 500 300 300 (Waste).

**Run locally:** `npm install`, copy `.env.example` to `.env.local` (public Supabase URL and key), `npm run dev`. Backend functions and database schema: `supabase/functions/`, `supabase/migrations/`.

**AI tools, APIs, models and libraries used:**
- OpenAI API (vision model, structured outputs) – photo analysis and report drafting
- Claude (Anthropic) – help with coding, UI design (Claude Design) and documentation
- MediaPipe Face Detector (Google) – on-device face detection
- Supabase – Postgres, Storage, Realtime, Edge Functions
- Next.js, React, Tailwind CSS, Leaflet, exifr, zod
- OpenStreetMap and Nominatim – maps and addresses (© OpenStreetMap contributors)
- Resend – e-mail delivery
- Vercel – hosting

## 17. Presentation
[PDF – max 10 slides, max 10 MB]
