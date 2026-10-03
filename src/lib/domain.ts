import { z } from "zod";
import { CATEGORY_IDS } from "@/config/categories";

// --- Priority -------------------------------------------------------------
// Claude scores priority 1–10; the UI shows a derived label.

export type UrgencyLevel = "low" | "medium" | "high";

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  low: "niska",
  medium: "średnia",
  high: "wysoka",
};

export function urgencyOf(priority: number): UrgencyLevel {
  if (priority >= 7) return "high";
  if (priority >= 4) return "medium";
  return "low";
}

// --- Status ---------------------------------------------------------------

export const STATUSES = ["new", "sent", "accepted", "resolved"] as const;
export type ReportStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<ReportStatus, string> = {
  new: "Nowe",
  sent: "Wysłane",
  accepted: "Przyjęte",
  resolved: "Zrealizowane",
};

// --- AI analysis contract ------------------------------------------------
// Single source of truth for the JSON returned by the vision call.

export const AnalysisSchema = z.object({
  is_city_issue: z.boolean(),
  category: z.enum(CATEGORY_IDS),
  summary_pl: z.string(),
  priority: z.number().int().min(1).max(10),
  priority_reason_pl: z.string(),
  confidence: z.number().min(0).max(1),
  personal_data: z.object({
    faces: z.boolean(),
    license_plates: z.boolean(),
    plates_needed: z.boolean(),
  }),
  report_text_pl: z.string(),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

// Below this confidence we ask for another photo instead of filing a report.
export const MIN_CONFIDENCE = 0.6;

// --- Abuse protection ----------------------------------------------------

export const DUPLICATE_RADIUS_M = 50;
export const DUPLICATE_WINDOW_H = 72;
export const RATE_LIMIT_PER_HOUR = 5;

export const CONSENT_VERSION = "2026-10-v1";
