@AGENTS.md

# Halo Miasto – HackYeah 2026 (Smart City)

Citizen snaps a photo of a city issue → OpenAI vision (Responses API, structured outputs) in the Supabase Edge Function `analyze` classifies it (category, priority 1–10, confidence, personal data) and drafts a formal report → routed to a city unit → e-mailed → citizen tracks status; city panel shows map/heatmap.

- Stack: Next.js 16 (App Router, `src/`), Tailwind v4, Supabase (Postgres, Storage, anon auth, Realtime), OpenAI API via Supabase Edge Function `supabase/functions/analyze` (key only in Edge Function secrets – never in .env), Resend, Leaflet.
- Code and comments in English; all UI text and report content in Polish.
- Domain constants live in `src/lib/domain.ts`; categories in `src/config/categories.ts`; routing in `src/config/units.ts`.
- DB schema: `supabase/migrations/`. Browser never writes to the DB – writes go through Supabase Edge Functions (`supabase/functions/*`) that hold all secrets; the app env has public values only.
- Residents sign in with a phone number (`auth` function). No SMS provider yet: the code is always 123-123 and the UI says so.
- Priority (1–10) is for the city panel only – never show it to residents.
- The project folder name ends in `.nosync` on purpose: it keeps iCloud from evicting files. Do not rename it.
- Priority: demo over completeness. Keep the photo → JSON → report → e-mail → status path working at all times.
- AI categories/units are duplicated in `supabase/functions/analyze/index.ts` – keep them in sync with `src/config/`.
