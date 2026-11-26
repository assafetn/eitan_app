import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** The verified session user: just the fields the app reads. */
export type SessionUser = { id: string; email: string | null };

// Request-scoped cached session user, shared by the (app) layout's auth gate,
// the nav-badge counts and the API routes. React's cache() dedupes per request.
//
// getClaims() — not getUser(): the project signs access tokens with an
// asymmetric key (ES256), so the token's signature is checked locally against
// the published key (fetched once, then cached for 10 minutes). getUser() made
// a network round-trip to Supabase Auth on EVERY page load. If a token ever
// can't be verified locally (e.g. a legacy HS256 token), getClaims falls back
// to that same getUser() call, so this is never less strict than before.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
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
