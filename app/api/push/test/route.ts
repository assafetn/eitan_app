import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionMember, getSessionUser } from "@/lib/currentUser";
import { sendPushToMember } from "@/lib/push";

export const runtime = "nodejs";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const member = await getSessionMember();
  if (!member || member.type !== "adult") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // The session client is enough here: RLS lets an adult manage push rows, and
  // pruning a dead endpoint must work from this path too.
  const supabase = await createClient();

  const result = await sendPushToMember(supabase, member.id, {
    title: "איתן",
    body: "התראת בדיקה — ההתראות פועלות",
    url: "/tasks",
    tag: "eitan-test",
  });

  // Return the real counts so the UI can report what actually happened instead
  // of showing a blind success.
  return NextResponse.json(result);
}
