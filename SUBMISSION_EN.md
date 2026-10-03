# Project submission – HackYeah 2026 (HackTribe)

> Fields in [BRACKETS] still need filling in. Never put the panel password into this file – only into the HackTribe form.

## 1. Project Name
Halo Miasto

## 2. Published
No

## 3. Problem
Reporting a broken streetlight or a pothole still means phoning or e-mailing the right city unit – and residents rarely know which one. 44% of Poles believe they have no influence on matters of their own town (CBOS, report 56/2021, April 2021, N=1131). Cities are flooded with calls: Warsaw's 19115 contact centre received 687,857 reports in 2025, over 305,000 of them by phone – even though the city has its own app. Kraków's City Guard alone takes about 311 reports a day (≈113,500 in 2025), and 80% of the 30,000+ reports to Kraków's Roads Authority in 2023 came in by phone.

Both sides lose. Residents give up: they don't know where to report, have to describe the location over the phone, and never hear what happened next. The city gets reports with no precise location, no priority and many duplicates, which staff retype and sort by hand.

Sources: CBOS Komunikat 56/2021 (cbos.pl); um.warszawa.pl – MCK 19115 summary of 2025; krakow.pl – City Guard summary of 2025; ZDMK Annual Report 2023 (zdmk.krakow.pl).

## 4. Solution
Halo Miasto is a mobile web app (PWA) where reporting a city problem takes as long as taking a photo. It closes the loop between three roles:

- **Resident** signs in with a phone number (no e-mail, no password), takes a photo – location is attached automatically – and sends it in two taps. They follow the status live and see an "after" photo once it's fixed.
- **AI** (OpenAI vision with structured outputs) turns one photo into a category (1 of 11), a 1–10 priority with a reason, and a ready-to-send formal report addressed to the right city unit.
- **City office** gets a map with priority pins and a heatmap, KPIs and merged duplicates ("reported by 5 people"), and assigns a **field worker**, who closes the task with a mandatory photo of the fix.

**Humans stay in control:** residents review and can edit the report before sending; low AI confidence triggers a retake or manual category choice; the city can correct, reassign or reroute any report. **Privacy:** faces are blurred on the phone before upload, licence plates are kept only for parking reports, and all API keys live server-side.

**Prototype limits:** the SMS code is simulated (always 123-123), e-mails go to a test inbox, and category-to-unit routing is an assumption to verify with the city.

## 5. Challenges
OPEN TASK: SMART CITY

## 6. Cover image
[TO ADD – e.g. phone with the "Check report" screen next to the city panel map]

## 7. Idea stage
New idea

## 8. What's done so far and goal of your project
**Before the official start (about 30 min, Oct 3, ~10:20–10:51):** the idea and plan, a Next.js app skeleton (project setup, empty start screen), the first database schema, and config files listing categories and city units. This is visible in the repository history (first two commits).

**During HackYeah:** design system and screens (Claude Design); the full resident app (GDPR consent, phone sign-in, camera, AI analysis, report preview and editing, map location picker, live status, "My reports"); on-device face blurring; AI photo analysis in Supabase Edge Functions; report storage with duplicate detection and rate limiting; e-mail delivery; the city panel (map, heatmap, KPIs, filters, statuses, rerouting, worker assignment); the field-worker app with an after-repair photo; demo data; deployment on Vercel.

**Goal:** a pilot in one district of a chosen city, compared with a neighbouring district without Halo Miasto. We will measure time from report to acceptance and to repair, the share of reports made without a phone call, whether residents come back to report again, and how many duplicates the AI merged automatically.

## 9. Team status
Full team

## 10. Current team size
[2 or 3]

## 11. Needed skills
– (leave empty)

## 12. Skills comment
– (leave empty)

## 13. Your video presentation
[YOUTUBE LINK – unlisted]

## 14. Website
https://halo-miasto.vercel.app

## 15. Code Repository
https://github.com/BK006/halo-miasto

## 16. Instructions on how to open project
The demo runs in the browser, best on a phone (camera and GPS need HTTPS, which the link provides). On a desktop you can pick a photo from disk instead of using the camera. The interface is in Polish.

RESIDENT – https://halo-miasto.vercel.app
1. Accept the consent screen and sign in with any phone number. The (simulated) SMS code is 123-123.
2. Take a photo of a problem (pothole, streetlight, rubbish, car blocking a gate) or pick one from the gallery.
3. Check the AI result, optionally edit the report text, tap "Wyślij zgłoszenie" (Send report).
4. Tap "Śledź status" (Track status) – it updates live when the city changes it.

CITY OFFICE – https://halo-miasto.vercel.app/panel (best on a computer)
Password: [PANEL PASSWORD – type it only in the HackTribe form]
Map with pins and heatmap, filterable list, report details, status changes, worker assignment. Contains about 40 sample reports.

FIELD WORKER – https://halo-miasto.vercel.app/pracownik
Number 500 100 100 (Jan Kowalski, Roads Authority), code 123-123. A task assigned in the panel appears immediately; closing it requires an after-repair photo. Other accounts: 500 200 200 (City Guard), 500 300 300 (Waste).

RUN LOCALLY: see README in the repository (npm install, copy .env.example to .env.local with the public Supabase URL and key, npm run dev). Backend: supabase/functions/, database: supabase/migrations/.

AI TOOLS, APIS, MODELS AND LIBRARIES USED:
- OpenAI API (vision model, structured outputs) – photo analysis and report drafting
- Claude (Anthropic) – help with coding, UI design (Claude Design) and documentation
- MediaPipe Face Detector (Google) – on-device face detection
- Supabase – Postgres, Storage, Realtime, Edge Functions
- Next.js, React, Tailwind CSS, Leaflet, exifr, zod
- OpenStreetMap and Nominatim – maps and addresses (© OpenStreetMap contributors)
- Resend – e-mail delivery; Vercel – hosting

## 17. Presentation
[PDF – max 10 slides, max 10 MB]
