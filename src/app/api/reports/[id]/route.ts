import { z } from "zod";
import { fetchReports } from "@/lib/server/reports";

export async function GET(_req: Request, ctx: RouteContext<"/api/reports/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
  }
  try {
    const [report] = await fetchReports([id]);
    if (!report) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
    return Response.json({ report });
  } catch (err) {
    console.error("report fetch failed", err);
    return Response.json({ error: "Nie udało się pobrać zgłoszenia." }, { status: 500 });
  }
}
