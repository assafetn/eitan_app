import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionMember, getSessionUser } from "@/lib/currentUser";
import { deviceClass, pushService } from "@/lib/pushDevice";

// web-push (and anything importing lib/push) needs Node crypto.
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

  const { endpoint, keys } = (payload ?? {}) as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;

  const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.length > 0;
  if (!nonEmpty(endpoint) || !nonEmpty(p256dh) || !nonEmpty(auth)) {
    return NextResponse.json(
      { error: "endpoint, keys.p256dh and keys.auth are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // endpoint is UNIQUE. Upserting on it means a device already registered to a
  // DIFFERENT member gets reassigned to the caller — otherwise a shared phone
  // would keep pushing the previous person's notifications.
  const { error: upsertError } = await supabase.from("push_subscriptions").upsert(
    {
      member_id: member.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get("user-agent"),
    },
    { onConflict: "endpoint" }
  );

  if (upsertError) {
    console.error("[push/subscribe] upsert failed:", upsertError.message);
    return NextResponse.json({ error: "could not save subscription" }, { status: 500 });
  }

  // Replace, don't accumulate: drop this member's OTHER subscriptions for the
  // same kind of device on the same push service. A re-added iPhone app gets a
  // new endpoint, and Apple keeps answering 201 for the old one while never
  // delivering it, so the old row would silently swallow every reminder.
  const ua = request.headers.get("user-agent");
  const { data: others } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, user_agent")
    .eq("member_id", member.id)
    .neq("endpoint", endpoint);
  const stale = ((others as { id: string; endpoint: string; user_agent: string | null }[]) ?? []).filter(
    (s) => pushService(s.endpoint) === pushService(endpoint) && deviceClass(s.user_agent) === deviceClass(ua)
  );
  if (stale.length) {
    const { error: pruneError } = await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", stale.map((s) => s.id));
    if (pruneError) console.error("[push/subscribe] could not remove old subscriptions:", pruneError.message);
  }

  // A silent re-sync on app open only refreshes the row; it must not turn
  // reminders back on for someone who switched them off.
  if ((payload as { sync?: unknown }).sync === true) return NextResponse.json({ ok: true, replaced: stale.length });

  const { error: flagError } = await supabase
    .from("family_members")
    .update({ reminders_enabled: true })
    .eq("id", member.id);

  if (flagError) {
    console.error("[push/subscribe] could not set reminders_enabled:", flagError.message);
  }

  return NextResponse.json({ ok: true });
}
