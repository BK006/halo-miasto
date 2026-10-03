// Supabase Edge Function: city panel API, guarded by a shared passcode.
//   GET                          → reports (newest 500) with photos, history and assignment; field workers
//   POST { id, status }          → change status (trigger logs history; residents see it live)
//   POST { id, unitId }          → hand the report over to another unit
//   POST { id, assignee }        → assign to a field worker (phone) or unassign (null); accepts the report
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
  const [{ data, error }, { data: workers, error: wErr }] = await Promise.all([
    db
      .from("reports")
      .select(
        "id, public_no, category, summary, priority, priority_reason, status, address, lat, lng, unit_id, report_text, reporters_count, created_at, photo_path, assigned_to, assigned_at, resolution_photo_path, resolution_note, resolved_at, status_history(status, changed_at, note)",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    db.from("workers").select("phone, name, unit_id").order("name"),
  ]);
  if (error) throw error;
  if (wErr) throw wErr;
  const names = new Map((workers ?? []).map((w) => [w.phone, w.name]));

  const paths = (data ?? []).flatMap((r) => [r.photo_path, r.resolution_photo_path]).filter(Boolean) as string[];
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await db.storage.from("photos").createSignedUrls(paths, SIGNED_URL_TTL_S);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return json({
    workers: (workers ?? []).map((w) => ({ phone: w.phone, name: w.name, unitId: w.unit_id })),
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
      assignedTo: r.assigned_to,
      assignedName: r.assigned_to ? (names.get(r.assigned_to) ?? r.assigned_to) : null,
      assignedAt: r.assigned_at,
      resolutionPhotoUrl: r.resolution_photo_path ? (urls.get(r.resolution_photo_path) ?? null) : null,
      resolutionNote: r.resolution_note,
      resolvedAt: r.resolved_at,
      history: ((r.status_history ?? []) as { status: string; changed_at: string; note: string | null }[])
        .map((h) => ({ status: h.status, changedAt: h.changed_at, note: h.note }))
        .sort((a, b) => a.changedAt.localeCompare(b.changedAt)),
    })),
  });
}

async function update(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { id?: string; status?: string; unitId?: string; assignee?: string | null }
    | null;
  if (!body?.id) return json({ error: "Brak zgłoszenia." }, 400);
  const db = admin();

  const patch: Record<string, string | null> = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return json({ error: "Nieprawidłowy status." }, 400);
    patch.status = body.status;
  }
  if (body.unitId !== undefined) {
    if (!UNIT_IDS.includes(body.unitId)) return json({ error: "Nieznana jednostka." }, 400);
    patch.unit_id = body.unitId;
  }
  if (body.assignee !== undefined) {
    if (body.assignee === null) {
      patch.assigned_to = null;
      patch.assigned_at = null;
    } else {
      const { data: worker } = await db.from("workers").select("phone").eq("phone", body.assignee).maybeSingle();
      if (!worker) return json({ error: "Nieznany pracownik." }, 400);
      patch.assigned_to = worker.phone;
      patch.assigned_at = new Date().toISOString();
      // Assigning work means the city has accepted the report.
      const { data: current } = await db.from("reports").select("status").eq("id", body.id).maybeSingle();
      if (current && (current.status === "new" || current.status === "sent")) patch.status = "accepted";
    }
  }
  if (Object.keys(patch).length === 0) return json({ error: "Brak zmian." }, 400);

  const { error } = await db.from("reports").update(patch).eq("id", body.id);
  if (error) throw error;
  return json({ ok: true });
}
