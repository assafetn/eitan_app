import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ALLOWED_EMAILS } from "@/lib/constants";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const email = user?.email ?? "";

      if (!ALLOWED_EMAILS.includes(email)) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/no-access`);
      }

      // Link auth user to the correct family_members row. This RPC runs
      // SECURITY DEFINER so it isn't blocked by RLS on first login, and
      // maps the verified email to the right adult. Idempotent.
      if (user) {
        await supabase.rpc("link_current_user", { email });
      }

      return NextResponse.redirect(`${origin}/home`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
