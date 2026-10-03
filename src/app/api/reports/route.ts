import { z } from "zod";
import { CATEGORY_IDS, PLATES_ALLOWED } from "@/config/categories";
import { unitFor } from "@/config/units";
import type { CreateReportResponse } from "@/lib/api-types";
import { DUPLICATE_RADIUS_M, DUPLICATE_WINDOW_H, RATE_LIMIT_PER_HOUR } from "@/lib/domain";
import { sendReportEmail } from "@/lib/server/email";
import { fetchReports } from "@/lib/server/reports";
import { supabaseAdmin } from "@/lib/supabase";

const BodySchema = z.object({
  deviceId: z.uuid(),
  consentVersion: z.string().min(1),
  image: z.string().startsWith("data:image/jpeg;base64,"),
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

const json = (body: CreateReportResponse, status = 200) => Response.json(body, { status });

// Submit a reviewed report: rate limit → duplicate merge → store → e-mail → "sent".
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Nieprawidłowe dane zgłoszenia." }, 400);
  const b = parsed.data;
  const db = supabaseAdmin();

  // 1. Rate limit per device.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countErr } = await db
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", b.deviceId)
    .gte("created_at", since);
  if (countErr) return serverError("rate limit check", countErr);
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return json({ error: `Limit to ${RATE_LIMIT_PER_HOUR} zgłoszeń na godzinę. Spróbuj później.` }, 429);
  }

  const photo = Buffer.from(b.image.slice(b.image.indexOf(",") + 1), "base64");
  const photoPath = `${crypto.randomUUID()}.jpg`;
  const { error: uploadErr } = await db.storage.from("photos").upload(photoPath, photo, { contentType: "image/jpeg" });
  if (uploadErr) return serverError("photo upload", uploadErr);

  // 2. Same category nearby and recent → join the existing report.
  const { data: dupId, error: dupErr } = await db.rpc("find_duplicate", {
    p_category: b.category,
    p_lat: b.lat,
    p_lng: b.lng,
    radius_m: DUPLICATE_RADIUS_M,
    window_h: DUPLICATE_WINDOW_H,
  });
  if (dupErr) return serverError("duplicate check", dupErr);

  if (dupId) {
    const { data: existing, error: exErr } = await db
      .from("reports")
      .select("id, public_no, reporters_count, created_at, unit_id")
      .eq("id", dupId)
      .single();
    if (exErr || !existing) return serverError("duplicate load", exErr);

    const reportersCount = existing.reporters_count + 1;
    await db.from("reports").update({ reporters_count: reportersCount }).eq("id", existing.id);
    await db.from("submissions").insert({
      report_id: existing.id,
      user_id: b.deviceId,
      photo_path: photoPath,
      consent_version: b.consentVersion,
    });
    return json({
      id: existing.id,
      publicNo: existing.public_no,
      duplicate: true,
      reportersCount,
      firstAt: existing.created_at,
      unitName: unitFor(b.category).name,
    });
  }

  // 3. New report.
  const unit = unitFor(b.category);
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
      plates_needed: b.personalData.plates_needed && PLATES_ALLOWED.has(b.category),
      lat: b.lat,
      lng: b.lng,
      address: b.address,
      unit_id: unit.id,
      report_text: b.reportText,
      photo_path: photoPath,
      created_by: b.deviceId,
    })
    .select("id, public_no, created_at")
    .single();
  if (insErr || !report) return serverError("report insert", insErr);

  await db.from("submissions").insert({
    report_id: report.id,
    user_id: b.deviceId,
    photo_path: photoPath,
    consent_version: b.consentVersion,
  });

  // 4. Deliver to the unit (demo inbox). Without e-mail config the demo still
  //    advances to "sent" so the flow can be shown; the note records why.
  const email = await sendReportEmail({
    publicNo: report.public_no,
    unit,
    category: b.category,
    priority: b.priority,
    address: b.address,
    lat: b.lat,
    lng: b.lng,
    reportText: b.reportText,
    photo,
  });
  await db.from("reports").update({ status: "sent" }).eq("id", report.id);
  await db
    .from("status_history")
    .update({ note: email.note })
    .eq("report_id", report.id)
    .eq("status", "sent");

  return json({
    id: report.id,
    publicNo: report.public_no,
    duplicate: false,
    reportersCount: 1,
    firstAt: report.created_at,
    unitName: unit.name,
  });
}

// "Moje zgłoszenia": GET /api/reports?ids=a,b,c
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => z.uuid().safeParse(id).success)
    .slice(0, 50);
  try {
    return Response.json({ reports: await fetchReports(ids) });
  } catch (err) {
    console.error("reports list failed", err);
    return Response.json({ error: "Nie udało się pobrać zgłoszeń." }, { status: 500 });
  }
}

function serverError(step: string, err: unknown) {
  console.error(`create report failed at ${step}`, err);
  return json({ error: "Nie udało się zapisać zgłoszenia. Spróbuj ponownie." }, 500);
}
