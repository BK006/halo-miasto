// Quick setup check: which integrations are configured (never returns values).
export function GET() {
  const has = (key: string) => Boolean(process.env[key]);
  return Response.json({
    ok: true,
    supabase: has("NEXT_PUBLIC_SUPABASE_URL") && has("NEXT_PUBLIC_SUPABASE_ANON_KEY") && has("SUPABASE_SERVICE_ROLE_KEY"),
    openai: has("OPENAI_API_KEY"),
    resend: has("RESEND_API_KEY") && has("DEMO_EMAIL_TO"),
  });
}
