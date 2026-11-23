import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getSessionMember } from "@/lib/currentUser";
import { runEitan } from "@/lib/eitan/run";
import type { ChatMessage, FamilyMember } from "@/lib/types";

// Anthropic SDK + Supabase service client: Node runtime, never Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A turn with a few tool calls usually takes seconds; leave headroom.
export const maxDuration = 60;

const HISTORY_LIMIT = 30;

/**
 * POST { message_id } — called by the chat screen right after one of the
 * adults posts a message. Runs Eitan once for that message and posts the reply
 * (via the service role: browsers can never write assistant messages).
 */
export async function POST(request: Request) {
  const me = await getSessionMember();
  if (!me || me.type !== "adult") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let messageId: unknown;
  try {
    ({ message_id: messageId } = await request.json());
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (typeof messageId !== "string" || !/^[0-9a-f-]{36}$/i.test(messageId)) {
    return NextResponse.json({ error: "bad message_id" }, { status: 400 });
  }

  const supabase = await createClient(); // the sender's session — RLS applies to every tool
  const service = createServiceClient();

  const { data: trigger } = await supabase.from("chat_messages").select("*").eq("id", messageId).maybeSingle();
  const msg = trigger as ChatMessage | null;
  if (!msg || msg.role !== "user") return NextResponse.json({ error: "not found" }, { status: 404 });
  // Only the author triggers Eitan for their own message.
  if (msg.author_id !== me.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Claim the message atomically, so a double-tap or retry can't run the
  // tools twice. Only the first caller gets a row back.
  const { data: claimed } = await service
    .from("chat_messages")
    .update({ meta: { ...msg.meta, eitan: "claimed" } })
    .eq("id", msg.id)
    .not("meta", "cs", JSON.stringify({ eitan: "claimed" }))
    .select("id");
  if (!claimed || claimed.length === 0) return NextResponse.json({ status: "already-handled" });

  const [{ data: historyDesc }, { data: members }] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("*")
      .lte("created_at", msg.created_at)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase.from("family_members").select("*").order("created_at", { ascending: true }),
  ]);
  const all = (members as FamilyMember[]) ?? [];
  const adults = all.filter((m) => m.type === "adult");
  const children = all.filter((m) => m.type === "child");
  const sender = adults.find((a) => a.id === me.id);
  if (!sender) return NextResponse.json({ error: "sender not found" }, { status: 500 });

  const history = ((historyDesc as ChatMessage[]) ?? []).slice().reverse();

  const result = await runEitan(
    { supabase, sender, otherAdult: adults.find((a) => a.id !== me.id) ?? null, adults, children },
    history
  );

  if (!result.reply) return NextResponse.json({ status: "silent", task_ids: result.taskIds });

  const { error } = await service.from("chat_messages").insert({
    role: "assistant",
    author_id: null,
    body: result.reply.slice(0, 4000),
    meta: { reply_to: msg.id, task_ids: result.taskIds },
  });
  // 23505: a reply for this message already exists (the dedupe index).
  if (error && error.code !== "23505") {
    console.error("[eitan] posting reply failed:", error.message);
    return NextResponse.json({ error: "post failed" }, { status: 500 });
  }
  return NextResponse.json({ status: "replied", task_ids: result.taskIds });
}
