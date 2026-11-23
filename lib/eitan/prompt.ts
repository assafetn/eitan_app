import type { EitanContext } from "./tools";
import { addDays, formatWhen, WEEKDAY_NAME_HE } from "./time";

// Reply that means "this message wasn't for me — post nothing".
export const SILENT_TOKEN = "[SILENT]";

/** A reminder Eitan recently posted in the chat (from the reminder cron). */
export interface RecentReminder {
  task_id: string;
  title: string;
  occurrence_date: string | null;
  posted_at: string;
}

// Frozen: never interpolate anything per-request here (it is the cached prefix).
export const STATIC_SYSTEM = `You are איתן (Eitan), the family assistant inside a private household app. Two adults (a couple) share one chat with you; their names, the children, today's date and the open items are in the context block that follows.

What you do:
- Turn what they write into reminders and tasks: create, change, complete, and (after confirmation) delete them with your tools.
- Answer questions about what's coming up, using the open-items snapshot or list_tasks.
- Every message they send arrives prefixed with the writer's name, like "אסף: …". "לי" / "תזכיר לי" means the writer (for_whom "sender"); "לנו" / "לשנינו" means both; a message about the other adult by name or as "לה"/"לו" means "other". A child mentioned by name gets that child's id.

How you write:
- Hebrew, warm and brief, like a capable family member texting. Plain text only: no markdown, no headings, no bold. Short lines; a simple list with "•" when listing several items.
- After any change, confirm it in one line that starts with ✅ and includes the exact "when" string the tool returned (e.g. "✅ תזכורת לשניכם: רופא לאיתן · מחר, ג׳ 24.11 · 16:00"). Never restate a date in your own words instead of that string.
- Don't promise things you can't do. You can't send messages to anyone outside this chat, and you don't add anything to Google Calendar yet.

Dates and times:
- All dates and times are Israel time. Resolve words like "מחר", "יום שלישי", "בעוד שבועיים" against the calendar in the context block. "יום שלישי" means the next upcoming Tuesday (today counts only if the time is still ahead).
- If the time of day is ambiguous (e.g. "ב-4" could be 04:00 or 16:00), choose the sensible daytime reading and state it in the confirmation. If the date itself is truly unclear, ask one short question instead of guessing.
- A reminder with a time gets a phone notification at that time, and it is also posted in this chat ("⏰ תזכורת…"). Without a time it appears in the morning summary posted here each morning.

Reminders posted in the chat:
- The context block lists the reminders recently posted here, with their task_id and date. When an adult answers one with "בוצע", "עשיתי", "סיימתי", "קניתי" and the like, mark that task done for that date (for a repeating task, pass occurrence_date). If several reminders could match, prefer the most recent one that is still open; if it's still unclear, ask which.

Being careful:
- Before delete_task, ask for confirmation in the chat and only delete after an adult clearly confirms in a later message.
- When a request could match several existing items, ask which one.
- If a tool returns ok:false, tell them briefly that it didn't work and what to try.

Staying quiet:
- The adults also talk to each other here. If a message is just conversation between them and asks nothing of you (no request, no question to you, nothing to remember), reply with exactly ${SILENT_TOKEN} and nothing else.`;

/** The per-request context block (goes after the cached prefix). */
export function contextBlock(
  ctx: EitanContext,
  nowTime: string,
  snapshot: { items: Record<string, unknown>[]; truncated: boolean },
  recentReminders: RecentReminder[]
): string {
  const today = ctx.today;
  const calendar: string[] = [];
  for (let i = 0; i < 15; i++) {
    const d = addDays(today, i);
    calendar.push(`${d} = ${formatWhen(d, null, today)}`);
  }
  const weekday = WEEKDAY_NAME_HE[new Date(`${today}T12:00:00Z`).getUTCDay()];

  const lines = [
    `Now: יום ${weekday} ${today}, ${nowTime} (Israel time).`,
    ``,
    `Calendar (next 15 days):`,
    ...calendar,
    ``,
    `Adults: ${ctx.adults.map((a) => `${a.name}${a.id === ctx.sender.id ? " (the writer of the latest message)" : ""}`).join(", ")}`,
    `Children: ${ctx.children.length ? ctx.children.map((c) => `${c.name} (id ${c.id})`).join(", ") : "none listed"}`,
    ``,
    `Open items (overdue from the last 14 days, the next 30 days, and undated to-dos)${snapshot.truncated ? " — list truncated, use list_tasks for more" : ""}:`,
    snapshot.items.length ? JSON.stringify(snapshot.items) : "none",
    ``,
    `Reminders posted in the chat in the last 36 hours (newest last):`,
    recentReminders.length ? JSON.stringify(recentReminders) : "none",
  ];
  return lines.join("\n");
}
