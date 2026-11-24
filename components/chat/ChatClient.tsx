"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage, FamilyMember } from "@/lib/types";
import Toast from "@/components/ui/Toast";

const SEND_FAILED = "השליחה נכשלה, הקישו על ההודעה כדי לנסות שוב";
const EITAN_FAILED = "איתן לא הצליח לענות כרגע";
const ASSISTANT_NAME = "איתן";
const TZ = "Asia/Jerusalem";
// Within this many px of the bottom counts as "reading the latest" — new
// messages then auto-scroll into view instead of yanking someone reading history.
const STICK_TO_BOTTOM_PX = 120;
const MAX_LEN = 4000; // mirrors the DB check constraint

type SendStatus = "sending" | "failed";
type LocalMessage = ChatMessage & { status?: SendStatus };

interface Props {
  myMemberId: string | null;
  adults: FamilyMember[];
  initialMessages: ChatMessage[];
}

// ── helpers ──────────────────────────────────────────────

function byCreated(a: LocalMessage, b: LocalMessage): number {
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

/**
 * Merge incoming server rows into local state. A server row replaces the
 * optimistic bubble with the same client_id, and is never added twice
 * (the realtime echo, the insert response and a refresh can all deliver it).
 */
function mergeMessages(prev: LocalMessage[], incoming: ChatMessage[]): LocalMessage[] {
  if (incoming.length === 0) return prev;
  const byId = new Map<string, LocalMessage>();
  const clientToId = new Map<string, string>();
  for (const m of prev) {
    byId.set(m.id, m);
    if (m.client_id) clientToId.set(m.client_id, m.id);
  }
  for (const m of incoming) {
    const localId = m.client_id ? clientToId.get(m.client_id) : undefined;
    if (localId && localId !== m.id) byId.delete(localId);
    byId.set(m.id, m); // server row wins; drops any local status
    if (m.client_id) clientToId.set(m.client_id, m.id);
  }
  return Array.from(byId.values()).sort(byCreated);
}

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const dayLabelFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long", day: "numeric", month: "numeric" });

function dayKey(iso: string): string {
  return dayKeyFmt.format(new Date(iso)); // YYYY-MM-DD in Jerusalem
}

function dayLabel(key: string): string {
  const today = dayKeyFmt.format(new Date());
  const yesterday = dayKeyFmt.format(new Date(Date.now() - 86_400_000));
  if (key === today) return "היום";
  if (key === yesterday) return "אתמול";
  return dayLabelFmt.format(new Date(`${key}T12:00:00Z`));
}

function newClientId(): string {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  // Fallback for older browsers: RFC4122 v4 from getRandomValues.
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x: number) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ── component ────────────────────────────────────────────

export default function ChatClient({ myMemberId, adults, initialMessages }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<LocalMessage[]>(() => mergeMessages([], initialMessages));
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  // How many Eitan turns this device is waiting on (drives "איתן כותב…").
  const [eitanBusy, setEitanBusy] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);
  const lastCreatedRef = useRef<string | null>(null);
  lastCreatedRef.current = messages.length ? messages[messages.length - 1].created_at : null;

  const nameById = useMemo(() => new Map(adults.map((a) => [a.id, a.name])), [adults]);

  const upsert = useCallback((rows: ChatMessage[]) => {
    setMessages((prev) => mergeMessages(prev, rows));
  }, []);

  // A server refresh (focus refetch / navigation) re-sends initialMessages.
  useEffect(() => {
    upsert(initialMessages);
  }, [initialMessages, upsert]);

  // ── realtime ──
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Anything that landed between the server render and the subscription
    // going live (or while the socket was down) is fetched explicitly.
    const catchUp = async () => {
      let q = supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(200);
      if (lastCreatedRef.current) q = q.gte("created_at", lastCreatedRef.current);
      const { data } = await q;
      if (!cancelled && data) upsert(data as ChatMessage[]);
    };

    (async () => {
      // Realtime evaluates RLS with the user's JWT. Hand it over explicitly so
      // the very first subscription is authorised, not anonymous.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel("chat_messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          (payload) => upsert([payload.new as ChatMessage])
        )
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") void catchUp();
          else console.warn(`[chat] realtime ${status}`, err ?? "");
        });
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, upsert]);

  // ── scrolling ──
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_TO_BOTTOM_PX;
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, eitanBusy]);

  // ── composer ──
  const autoGrow = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    // scrollHeight excludes the border; add it back or a 1-line box scrolls.
    el.style.height = `${Math.min(el.scrollHeight + el.offsetHeight - el.clientHeight, 140)}px`;
  };

  // Ask Eitan to handle a message we just posted. His reply arrives through
  // realtime like any other message; this call only drives the typing hint.
  const askEitan = useCallback(async (messageId: string) => {
    setEitanBusy((n) => n + 1);
    stickToBottomRef.current = true;
    try {
      const res = await fetch("/api/chat/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId }),
      });
      if (!res.ok) setToast(EITAN_FAILED);
      // Belt and braces: if the realtime echo of the reply was missed, fetch it.
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("role", "assistant")
        .contains("meta", { reply_to: messageId });
      if (data?.length) upsert(data as ChatMessage[]);
    } catch {
      setToast(EITAN_FAILED);
    } finally {
      setEitanBusy((n) => Math.max(0, n - 1));
    }
  }, [supabase, upsert]);

  const deliver = useCallback(
    async (msg: LocalMessage) => {
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({ role: "user", author_id: msg.author_id, body: msg.body, client_id: msg.client_id })
        .select()
        .single();

      if (!error && data) {
        upsert([data as ChatMessage]);
        void askEitan((data as ChatMessage).id);
        return;
      }
      // 23505 = unique violation on client_id: an earlier attempt already
      // landed (e.g. the response was lost). Fetch it instead of failing.
      if (error?.code === "23505" && msg.client_id) {
        const { data: existing } = await supabase.from("chat_messages").select("*").eq("client_id", msg.client_id).single();
        if (existing) {
          upsert([existing as ChatMessage]);
          // Safe to ask again: the server runs Eitan at most once per message.
          void askEitan((existing as ChatMessage).id);
          return;
        }
      }
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: "failed" } : m)));
      setToast(SEND_FAILED);
    },
    [supabase, upsert, askEitan]
  );

  const send = () => {
    const body = draft.trim().slice(0, MAX_LEN);
    if (!body || !myMemberId) return;
    const clientId = newClientId();
    const optimistic: LocalMessage = {
      id: `local-${clientId}`,
      role: "user",
      author_id: myMemberId,
      body,
      client_id: clientId,
      meta: {},
      created_at: new Date().toISOString(),
      status: "sending",
    };
    stickToBottomRef.current = true;
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    requestAnimationFrame(autoGrow);
    void deliver(optimistic);
  };

  const retry = (msg: LocalMessage) => {
    if (msg.status !== "failed") return;
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: "sending" } : m)));
    void deliver({ ...msg, status: "sending" });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Desktop: Enter sends, Shift+Enter is a newline. Touch keyboards keep
    // Enter as a newline — the send button is right there.
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    e.preventDefault();
    send();
  };

  // ── render ──
  const canSend = draft.trim().length > 0 && !!myMemberId;

  return (
    <div
      dir="rtl"
      style={{
        // Fills the app frame's content area (AppShell), which is already
        // sized to the visible screen and lifted above the keyboard.
        flex: 1,
        minHeight: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        maxWidth: 640,
        margin: "0 auto",
      }}
    >
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-label="הודעות"
        style={{
          flex: 1,
          overflowY: "auto",
          overscrollBehavior: "contain",
          padding: "var(--sp-3) var(--sp-4)",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const key = dayKey(m.created_at);
            const newDay = !prev || dayKey(prev.created_at) !== key;
            const sameSender = !newDay && prev && prev.role === m.role && prev.author_id === m.author_id;
            const mine = m.role === "user" && m.author_id === myMemberId;
            const sender = m.role === "assistant" ? ASSISTANT_NAME : nameById.get(m.author_id ?? "") ?? "";
            return (
              <div key={m.id}>
                {newDay && <DaySeparator label={dayLabel(key)} />}
                <Bubble message={m} mine={mine} sender={sameSender || mine ? null : sender} onRetry={() => retry(m)} />
              </div>
            );
          })
        )}
        {eitanBusy > 0 && <TypingHint />}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "var(--sp-2)",
          padding: "var(--sp-2) var(--sp-4) var(--sp-3)",
        }}
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            autoGrow();
          }}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={MAX_LEN}
          dir="auto"
          placeholder="כתבו לאיתן…"
          aria-label="הודעה"
          style={{
            flex: 1,
            minWidth: 0,
            resize: "none",
            fontFamily: "var(--font)",
            fontSize: "var(--text-input)", // ≥16px: no iOS focus zoom
            lineHeight: 1.4,
            color: "var(--text-primary)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "10px 14px",
            outline: "none",
            boxShadow: "var(--shadow-sm)",
            maxHeight: 140,
          }}
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="שליחה"
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            borderRadius: "var(--r-full)",
            border: "none",
            display: "grid",
            placeItems: "center",
            background: canSend ? "var(--jmh-blue)" : "var(--jmh-blue-10)",
            color: canSend ? "var(--text-on-blue)" : "var(--text-muted)",
            cursor: canSend ? "pointer" : "default",
            transition: "background var(--dur-fast) var(--ease-out)",
          }}
        >
          {/* The icon points right; mirror it so it points "forward" in RTL. */}
          <SendHorizontal size={20} strokeWidth={2} style={{ transform: "scaleX(-1)" }} />
        </button>
      </form>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

// ── pieces ───────────────────────────────────────────────

function Bubble({
  message,
  mine,
  sender,
  onRetry,
}: {
  message: LocalMessage;
  mine: boolean;
  sender: string | null;
  onRetry: () => void;
}) {
  const assistant = message.role === "assistant";
  const failed = message.status === "failed";

  const background = mine ? "var(--jmh-blue)" : assistant ? "var(--jmh-periwinkle-bg)" : "var(--surface)";
  const color = mine ? "var(--text-on-blue)" : "var(--text-primary)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        // RTL: flex-start is the right edge (others), flex-end the left (mine).
        alignItems: mine ? "flex-end" : "flex-start",
        marginTop: sender ? "var(--sp-3)" : 2,
      }}
    >
      {sender && (
        <span
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            color: assistant ? "var(--jmh-periwinkle)" : "var(--text-secondary)",
            margin: "0 var(--sp-2) 2px",
          }}
        >
          {sender}
        </span>
      )}
      <div
        role={failed ? "button" : undefined}
        tabIndex={failed ? 0 : undefined}
        onClick={failed ? onRetry : undefined}
        onKeyDown={failed ? (e) => (e.key === "Enter" || e.key === " ") && onRetry() : undefined}
        style={{
          maxWidth: "82%",
          background,
          color,
          border: mine ? "none" : "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "8px 12px 6px",
          boxShadow: "var(--shadow-sm)",
          opacity: message.status === "sending" ? 0.7 : 1,
          outline: failed ? "2px solid var(--jmh-coral)" : "none",
          cursor: failed ? "pointer" : "default",
        }}
      >
        <div
          dir="auto"
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-base)",
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {message.body}
        </div>
        <div
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-xs)",
            marginTop: 2,
            textAlign: "end",
            opacity: 0.75,
          }}
        >
          {failed ? "לא נשלחה · הקישו לנסות שוב" : timeFmt.format(new Date(message.created_at))}
        </div>
      </div>
    </div>
  );
}

function TypingHint() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginTop: "var(--sp-3)" }}>
      <span
        role="status"
        style={{
          fontFamily: "var(--font)",
          fontSize: "var(--text-sm)",
          color: "var(--jmh-periwinkle)",
          background: "var(--jmh-periwinkle-bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "6px 12px",
        }}
      >
        איתן כותב…
      </span>
    </div>
  );
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "var(--sp-4) 0 var(--sp-1)" }}>
      <span
        style={{
          fontFamily: "var(--font)",
          fontSize: "var(--text-xs)",
          fontWeight: 500,
          color: "var(--text-muted)",
          background: "var(--jmh-blue-05)",
          borderRadius: "var(--r-full)",
          padding: "3px 10px",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        margin: "auto",
        textAlign: "center",
        padding: "var(--sp-8) var(--sp-6)",
        fontFamily: "var(--font)",
        color: "var(--text-secondary)",
      }}
    >
      <p style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 var(--sp-2)" }}>
        הצ׳אט המשפחתי
      </p>
      <p style={{ fontSize: "var(--text-sm)", margin: 0, lineHeight: 1.5 }}>
        כתבו לאיתן מה לזכור, והוא יקבע תזכורות לכם.
        <br />
        למשל: ״תזכיר לנו מחר ב-16:00 לקחת את איתן לרופא״
      </p>
    </div>
  );
}
