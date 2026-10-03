import { z } from "zod";
import { analyzePhoto } from "@/lib/ai";
import { MIN_CONFIDENCE, urgencyOf } from "@/lib/domain";
import { unitFor } from "@/config/units";
import { CATEGORY_IDS, PLATES_ALLOWED } from "@/config/categories";

const BodySchema = z.object({
  image: z.string().startsWith("data:image/"),
  lat: z.number(),
  lng: z.number(),
  address: z.string().default(""),
  takenAt: z.string().optional(),
  category: z.enum(CATEGORY_IDS).optional(),
});

// Photo → structured analysis + drafted report. Nothing is stored here;
// the client shows the result for review and submits it to /api/reports.
export async function POST(request: Request) {
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Nieprawidłowe dane zdjęcia." }, { status: 400 });
  }

  const { image, lat, lng, address, takenAt, category } = body.data;

  try {
    const analysis = await analyzePhoto({
      imageDataUrl: image,
      lat,
      lng,
      address: address || "nieznany adres",
      takenAt: takenAt ? new Date(takenAt) : new Date(),
      forcedCategory: category,
    });
    if (category) analysis.category = category;

    if (!category && (!analysis.is_city_issue || analysis.confidence < MIN_CONFIDENCE)) {
      return Response.json({
        status: "retake",
        hint: analysis.retake_hint_pl || "Spróbuj zrobić zdjęcie z bliska, w dobrym świetle, tak żeby problem był na środku kadru.",
        analysis,
      });
    }

    return Response.json({
      status: "ok",
      analysis: {
        ...analysis,
        // Plates are only legitimate evidence for parking reports.
        personal_data: {
          ...analysis.personal_data,
          plates_needed: analysis.personal_data.plates_needed && PLATES_ALLOWED.has(analysis.category),
        },
      },
      urgency: urgencyOf(analysis.priority),
      unit: unitFor(analysis.category),
    });
  } catch (err) {
    console.error("analyze failed", err);
    return Response.json({ error: "Nie udało się przeanalizować zdjęcia. Spróbuj ponownie." }, { status: 502 });
  }
}
