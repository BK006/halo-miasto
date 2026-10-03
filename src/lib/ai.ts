import OpenAI from "openai";
import { z } from "zod";
import { CATEGORIES, type CategoryId } from "@/config/categories";
import { ROUTING, UNITS } from "@/config/units";
import { AnalysisSchema, type Analysis } from "@/lib/domain";

const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

const categoryList = Object.entries(CATEGORIES)
  .map(([id, c]) => `- ${id}: ${c.label} → ${UNITS[ROUTING[id as keyof typeof ROUTING]].name}`)
  .join("\n");

const SYSTEM_PROMPT = `You analyse photos of urban issues sent by residents of Kraków, Poland, and draft formal reports to the responsible city unit.

Return JSON matching the schema. All *_pl fields must be in Polish.

Categories (id: label → responsible unit):
${categoryList}

Rules:
- is_city_issue: false if the photo does not show a public-space problem a city unit could act on (selfie, food, indoor private space, screenshot, blurry/unreadable image).
- category: pick the single best id. Use "other" only if nothing fits.
- summary_pl: one factual sentence describing what is visible (size, position, hazard). No speculation about who caused it.
- priority: integer 1–10 for how urgently the city should act.
  1–3 cosmetic or slow-growing (graffiti, small litter, a single overflowing bin);
  4–6 nuisance or moderate risk (unlit lamp, damaged sidewalk, illegal dumping, car blocking a gate);
  7–8 real safety risk (deep pothole on a road, missing manhole cover, fallen branch on a path, broken traffic light);
  9–10 immediate danger to life or major damage (flooding, tree on a road, exposed wiring).
- priority_reason_pl: one short sentence justifying the score.
- confidence: 0–1, how sure you are about category and that this is a real city issue.
- personal_data.faces: any recognisable human face visible.
- personal_data.license_plates: any readable licence plate visible.
- personal_data.plates_needed: true only when the plate is evidence for the report (category illegal_parking).
- report_text_pl: a short formal report (max ~120 words) addressed to the responsible unit, in this structure:
  "Szanowni Państwo," / one paragraph: what, where (use the address and coordinates given), when (use the date given) / one sentence asking for intervention / "Z poważaniem," / "Mieszkaniec (zgłoszenie przez aplikację Zgłoś to)".
  Do not mention faces, people or plate numbers unless plates_needed is true. Mention that a photo is attached.
- retake_hint_pl: if is_city_issue is false or confidence < 0.6, one friendly sentence telling the user how to take a better photo; otherwise an empty string.`;

// Strict JSON schema derived from the zod contract (all fields required, no extras).
const ANALYSIS_JSON_SCHEMA = z.toJSONSchema(AnalysisSchema, { target: "draft-7" }) as Record<string, unknown>;
delete ANALYSIS_JSON_SCHEMA.$schema;

let client: OpenAI | null = null;

export type AnalyzeInput = {
  imageDataUrl: string;
  address: string;
  lat: number;
  lng: number;
  takenAt: Date;
  // Set when the user picked the category by hand after a low-confidence result.
  forcedCategory?: CategoryId;
};

export async function analyzePhoto(input: AnalyzeInput): Promise<Analysis> {
  client ??= new OpenAI();

  const when = input.takenAt.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
  let context = `Adres: ${input.address}\nWspółrzędne: ${input.lat.toFixed(6)}, ${input.lng.toFixed(6)}\nData zdjęcia: ${when}`;
  if (input.forcedCategory) {
    context += `\nThe resident confirmed the category is "${input.forcedCategory}". Use it, set is_city_issue to true and draft the report even if the photo is unclear.`;
  }

  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "input_text", text: context },
          { type: "input_image", image_url: input.imageDataUrl, detail: "auto" },
        ],
      },
    ],
    text: {
      format: { type: "json_schema", name: "city_issue_analysis", strict: true, schema: ANALYSIS_JSON_SCHEMA },
    },
  });

  const parsed = AnalysisSchema.parse(JSON.parse(response.output_text));

  return {
    ...parsed,
    priority: Math.min(10, Math.max(1, Math.round(parsed.priority))),
    confidence: Math.min(1, Math.max(0, parsed.confidence)),
  };
}
