// Thin client for the Supabase Edge Functions. Only the public (publishable) key
// is used here; every secret lives in Edge Function secrets.

import type { CreateReportRequest, CreateReportResponse, ReportDTO } from "@/lib/api-types";

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
const HEADERS = { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! };

export async function callFunction<T>(name: string, init: RequestInit & { query?: string } = {}): Promise<T> {
  const { query, headers, ...rest } = init;
  const res = await fetch(`${BASE}/${name}${query ? `?${query}` : ""}`, {
    ...rest,
    headers: { ...HEADERS, ...(rest.body ? { "content-type": "application/json" } : {}), ...headers },
  });
  return (await res.json().catch(() => ({ error: "Brak połączenia z serwerem." }))) as T;
}

export function createReport(body: CreateReportRequest): Promise<CreateReportResponse> {
  return callFunction("reports", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchReports(ids: string[]): Promise<ReportDTO[]> {
  if (ids.length === 0) return [];
  const data = await callFunction<{ reports?: ReportDTO[] }>("reports", { query: `ids=${ids.join(",")}` });
  return data.reports ?? [];
}
