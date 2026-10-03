// Supabase Edge Function: city panel API, guarded by a shared passcode.
//   GET                          → all reports (newest 500) with signed photo URLs and status history
//   POST { id, status }          → change status (trigger logs history; residents see it live)
//   POST { id, unitId }          → hand the report over to another unit
//
// Secrets: PANEL_PASSCODE (Edge Function secret). The passcode arrives in the
// `x-panel-passcode` header. Prototype-grade auth – see README limitations.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const STATUSES = ["new", "sent", "accepted", "resolved"];
// Keep in sync with src/config/units.ts.
const UNIT_IDS = ["zdmk", "sm", "zzm", "mpwik", "mpo", "um"];
const SIGNED_URL_TTL_S = 60 * 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, x-client-info, authorization, x-panel-passcode, x-session",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function envKeys(name: string): string[] {
  try {
    return Object.values(JSON.parse(Deno.env.get(name) ?? "{}") as Record<string, string>);
  } catch {
    return [];
  }
}

function admin() {
  const secret = envKeys("SUPABASE_SECRET_KEYS")[0] ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(Deno.env.get("SUPABASE_URL")!, secret, { auth: { persistSession: false } });
}

// Constant-time comparison so the passcode cannot be guessed by timing.
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const expected = Deno.env.get("PANEL_PASSCODE");
  if (!expected) return json({ error: "Panel nie jest skonfigurowany (brak PANEL_PASSCODE)." }, 503);
  if (!safeEqual(req.headers.get("x-panel-passcode") ?? "", expected)) {
    return json({ error: "Nieprawidłowe hasło." }, 401);
  }

  try {
    if (req.method === "GET") return await list();
    if (req.method === "POST") return await update(req);
    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("panel failed", err);
    return json({ error: "Coś poszło nie tak. Spróbuj ponownie." }, 500);
  }
});

async function list() {
  const db = admin();
  const { data, error } = await db
    .from("reports")
    .select(
      "id, public_no, category, summary, priority, priority_reason, status, address, lat, lng, unit_id, report_text, reporters_count, created_at, photo_path, status_history(status, changed_at, note)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const paths = (data ?? []).map((r) => r.photo_path).filter(Boolean) as string[];
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await db.storage.from("photos").createSignedUrls(paths, SIGNED_URL_TTL_S);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return json({
    reports: (data ?? []).map((r) => ({
      id: r.id,
      publicNo: r.public_no,
      category: r.category,
      summary: r.summary,
      priority: r.priority,
      priorityReason: r.priority_reason,
      status: r.status,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      unitId: r.unit_id,
      unitName: r.unit_id,
      reportText: r.report_text,
      reportersCount: r.reporters_count,
      createdAt: r.created_at,
      photoUrl: r.photo_path ? (urls.get(r.photo_path) ?? null) : null,
      history: ((r.status_history ?? []) as { status: string; changed_at: string; note: string | null }[])
        .map((h) => ({ status: h.status, changedAt: h.changed_at, note: h.note }))
        .sort((a, b) => a.changedAt.localeCompare(b.changedAt)),
    })),
  });
}

async function update(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: string; status?: string; unitId?: string } | null;
  if (!body?.id) return json({ error: "Brak zgłoszenia." }, 400);

  const patch: Record<string, string> = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return json({ error: "Nieprawidłowy status." }, 400);
    patch.status = body.status;
  }
  if (body.unitId !== undefined) {
    if (!UNIT_IDS.includes(body.unitId)) return json({ error: "Nieznana jednostka." }, 400);
    patch.unit_id = body.unitId;
  }
  if (Object.keys(patch).length === 0) return json({ error: "Brak zmian." }, 400);

  const { error } = await admin().from("reports").update(patch).eq("id", body.id);
  if (error) throw error;
  return json({ ok: true });
}
