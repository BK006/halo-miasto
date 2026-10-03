// Supabase Edge Function: field worker app.
//   GET                          → the worker's profile and assigned tasks (open first)
//   POST { id, image, note? }    → close an assigned task with an "after" photo
//
// Identity: phone session from the `auth` function (x-session header), and the
// phone number must belong to a row in `workers`.
// Auth: publishable key in the `apikey` header (verify_jwt is off for non-JWT keys).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// Keep in sync with src/config/units.ts.
const UNIT_NAMES: Record<string, string> = {
  zdmk: "Zarząd Dróg Miasta Krakowa",
  sm: "Straż Miejska Miasta Krakowa",
  zzm: "Zarząd Zieleni Miejskiej w Krakowie",
  mpwik: "MPWiK w Krakowie",
  mpo: "MPO w Krakowie",
  um: "Urząd Miasta Krakowa – Biuro Interwencji",
};
const SIGNED_URL_TTL_S = 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, x-client-info, authorization, x-session",
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

function isAllowedKey(key: string | null): boolean {
  if (!key) return false;
  return envKeys("SUPABASE_PUBLISHABLE_KEYS").includes(key) || key === Deno.env.get("SUPABASE_ANON_KEY");
}

function admin() {
  const secret = envKeys("SUPABASE_SECRET_KEYS")[0] ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(Deno.env.get("SUPABASE_URL")!, secret, { auth: { persistSession: false } });
}

type Worker = { phone: string; name: string; unit_id: string };

async function currentWorker(req: Request, db: SupabaseClient): Promise<Worker | null> {
  const token = req.headers.get("x-session");
  if (!token || !UUID.test(token)) return null;
  const { data: session } = await db.from("resident_sessions").select("phone").eq("token", token).maybeSingle();
  if (!session) return null;
  const { data: worker } = await db
    .from("workers")
    .select("phone, name, unit_id")
    .eq("phone", session.phone)
    .maybeSingle();
  return worker ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!isAllowedKey(req.headers.get("apikey"))) return json({ error: "Unauthorized" }, 401);

  try {
    const db = admin();
    const worker = await currentWorker(req, db);
    if (!worker) {
      return json({ error: "Ten numer nie jest przypisany do żadnego pracownika." }, 403);
    }
    if (req.method === "GET") return await listTasks(db, worker);
    if (req.method === "POST") return await closeTask(req, db, worker);
    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("worker failed", err);
    return json({ error: "Coś poszło nie tak. Spróbuj ponownie." }, 500);
  }
});

async function listTasks(db: SupabaseClient, worker: Worker) {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await db
    .from("reports")
    .select(
      "id, public_no, category, summary, priority, priority_reason, status, address, lat, lng, reporters_count, created_at, assigned_at, resolved_at, resolution_note, photo_path, resolution_photo_path",
    )
    .eq("assigned_to", worker.phone)
    .or(`status.neq.resolved,resolved_at.gte.${since}`)
    .order("priority", { ascending: false })
    .limit(100);
  if (error) throw error;

  const paths = (data ?? []).flatMap((r) => [r.photo_path, r.resolution_photo_path]).filter(Boolean) as string[];
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await db.storage.from("photos").createSignedUrls(paths, SIGNED_URL_TTL_S);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return json({
    worker: { name: worker.name, phone: worker.phone, unitId: worker.unit_id, unitName: UNIT_NAMES[worker.unit_id] ?? worker.unit_id },
    tasks: (data ?? []).map((r) => ({
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
      reportersCount: r.reporters_count,
      createdAt: r.created_at,
      assignedAt: r.assigned_at,
      resolvedAt: r.resolved_at,
      resolutionNote: r.resolution_note,
      photoUrl: r.photo_path ? (urls.get(r.photo_path) ?? null) : null,
      resolutionPhotoUrl: r.resolution_photo_path ? (urls.get(r.resolution_photo_path) ?? null) : null,
    })),
  });
}

async function closeTask(req: Request, db: SupabaseClient, worker: Worker) {
  const body = (await req.json().catch(() => null)) as { id?: string; image?: string; note?: string } | null;
  if (!body?.id || !UUID.test(body.id)) return json({ error: "Brak zadania." }, 400);
  if (typeof body.image !== "string" || !body.image.startsWith("data:image/jpeg;base64,") || body.image.length > 4_000_000) {
    return json({ error: "Dodaj zdjęcie po naprawie." }, 400);
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

  const { data: report } = await db
    .from("reports")
    .select("id, status, assigned_to")
    .eq("id", body.id)
    .maybeSingle();
  if (!report || report.assigned_to !== worker.phone) return json({ error: "To zadanie nie jest przypisane do Ciebie." }, 403);
  if (report.status === "resolved") return json({ error: "To zadanie jest już zamknięte." }, 409);

  const base64 = body.image.slice(body.image.indexOf(",") + 1);
  const photo = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const path = `after/${crypto.randomUUID()}.jpg`;
  const { error: uploadErr } = await db.storage.from("photos").upload(path, photo, { contentType: "image/jpeg" });
  if (uploadErr) throw uploadErr;

  const resolvedAt = new Date().toISOString();
  const { error } = await db
    .from("reports")
    .update({ status: "resolved", resolution_photo_path: path, resolution_note: note || null, resolved_at: resolvedAt })
    .eq("id", report.id);
  if (error) throw error;
  await db
    .from("status_history")
    .update({ note: `zamknięte przez: ${worker.name}` })
    .eq("report_id", report.id)
    .eq("status", "resolved");

  return json({ ok: true, resolvedAt });
}
