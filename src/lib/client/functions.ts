// Thin client for the Supabase Edge Functions. Only the public (publishable) key
// is used here; every secret lives in Edge Function secrets. The resident's phone
// session (if any) travels in the `x-session` header.

import type { CreateReportRequest, CreateReportResponse, ReportDTO, WorkerProfile, WorkerTask } from "@/lib/api-types";
import { getSession, getWorkerSession, type Session } from "./device";

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
const HEADERS = { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! };

export async function callFunction<T>(name: string, init: RequestInit & { query?: string } = {}): Promise<T> {
  const { query, headers, ...rest } = init;
  const session = getSession();
  const res = await fetch(`${BASE}/${name}${query ? `?${query}` : ""}`, {
    ...rest,
    headers: {
      ...HEADERS,
      ...(session ? { "x-session": session.token } : {}),
      ...(rest.body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
  });
  return (await res.json().catch(() => ({ error: "Brak połączenia z serwerem." }))) as T;
}

export function startLogin(phone: string): Promise<{ ok: true; phone: string } | { error: string }> {
  return callFunction("auth", { method: "POST", body: JSON.stringify({ action: "start", phone }) });
}

export function verifyLogin(phone: string, code: string): Promise<Session | { error: string }> {
  return callFunction("auth", { method: "POST", body: JSON.stringify({ action: "verify", phone, code }) });
}

export function createReport(body: CreateReportRequest): Promise<CreateReportResponse> {
  return callFunction("reports", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchReports(ids: string[]): Promise<ReportDTO[]> {
  if (ids.length === 0) return [];
  const data = await callFunction<{ reports?: ReportDTO[] }>("reports", { query: `ids=${ids.join(",")}` });
  return data.reports ?? [];
}

// Reports submitted by the signed-in phone number (any device).
export async function fetchMyReports(): Promise<ReportDTO[]> {
  const data = await callFunction<{ reports?: ReportDTO[] }>("reports", { query: "mine=1" });
  return data.reports ?? [];
}

// --- Field worker -------------------------------------------------------------

function workerHeaders(): Record<string, string> {
  const session = getWorkerSession();
  return session ? { "x-session": session.token } : {};
}

export function fetchWorkerTasks(): Promise<{ worker?: WorkerProfile; tasks?: WorkerTask[]; error?: string }> {
  return callFunction("worker", { headers: workerHeaders() });
}

export function closeWorkerTask(id: string, image: string, note: string): Promise<{ ok?: boolean; error?: string }> {
  return callFunction("worker", {
    method: "POST",
    headers: workerHeaders(),
    body: JSON.stringify({ id, image, note }),
  });
}
