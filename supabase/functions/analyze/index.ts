// Supabase Edge Function: photo → structured city-issue analysis + drafted report.
// The OpenAI key lives only in Edge Function secrets (OPENAI_API_KEY), never in the app.
//
// Auth: called from the browser with the project's publishable key in the `apikey`
// header. New publishable keys are not JWTs, so verify_jwt is off and the key is
// checked here (see https://supabase.com/docs/guides/functions/auth-headers).
//
// Keep CATEGORIES and UNITS in sync with src/config/categories.ts and src/config/units.ts.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@7";

const MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-6-luna";

const CATEGORIES: Record<string, { label: string; unit: string }> = {
  pothole: { label: "Dziura w jezdni", unit: "Zarząd Dróg Miasta Krakowa" },
  damaged_sidewalk: { label: "Uszkodzony chodnik", unit: "Zarząd Dróg Miasta Krakowa" },
  broken_streetlight: { label: "Zepsuta latarnia", unit: "Zarząd Dróg Miasta Krakowa" },
  illegal_dumping: { label: "Nielegalne wysypisko", unit: "Straż Miejska Miasta Krakowa" },
  overflowing_bin: { label: "Przepełniony kosz", unit: "MPO w Krakowie" },
  graffiti: { label: "Graffiti", unit: "Straż Miejska Miasta Krakowa" },
  illegal_parking: { label: "Auto blokujące wjazd", unit: "Straż Miejska Miasta Krakowa" },
  flooding: { label: "Zalanie / awaria wodna", unit: "MPWiK w Krakowie" },
  greenery: { label: "Drzewo / zieleń", unit: "Zarząd Zieleni Miejskiej w Krakowie" },
  traffic_sign: { label: "Znak lub sygnalizacja", unit: "Zarząd Dróg Miasta Krakowa" },
  other: { label: "Inny problem", unit: "Urząd Miasta Krakowa – Biuro Interwencji" },
};
const CATEGORY_IDS = Object.keys(CATEGORIES);

const SYSTEM_PROMPT = `You analyse photos of urban issues sent by residents of Kraków, Poland, and draft formal reports to the responsible city unit.

Return JSON matching the schema. All *_pl fields must be in Polish.

Categories (id: label → responsible unit):
${Object.entries(CATEGORIES).map(([id, c]) => `- ${id}: ${c.label} → ${c.unit}`).join("\n")}

Rules:
- is_city_issue: false if the scene does not show a public-space problem a city unit could act on (selfie, food, indoor private space, blurry/unreadable image).
  Photos of a screen, a printout or another photo are fine (people forward photos and demo the app this way): judge the depicted scene and never reject or lower confidence for that reason.
- category: pick the single best id. Use "other" only if nothing fits.
- summary_pl: one factual sentence describing what is visible (size, position, hazard). No speculation about who caused it.
- priority: integer 1–10 for how urgently the city should act.
  1–3 cosmetic or slow-growing (graffiti, small litter, a single overflowing bin);
  4–6 nuisance or moderate risk (unlit lamp, damaged sidewalk, illegal dumping, car blocking a gate);
  7–8 real safety risk (deep pothole on a road, missing manhole cover, fallen branch on a path, broken traffic light);
  9–10 immediate danger to life or major damage (flooding, tree on a road, exposed wiring).
- priority_reason_pl: one short sentence justifying the score.
- confidence: 0–1, how sure you are about category and that this is a real city issue.
- personal_data.faces: any recognisable human face visible (pixelated areas are already anonymised – ignore them).
- personal_data.license_plates: any readable licence plate visible.
- personal_data.plates_needed: true only when the plate is evidence for the report (category illegal_parking).
- report_text_pl: a short formal report (max ~120 words) addressed to the responsible unit, in this structure:
  "Szanowni Państwo," / one paragraph: what, where (use the address and coordinates given), when (use the date given) / one sentence asking for intervention / "Z poważaniem," / "Mieszkaniec (zgłoszenie przez aplikację Zgłoś to)".
  Do not mention faces, people or plate numbers unless plates_needed is true. Mention that a photo is attached.
- retake_hint_pl: if is_city_issue is false or confidence < 0.6, one friendly sentence telling the user how to take a better photo; otherwise an empty string.`;

// Strict structured-output schema: every field required, no extra keys.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_city_issue",
    "category",
    "summary_pl",
    "priority",
    "priority_reason_pl",
    "confidence",
    "personal_data",
    "report_text_pl",
    "retake_hint_pl",
  ],
  properties: {
    is_city_issue: { type: "boolean" },
    category: { type: "string", enum: CATEGORY_IDS },
    summary_pl: { type: "string" },
    priority: { type: "number" },
    priority_reason_pl: { type: "string" },
    confidence: { type: "number" },
    personal_data: {
      type: "object",
      additionalProperties: false,
      required: ["faces", "license_plates", "plates_needed"],
      properties: {
        faces: { type: "boolean" },
        license_plates: { type: "boolean" },
        plates_needed: { type: "boolean" },
      },
    },
    report_text_pl: { type: "string" },
    retake_hint_pl: { type: "string" },
  },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, x-client-info, authorization, x-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function isAllowedKey(key: string | null): boolean {
  if (!key) return false;
  try {
    const publishable = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}") as Record<string, string>;
    if (Object.values(publishable).includes(key)) return true;
  } catch {
    // fall through to legacy key
  }
  return key === Deno.env.get("SUPABASE_ANON_KEY");
}

const MAX_IMAGE_CHARS = 4_000_000; // ~3 MB JPEG as base64

let client: OpenAI | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isAllowedKey(req.headers.get("apikey"))) return json({ error: "Unauthorized" }, 401);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "Analiza AI nie jest skonfigurowana." }, 503);

  let body: {
    image?: string;
    lat?: number;
    lng?: number;
    address?: string;
    takenAt?: string;
    category?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Nieprawidłowe dane zdjęcia." }, 400);
  }

  const { image, lat, lng, address, takenAt, category } = body;
  if (
    typeof image !== "string" ||
    !image.startsWith("data:image/") ||
    image.length > MAX_IMAGE_CHARS ||
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    (category !== undefined && !CATEGORY_IDS.includes(category))
  ) {
    return json({ error: "Nieprawidłowe dane zdjęcia." }, 400);
  }

  const when = (takenAt ? new Date(takenAt) : new Date()).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
  let context = `Adres: ${address || "nieznany adres"}\nWspółrzędne: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nData zdjęcia: ${when}`;
  if (category) {
    context += `\nThe resident picked the category "${category}" by hand. Use it, set is_city_issue to true and draft the report even if the photo is unclear.`;
  }

  try {
    client ??= new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: MODEL,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "input_text", text: context },
            { type: "input_image", image_url: image, detail: "auto" },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: "city_issue_analysis", strict: true, schema: SCHEMA } },
    });

    const analysis = JSON.parse(response.output_text);
    if (category) analysis.category = category;
    analysis.priority = Math.min(10, Math.max(1, Math.round(analysis.priority)));
    analysis.confidence = Math.min(1, Math.max(0, analysis.confidence));
    // Decision log for debugging (no image, no personal data).
    console.log(
      JSON.stringify({
        event: "analysis",
        manual_category: Boolean(category),
        category: analysis.category,
        is_city_issue: analysis.is_city_issue,
        confidence: analysis.confidence,
        priority: analysis.priority,
        summary: analysis.summary_pl,
        retake_hint: analysis.retake_hint_pl,
      }),
    );
    return json({ analysis });
  } catch (err) {
    console.error("analyze failed", err);
    return json({ error: "Nie udało się przeanalizować zdjęcia. Spróbuj ponownie." }, 502);
  }
});
