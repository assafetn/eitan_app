import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionMember, getSessionUser } from "@/lib/currentUser";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const member = await getSessionMember();
  if (!member || member.type !== "adult") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { endpoint } = (payload ?? {}) as { endpoint?: unknown };
  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (deleteError) {
    console.error("[push/unsubscribe] delete failed:", deleteError.message);
    return NextResponse.json({ error: "could not remove subscription" }, { status: 500 });
  }

  // Only clear the flag once the caller has no devices left — they may still be
  // subscribed on another phone.
  const { count, error: countError } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("member_id", member.id);

  if (!countError && (count ?? 0) === 0) {
    const { error: flagError } = await supabase
      .from("family_members")
      .update({ reminders_enabled: false })
      .eq("id", member.id);
    if (flagError) {
      console.error("[push/unsubscribe] could not clear reminders_enabled:", flagError.message);
    }
  }

  return NextResponse.json({ ok: true });
}
