import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser client: anon key, read-only by RLS, used for Realtime and anonymous auth.
let browserClient: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  browserClient ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return browserClient;
}
