// Shapes exchanged between the API routes and the client.

import type { CategoryId } from "@/config/categories";
import type { Unit } from "@/config/units";
import type { Analysis, ReportStatus, UrgencyLevel } from "@/lib/domain";

export type AnalyzeResponse =
  | { status: "ok"; analysis: Analysis; urgency: UrgencyLevel; unit: Unit }
  | { status: "retake"; hint: string; analysis: Analysis }
  | { error: string };

export type CreateReportRequest = {
  deviceId: string;
  consentVersion: string;
  image: string;
  lat: number;
  lng: number;
  address: string;
  category: CategoryId;
  summary: string;
  priority: number;
  priorityReason: string;
  confidence: number;
  personalData: Analysis["personal_data"];
  reportText: string;
};

export type CreateReportResponse =
  | {
      id: string;
      publicNo: string;
      duplicate: boolean;
      reportersCount: number;
      firstAt: string;
      unitName: string;
    }
  | { error: string };

export type ReportDTO = {
  id: string;
  publicNo: string;
  category: CategoryId;
  summary: string;
  priority: number;
  priorityReason: string | null;
  status: ReportStatus;
  address: string | null;
  lat: number;
  lng: number;
  unitId: string;
  unitName: string;
  reportText: string;
  reportersCount: number;
  createdAt: string;
  photoUrl: string | null;
  history: { status: ReportStatus; changedAt: string; note: string | null }[];
  // Field work (panel / resident status).
  resolutionPhotoUrl?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  assignedTo?: string | null;
  assignedName?: string | null;
  assignedAt?: string | null;
};

export type PanelWorker = { phone: string; name: string; unitId: string };

export type WorkerTask = {
  id: string;
  publicNo: string;
  category: CategoryId;
  summary: string;
  priority: number;
  priorityReason: string | null;
  status: ReportStatus;
  address: string | null;
  lat: number;
  lng: number;
  reportersCount: number;
  createdAt: string;
  assignedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  photoUrl: string | null;
  resolutionPhotoUrl: string | null;
};

export type WorkerProfile = { name: string; phone: string; unitId: string; unitName: string };
