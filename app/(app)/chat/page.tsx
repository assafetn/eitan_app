import { createClient } from "@/lib/supabase/server";
import { getSessionMember } from "@/lib/currentUser";
import type { ChatMessage, FamilyMember } from "@/lib/types";
import ChatClient from "@/components/chat/ChatClient";

export const dynamic = "force-dynamic";

// How much history the first paint carries. Older messages can be paged in
// later if the thread ever gets long enough to need it.
const INITIAL_MESSAGES = 150;

export default async function ChatPage() {
  const supabase = await createClient();

  const [me, { data: messages }, { data: adults }] = await Promise.all([
    getSessionMember(),
    // Newest N, then flipped to chronological order below.
    supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(INITIAL_MESSAGES),
    supabase.from("family_members").select("*").eq("type", "adult").order("name"),
  ]);

  return (
    <ChatClient
      myMemberId={me?.id ?? null}
      adults={(adults as FamilyMember[]) ?? []}
      initialMessages={((messages as ChatMessage[]) ?? []).slice().reverse()}
    />
  );
}
