// Runs one Eitan turn: build the conversation from the chat, let Claude call
// the task tools, return the text to post (or null to stay silent).

import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "@/lib/types";
import { makeTools, openItemsSnapshot, type EitanContext } from "./tools";
import { contextBlock, SILENT_TOKEN, STATIC_SYSTEM, type RecentReminder } from "./prompt";
import { jerusalemNow } from "./time";

const MODEL = "claude-opus-5-5";
const HISTORY_MESSAGES = 30;
const MAX_TOOL_ROUNDS = 8;

type Effort = "low" | "medium" | "high";
// EITAN_EFFORT overrides for experiments. Default "low", measured 2026-11-24
// on the same 4 test messages: medium took 3.4–11.2s (avg 7.3s), low took
// 4.0–6.3s (avg 5.4s), with equally correct dates, tools and confirmations.
const EFFORT: Effort = (["low", "medium", "high"] as const).includes(process.env.EITAN_EFFORT as Effort)
  ? (process.env.EITAN_EFFORT as Effort)
  : "low";

const FALLBACK_REPLY = "סליחה, משהו השתבש אצלי. אפשר לנסות שוב?";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  // Reads ANTHROPIC_API_KEY. Created lazily so a missing key fails this
  // request with a clear message instead of crashing the module at import.
  client ??= new Anthropic();
  return client;
}

/** "[2026-11-23 23:27]" — when a message was sent, in Israel time. */
function sentAt(iso: string): string {
  const { date, time } = jerusalemNow(new Date(iso));
  return `[${date} ${time}]`;
}

/**
 * Chat rows (oldest first) → Messages API turns. Must start with a user turn.
 * Each adult message carries its send time, so "מחר" written last night is
 * read relative to last night, not to today.
 */
function toMessages(history: ChatMessage[], nameById: Map<string, string>): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history) {
    if (m.role === "assistant") {
      if (out.length === 0) continue; // the API requires the first turn to be the user's
      out.push({ role: "assistant", content: m.body });
    } else {
      const name = (m.author_id && nameById.get(m.author_id)) || "מישהו";
      out.push({ role: "user", content: `${sentAt(m.created_at)} ${name}: ${m.body}` });
    }
  }
  return out;
}

export interface EitanResult {
  reply: string | null;
  taskIds: string[];
}

export async function runEitan(
  ctx: Omit<EitanContext, "today" | "touchedTaskIds">,
  history: ChatMessage[],
  recentReminders: RecentReminder[] = []
): Promise<EitanResult> {
  const now = jerusalemNow();
  const full: EitanContext = { ...ctx, today: now.date, touchedTaskIds: new Set() };
  const nameById = new Map(ctx.adults.map((a) => [a.id, a.name]));

  const messages = toMessages(history.slice(-HISTORY_MESSAGES), nameById);
  if (messages.length === 0) return { reply: null, taskIds: [] };

  const t0 = Date.now();
  const snapshot = await openItemsSnapshot(full);
  const tSnapshot = Date.now() - t0;

  try {
    const runner = anthropic().beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 16000,
      // Thinking depth: the main speed/quality dial for chat (see EFFORT).
      output_config: { effort: EFFORT },
      // On a safety decline, the API re-runs the request on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // Send the full history each round; no server-side thread retention.
      thread: false,
      max_iterations: MAX_TOOL_ROUNDS,
      system: [
        { type: "text", text: STATIC_SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: contextBlock(full, now.time, snapshot, recentReminders) },
      ],
      tools: makeTools(full),
      messages,
    });

    // Iterate round by round so each model call can be timed.
    let final: Anthropic.Beta.BetaMessage | null = null;
    const rounds: string[] = [];
    let tPrev = Date.now();
    for await (const msg of runner) {
      const u = msg.usage;
      rounds.push(
        `${Date.now() - tPrev}ms in=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens} stop=${msg.stop_reason}`
      );
      tPrev = Date.now();
      final = msg;
    }
    console.log(
      `[eitan] effort=${EFFORT} total=${Date.now() - t0}ms snapshot=${tSnapshot}ms rounds=${rounds.length} | ${rounds.join(" | ")}`
    );
    if (!final) throw new Error("runner produced no message");

    if (final.stop_reason === "refusal") {
      return { reply: "את זה אני לא יכול לעשות. אפשר לנסח אחרת?", taskIds: [...full.touchedTaskIds] };
    }

    const text = final.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text || text === SILENT_TOKEN) return { reply: null, taskIds: [...full.touchedTaskIds] };
    return { reply: text.replace(SILENT_TOKEN, "").trim(), taskIds: [...full.touchedTaskIds] };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("[eitan] Anthropic API key missing or invalid");
    } else if (err instanceof Anthropic.RateLimitError) {
      console.error("[eitan] rate limited");
    } else if (err instanceof Anthropic.APIError) {
      console.error(`[eitan] API error ${err.status}: ${err.message}`);
    } else {
      console.error("[eitan] failed", err);
    }
    // If tools already changed something, say so rather than a bare error.
    return {
      reply: full.touchedTaskIds.size
        ? "שמרתי חלק מהשינויים אבל משהו השתבש באמצע. כדאי לבדוק ברשימת המשימות."
        : FALLBACK_REPLY,
      taskIds: [...full.touchedTaskIds],
    };
  }
}
