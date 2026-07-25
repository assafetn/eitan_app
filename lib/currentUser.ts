import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

// Request-scoped cached session user: one `getUser()` per request, shared by the
// (app) layout's auth gate and the nav-badge counts, so streaming the badges
// does NOT add a second auth round-trip. React's cache() dedupes per request.
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The family_members row belonging to the session user, or null. */
export type SessionMember = { id: string; name: string; type: "adult" | "child" };

// Server-side equivalent of the client-only getMyMemberId(): resolves the
// signed-in auth user to their family_members row. Also request-cached, so
// several route handlers / components can call it without extra round-trips.
export const getSessionMember = cache(async (): Promise<SessionMember | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("family_members")
    .select("id, name, type")
    .eq("auth_user_id", user.id)
    .single();
  return (data as SessionMember) ?? null;
});
