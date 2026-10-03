// Supabase Edge Function: resident sign-in by phone number.
//   POST { action: "start",  phone }        → "sends" the SMS code (simulated in the prototype)
//   POST { action: "verify", phone, code }  → { token, phone } session for reports and "Moje zgłoszenia"
//
// Prototype: no SMS provider yet – the code is always 123-123 and the UI says so.
// To go live, send a random code via an SMS gateway in "start" and check it here.
// Auth: publishable key in the `apikey` header (verify_jwt is off for non-JWT keys).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEMO_CODE = "123123";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, x-client-info, authorization, x-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function envKeys(name: string): string[] {
  try {
    return Object.values(JSON.parse(Deno.env.get(name) ?? "{}") as Record<string, string>);
  } catch {
    return [];
  }
}

function isAllowedKey(key: string | null): boolean {
  if (!key) return false;
  return envKeys("SUPABASE_PUBLISHABLE_KEYS").includes(key) || key === Deno.env.get("SUPABASE_ANON_KEY");
}

function admin() {
  const secret = envKeys("SUPABASE_SECRET_KEYS")[0] ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(Deno.env.get("SUPABASE_URL")!, secret, { auth: { persistSession: false } });
}

// Polish mobile numbers: accepts "600 700 800", "+48600700800", "0048 600-700-800".
function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0048")) digits = digits.slice(4);
  else if (digits.length === 11 && digits.startsWith("48")) digits = digits.slice(2);
  return /^\d{9}$/.test(digits) ? `+48${digits}` : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isAllowedKey(req.headers.get("apikey"))) return json({ error: "Unauthorized" }, 401);

  const body = (await req.json().catch(() => null)) as { action?: string; phone?: string; code?: string } | null;
  const phone = normalizePhone(body?.phone);
  if (!phone) return json({ error: "Wpisz 9-cyfrowy numer telefonu." }, 400);

  if (body?.action === "start") {
    // Prototype: no SMS is sent; the code is fixed and shown in the UI.
    return json({ ok: true, phone });
  }

  if (body?.action === "verify") {
    const code = String(body.code ?? "").replace(/\D/g, "");
    if (code !== DEMO_CODE) return json({ error: "Nieprawidłowy kod. Spróbuj ponownie." }, 400);
    try {
      const db = admin();
      const { error: upErr } = await db.from("residents").upsert({ phone }, { onConflict: "phone" });
      if (upErr) throw upErr;
      const { data, error } = await db.from("resident_sessions").insert({ phone }).select("token").single();
      if (error || !data) throw error;
      return json({ token: data.token, phone });
    } catch (err) {
      console.error("verify failed", err);
      return json({ error: "Nie udało się zalogować. Spróbuj ponownie." }, 500);
    }
  }

  return json({ error: "Nieznana akcja." }, 400);
});
