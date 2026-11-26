import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getSessionMember } from "@/lib/currentUser";
import { buildTaskSavedPost } from "@/lib/eitan/chatPosts";
import { jerusalemNow } from "@/lib/eitan/time";
import type { FamilyMember, Task } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { task_id } — called by the chat right after an adult answered the
 * last of Eitan's question buttons for a task. Posts one summary message as
 * Eitan (service role: browsers can't write assistant messages). Does
 * nothing while a question is still open; the dedupe key makes it once only.
 */
export async function POST(request: Request) {
  const me = await getSessionMember();
  if (!me || me.type !== "adult") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let taskId: unknown;
  try {
    ({ task_id: taskId } = await request.json());
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (typeof taskId !== "string" || !/^[0-9a-f-]{36}$/i.test(taskId)) {
    return NextResponse.json({ error: "bad task_id" }, { status: 400 });
  }

  // Read with the adult's own session: RLS decides what they may see.
  const supabase = await createClient();
  const [{ data: task }, { data: members }] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", taskId).maybeSingle(),
    supabase.from("family_members").select("*").eq("type", "adult"),
  ]);
  const t = task as Task | null;
  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (t.owner_pending || (t.time_pending && !t.due_time)) return NextResponse.json({ status: "still-asking" });

  const post = buildTaskSavedPost(t, (members as FamilyMember[]) ?? [], jerusalemNow().date);
  const { error } = await createServiceClient()
    .from("chat_messages")
    .insert({ role: "assistant", author_id: null, body: post.body, meta: { ...post.meta, dedupe_key: post.dedupeKey } });
  if (error && error.code !== "23505") {
    console.error("[chat/task-saved] post failed:", error.message);
    return NextResponse.json({ error: "post failed" }, { status: 500 });
  }
  return NextResponse.json({ status: error ? "already-posted" : "posted" });
}
