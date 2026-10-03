// Calls the Supabase Edge Function `analyze` (which holds the OpenAI key) and
// turns its raw result into a UI decision: review the draft or retake the photo.

import { PLATES_ALLOWED, type CategoryId } from "@/config/categories";
import { unitFor } from "@/config/units";
import type { AnalyzeResponse } from "@/lib/api-types";
import { AnalysisSchema, MIN_CONFIDENCE, urgencyOf } from "@/lib/domain";
import { callFunction } from "./functions";

const DEFAULT_HINT = "Spróbuj zrobić zdjęcie z bliska, w dobrym świetle, tak żeby problem był na środku kadru.";

export type AnalyzeInput = {
  image: string;
  lat: number;
  lng: number;
  address: string;
  takenAt: string;
  category?: CategoryId;
};

export async function analyzePhoto(input: AnalyzeInput, signal?: AbortSignal): Promise<AnalyzeResponse> {
  const data = await callFunction<{ analysis?: unknown; error?: string }>("analyze", {
    method: "POST",
    signal,
    body: JSON.stringify(input),
  });
  if (!data.analysis) {
    return { error: data.error ?? "Nie udało się przeanalizować zdjęcia. Spróbuj ponownie." };
  }

  const parsed = AnalysisSchema.safeParse(data.analysis);
  if (!parsed.success) return { error: "Nie udało się przeanalizować zdjęcia. Spróbuj ponownie." };
  const analysis = parsed.data;

  // A hand-picked category skips the confidence check, but never lets through a
  // photo that shows no city issue at all (e.g. a selfie).
  if (!analysis.is_city_issue || (!input.category && analysis.confidence < MIN_CONFIDENCE)) {
    return { status: "retake", hint: analysis.retake_hint_pl || DEFAULT_HINT, analysis };
  }

  // Plates are only legitimate evidence for parking reports.
  analysis.personal_data.plates_needed =
    analysis.personal_data.plates_needed && PLATES_ALLOWED.has(analysis.category);

  return { status: "ok", analysis, urgency: urgencyOf(analysis.priority), unit: unitFor(analysis.category) };
}
