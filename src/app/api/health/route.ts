// Quick setup check for the frontend env. All API secrets live in Supabase Edge Function secrets.
export function GET() {
  const has = (key: string) => Boolean(process.env[key]);
  return Response.json({
    ok: true,
    supabase: has("NEXT_PUBLIC_SUPABASE_URL") && has("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  });
}
