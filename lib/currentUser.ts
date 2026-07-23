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
