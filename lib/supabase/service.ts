// SERVER-ONLY. This client is built from the service-role key and therefore
// BYPASSES ROW LEVEL SECURITY entirely. Never import it from a 'use client'
// file, and never expose anything it returns without filtering first.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Service-role Supabase client is not configured — missing: ${missing}. ` +
        `Set it in Vercel → Settings → Environment Variables.`
    );
  }

  // No session to persist or refresh: this client is used from stateless server
  // handlers (cron), never on behalf of a signed-in user.
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
