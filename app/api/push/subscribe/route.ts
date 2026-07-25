import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionMember, getSessionUser } from "@/lib/currentUser";

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

  const { error: flagError } = await supabase
    .from("family_members")
    .update({ reminders_enabled: true })
    .eq("id", member.id);

  if (flagError) {
    console.error("[push/subscribe] could not set reminders_enabled:", flagError.message);
  }

  return NextResponse.json({ ok: true });
}
