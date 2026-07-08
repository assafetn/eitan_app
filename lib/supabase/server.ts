import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";

// The `cookies` option is a union of the current and deprecated method shapes,
// so TS can't contextually type `setAll`'s parameter. Name it explicitly.
type CookiesToSet = Parameters<SetAllCookies>[0];

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — cookies will be set by middleware
          }
        },
      },
    }
  );
}
