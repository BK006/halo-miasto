@AGENTS.md

# Zgłoś to – HackYeah 2026 (Smart City)

Citizen snaps a photo of a city issue → Claude vision classifies it (category, priority 1–10, confidence, personal data) and drafts a formal report → routed to a city unit → e-mailed → citizen tracks status; city panel shows map/heatmap.

- Stack: Next.js 16 (App Router, `src/`), Tailwind v4, Supabase (Postgres, Storage, anon auth, Realtime), Claude API, Resend, Leaflet.
- Code and comments in English; all UI text and report content in Polish.
- Domain constants live in `src/lib/domain.ts`; categories in `src/config/categories.ts`; routing in `src/config/units.ts`.
- DB schema: `supabase/migrations/`. Browser never writes to the DB – writes go through API routes with the service role key.
- Priority: demo over completeness. Keep the photo → JSON → report → e-mail → status path working at all times.
