import { isCategoryId } from "@/config/categories";
import { UNITS, type UnitId } from "@/config/units";
import type { ReportDTO } from "@/lib/api-types";
import type { ReportStatus } from "@/lib/domain";
import { supabaseAdmin } from "@/lib/supabase";

const SIGNED_URL_TTL_S = 60 * 60;

type ReportRow = {
  id: string;
  public_no: string;
  category: string;
  summary: string;
  priority: number;
  priority_reason: string | null;
  status: ReportStatus;
  address: string | null;
  lat: number;
  lng: number;
  unit_id: string;
  report_text: string;
  reporters_count: number;
  created_at: string;
  photo_path: string | null;
  status_history?: { status: ReportStatus; changed_at: string; note: string | null }[];
};

const SELECT =
  "id, public_no, category, summary, priority, priority_reason, status, address, lat, lng, unit_id, report_text, reporters_count, created_at, photo_path, status_history(status, changed_at, note)";

export async function fetchReports(ids: string[]): Promise<ReportDTO[]> {
  if (ids.length === 0) return [];
  const db = supabaseAdmin();
  const { data, error } = await db.from("reports").select(SELECT).in("id", ids);
  if (error) throw error;
  const rows = (data ?? []) as ReportRow[];

  const paths = rows.map((r) => r.photo_path).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await db.storage.from("photos").createSignedUrls(paths, SIGNED_URL_TTL_S);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  const byId = new Map(rows.map((r) => [r.id, toDTO(r, r.photo_path ? urls.get(r.photo_path) ?? null : null)]));
  // Keep the caller's order (most recent first for "Moje zgłoszenia").
  return ids.map((id) => byId.get(id)).filter((r): r is ReportDTO => Boolean(r));
}

function toDTO(r: ReportRow, photoUrl: string | null): ReportDTO {
  return {
    id: r.id,
    publicNo: r.public_no,
    category: isCategoryId(r.category) ? r.category : "other",
    summary: r.summary,
    priority: r.priority,
    priorityReason: r.priority_reason,
    status: r.status,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    unitId: r.unit_id,
    unitName: UNITS[r.unit_id as UnitId]?.name ?? r.unit_id,
    reportText: r.report_text,
    reportersCount: r.reporters_count,
    createdAt: r.created_at,
    photoUrl,
    history: (r.status_history ?? [])
      .map((h) => ({ status: h.status, changedAt: h.changed_at, note: h.note }))
      .sort((a, b) => a.changedAt.localeCompare(b.changedAt)),
  };
}
