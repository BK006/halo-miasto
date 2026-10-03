// Supabase Edge Function: create and read reports.
//   POST              → submit a reviewed report (rate limit → duplicate merge → store → e-mail → "sent")
//   GET ?ids=a,b,c    → reports with status history and signed photo URLs (status links)
//   GET ?mine=1       → reports submitted by the signed-in phone number (x-session header)
//
// Secrets: the service key comes from the platform (SUPABASE_SECRET_KEYS / SUPABASE_SERVICE_ROLE_KEY);
// RESEND_API_KEY, DEMO_EMAIL_TO and EMAIL_FROM are Edge Function secrets. Nothing lives in the app's env.
// Auth: publishable key in the `apikey` header, checked in code (verify_jwt is off for non-JWT keys).
// Resident identity: session token from the `auth` function in the `x-session` header.
//
// Keep UNITS/ROUTING/LABELS in sync with src/config/units.ts and src/config/categories.ts.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@4";

const UNITS: Record<string, { name: string; email: string }> = {
  zdmk: { name: "Zarząd Dróg Miasta Krakowa", email: "zdmk@demo.zglos.to" },
  sm: { name: "Straż Miejska Miasta Krakowa", email: "straz@demo.zglos.to" },
  zzm: { name: "Zarząd Zieleni Miejskiej w Krakowie", email: "zielen@demo.zglos.to" },
  mpwik: { name: "MPWiK w Krakowie", email: "mpwik@demo.zglos.to" },
  mpo: { name: "MPO w Krakowie", email: "mpo@demo.zglos.to" },
  um: { name: "Urząd Miasta Krakowa – Biuro Interwencji", email: "interwencje@demo.zglos.to" },
};

const CATEGORIES: Record<string, { label: string; unit: string }> = {
  pothole: { label: "Dziura w jezdni", unit: "zdmk" },
  damaged_sidewalk: { label: "Uszkodzony chodnik", unit: "zdmk" },
  broken_streetlight: { label: "Zepsuta latarnia", unit: "zdmk" },
  traffic_sign: { label: "Znak lub sygnalizacja", unit: "zdmk" },
  illegal_dumping: { label: "Nielegalne wysypisko", unit: "sm" },
  illegal_parking: { label: "Auto blokujące wjazd", unit: "sm" },
  graffiti: { label: "Graffiti", unit: "sm" },
  overflowing_bin: { label: "Przepełniony kosz", unit: "mpo" },
  flooding: { label: "Zalanie / awaria wodna", unit: "mpwik" },
  greenery: { label: "Drzewo / zieleń", unit: "zzm" },
  other: { label: "Inny problem", unit: "um" },
};
const CATEGORY_IDS = Object.keys(CATEGORIES) as [string, ...string[]];

const RATE_LIMIT_PER_HOUR = 5;
const DUPLICATE_RADIUS_M = 50;
const DUPLICATE_WINDOW_H = 72;
const SIGNED_URL_TTL_S = 60 * 60;

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Phone number of the signed-in resident, or null.
async function sessionPhone(req: Request, db: SupabaseClient): Promise<string | null> {
  const token = req.headers.get("x-session");
  if (!token || !UUID.test(token)) return null;
  const { data } = await db.from("resident_sessions").select("phone").eq("token", token).maybeSingle();
  return data?.phone ?? null;
}

const Body = z.object({
  deviceId: z.uuid(),
  consentVersion: z.string().min(1),
  image: z.string().startsWith("data:image/jpeg;base64,").max(4_000_000),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().max(300),
  category: z.enum(CATEGORY_IDS),
  summary: z.string().min(1).max(500),
  priority: z.number().int().min(1).max(10),
  priorityReason: z.string().max(500),
  confidence: z.number().min(0).max(1),
  personalData: z.object({ faces: z.boolean(), license_plates: z.boolean(), plates_needed: z.boolean() }),
  reportText: z.string().min(1).max(4000),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!isAllowedKey(req.headers.get("apikey"))) return json({ error: "Unauthorized" }, 401);
  try {
    if (req.method === "POST") return await createReport(req);
    if (req.method === "GET") return await listReports(req, new URL(req.url));
    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("reports failed", err);
    return json({ error: "Coś poszło nie tak. Spróbuj ponownie." }, 500);
  }
});

async function createReport(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Nieprawidłowe dane zgłoszenia." }, 400);
  const b = parsed.data;
  const db = admin();
  const phone = await sessionPhone(req, db);

  // 1. Rate limit per phone number (or per device when not signed in).
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  let countQuery = db.from("submissions").select("id", { count: "exact", head: true }).gte("created_at", since);
  countQuery = phone ? countQuery.eq("phone", phone) : countQuery.eq("user_id", b.deviceId);
  const { count, error: countErr } = await countQuery;
  if (countErr) throw countErr;
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return json({ error: `Limit to ${RATE_LIMIT_PER_HOUR} zgłoszeń na godzinę. Spróbuj później.` }, 429);
  }

  const base64 = b.image.slice(b.image.indexOf(",") + 1);
  const photo = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const photoPath = `${crypto.randomUUID()}.jpg`;
  const { error: uploadErr } = await db.storage.from("photos").upload(photoPath, photo, { contentType: "image/jpeg" });
  if (uploadErr) throw uploadErr;

  const unitId = CATEGORIES[b.category].unit;
  const unit = UNITS[unitId];
  const submission = { user_id: b.deviceId, phone, photo_path: photoPath, consent_version: b.consentVersion };

  // 2. Same category nearby and recent → join the existing report.
  const { data: dupId, error: dupErr } = await db.rpc("find_duplicate", {
    p_category: b.category,
    p_lat: b.lat,
    p_lng: b.lng,
    radius_m: DUPLICATE_RADIUS_M,
    window_h: DUPLICATE_WINDOW_H,
  });
  if (dupErr) throw dupErr;

  if (dupId) {
    const { data: existing, error } = await db
      .from("reports")
      .select("id, public_no, reporters_count, created_at")
      .eq("id", dupId)
      .single();
    if (error || !existing) throw error;
    const reportersCount = existing.reporters_count + 1;
    await db.from("reports").update({ reporters_count: reportersCount }).eq("id", existing.id);
    await db.from("submissions").insert({ report_id: existing.id, ...submission });
    return json({
      id: existing.id,
      publicNo: existing.public_no,
      duplicate: true,
      reportersCount,
      firstAt: existing.created_at,
      unitName: unit.name,
    });
  }

  // 3. New report.
  const { data: report, error: insErr } = await db
    .from("reports")
    .insert({
      category: b.category,
      summary: b.summary,
      priority: b.priority,
      priority_reason: b.priorityReason,
      confidence: b.confidence,
      has_faces: b.personalData.faces,
      has_plates: b.personalData.license_plates,
      plates_needed: b.personalData.plates_needed && b.category === "illegal_parking",
      lat: b.lat,
      lng: b.lng,
      address: b.address,
      unit_id: unitId,
      report_text: b.reportText,
      photo_path: photoPath,
      created_by: b.deviceId,
    })
    .select("id, public_no, created_at")
    .single();
  if (insErr || !report) throw insErr;

  await db.from("submissions").insert({ report_id: report.id, ...submission });

  // 4. Deliver (demo inbox). Without e-mail config the demo still advances to "sent";
  //    the history note records what actually happened.
  const note = await sendEmail({ ...b, publicNo: report.public_no, unit, base64 });
  await db.from("reports").update({ status: "sent" }).eq("id", report.id);
  await db.from("status_history").update({ note }).eq("report_id", report.id).eq("status", "sent");

  return json({
    id: report.id,
    publicNo: report.public_no,
    duplicate: false,
    reportersCount: 1,
    firstAt: report.created_at,
    unitName: unit.name,
  });
}

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function sendEmail(r: {
  publicNo: string;
  unit: { name: string; email: string };
  category: string;
  priority: number;
  address: string;
  lat: number;
  lng: number;
  reportText: string;
  base64: string;
}): Promise<string> {
  const key = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("DEMO_EMAIL_TO");
  if (!key || !to) return "demo: e-mail pominięty (brak konfiguracji)";

  const label = CATEGORIES[r.category].label;
  const level = r.priority >= 7 ? "wysoka" : r.priority >= 4 ? "średnia" : "niska";
  const urgency = `${r.priority}/10 (${level})`;
  const mapsUrl = `https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=19/${r.lat}/${r.lng}`;
  const coords = `${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}`;

  const text = [
    `Do: ${r.unit.name} <${r.unit.email}>  (wersja demonstracyjna – przekierowano)`,
    `Numer zgłoszenia: ${r.publicNo}`,
    `Kategoria: ${label}`,
    `Pilność: ${urgency}`,
    `Miejsce: ${r.address} (${coords})`,
    `Mapa: ${mapsUrl}`,
    "",
    r.reportText,
  ].join("\n");

  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:22px;color:#14171C;max-width:600px">
<p style="color:#636A75;font-size:13px">Do: ${escape(r.unit.name)} &lt;${escape(r.unit.email)}&gt; · wersja demonstracyjna, przekierowano</p>
<table style="border-collapse:collapse;margin:12px 0">
<tr><td style="padding:4px 12px 4px 0;color:#636A75">Numer</td><td><b>${escape(r.publicNo)}</b></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#636A75">Kategoria</td><td>${escape(label)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#636A75">Pilność</td><td>${escape(urgency)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#636A75">Miejsce</td><td>${escape(r.address)}<br><a href="${mapsUrl}">${coords}</a></td></tr>
</table>
<p style="white-space:pre-line">${escape(r.reportText)}</p>
<p style="color:#636A75;font-size:13px">Zdjęcie w załączniku. Twarze zostały rozmyte na urządzeniu zgłaszającego.</p>
</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") || "Zglos to <onboarding@resend.dev>",
        to,
        subject: `[${r.publicNo}] ${label} – ${r.address}`,
        text,
        html,
        attachments: [{ filename: `${r.publicNo}.jpg`, content: r.base64 }],
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return `e-mail do ${r.unit.name}`;
  } catch (err) {
    console.error(`email failed for ${r.publicNo}`, err);
    return "błąd wysyłki e-mail";
  }
}

async function listReports(req: Request, url: URL) {
  const db = admin();
  let ids: string[];

  if (url.searchParams.get("mine")) {
    const phone = await sessionPhone(req, db);
    if (!phone) return json({ error: "Zaloguj się numerem telefonu." }, 401);
    const { data, error } = await db
      .from("submissions")
      .select("report_id, created_at")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    ids = [...new Set((data ?? []).map((s) => s.report_id as string))].slice(0, 50);
  } else {
    ids = (url.searchParams.get("ids") ?? "").split(",").filter((id) => UUID.test(id)).slice(0, 50);
  }
  if (ids.length === 0) return json({ reports: [] });

  const { data, error } = await db
    .from("reports")
    .select(
      "id, public_no, category, summary, priority, priority_reason, status, address, lat, lng, unit_id, report_text, reporters_count, created_at, photo_path, resolution_photo_path, resolved_at, status_history(status, changed_at, note)",
    )
    .in("id", ids);
  if (error) throw error;

  const paths = (data ?? []).flatMap((r) => [r.photo_path, r.resolution_photo_path]).filter(Boolean) as string[];
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await db.storage.from("photos").createSignedUrls(paths, SIGNED_URL_TTL_S);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  const byId = new Map(
    (data ?? []).map((r) => [
      r.id,
      {
        id: r.id,
        publicNo: r.public_no,
        category: r.category in CATEGORIES ? r.category : "other",
        summary: r.summary,
        priority: r.priority,
        priorityReason: r.priority_reason,
        status: r.status,
        address: r.address,
        lat: r.lat,
        lng: r.lng,
        unitId: r.unit_id,
        unitName: UNITS[r.unit_id]?.name ?? r.unit_id,
        reportText: r.report_text,
        reportersCount: r.reporters_count,
        createdAt: r.created_at,
        photoUrl: r.photo_path ? (urls.get(r.photo_path) ?? null) : null,
        resolutionPhotoUrl: r.resolution_photo_path ? (urls.get(r.resolution_photo_path) ?? null) : null,
        resolvedAt: r.resolved_at,
        history: ((r.status_history ?? []) as { status: string; changed_at: string; note: string | null }[])
          .map((h) => ({ status: h.status, changedAt: h.changed_at, note: h.note }))
          .sort((a, b) => a.changedAt.localeCompare(b.changedAt)),
      },
    ]),
  );
  // Keep the order of ids (most recent first for "Moje zgłoszenia").
  return json({ reports: ids.map((id) => byId.get(id)).filter(Boolean) });
}
