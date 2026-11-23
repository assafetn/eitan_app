// Messages the reminder cron posts into the shared chat as Eitan.
// One post per task occurrence and one digest per day, for the whole
// household (not one per adult like the pushes). meta.dedupe_key and
// migration 016 make a repeat run a no-op.

import type { FamilyMember, Task } from "@/lib/types";
import type { ResolvedOccurrence } from "@/lib/recurrence";
import { formatWhen } from "./time";

export interface ChatPost {
  dedupeKey: string;
  body: string;
  meta: Record<string, unknown>;
}

type Named = Pick<FamilyMember, "id" | "name">;

/** "לאסף" / "לשניכם" / "" — who a task is for, as a chat phrase. */
export function forWhomPhrase(task: Task, adults: Named[]): string {
  if (task.is_shared) return "לשניכם";
  const name = task.assignee_id ? adults.find((a) => a.id === task.assignee_id)?.name : undefined;
  return name ? `ל${name}` : "";
}

export function buildChatReminder(occ: ResolvedOccurrence, adults: Named[], today: string): ChatPost {
  const t = occ.task;
  const date = occ.date as string;
  const who = forWhomPhrase(t, adults);
  const when = formatWhen(date, t.due_time, today);
  return {
    dedupeKey: `chat:task:${t.id}:${date}`,
    body: `⏰ תזכורת${who ? ` ${who}` : ""}: ${t.title} · ${when}\nכשזה נעשה, כתבו לי ״בוצע״.`,
    meta: { kind: "reminder", task_ids: [t.id], occurrence_date: date },
  };
}

/** Morning summary, or null when there's nothing to say. */
export function buildChatDigest(
  today: ResolvedOccurrence[],
  overdue: Task[],
  adults: Named[],
  todayISO: string
): ChatPost | null {
  if (today.length === 0 && overdue.length === 0) return null;

  const line = (t: Task, time: string | null) => {
    const who = forWhomPhrase(t, adults);
    return `• ${time ? `${time.slice(0, 5)} ` : ""}${t.title}${who ? ` (${who})` : ""}`;
  };

  const sorted = today
    .slice()
    .sort((a, b) => (a.task.due_time ?? "99:99").localeCompare(b.task.due_time ?? "99:99"));

  const parts: string[] = ["בוקר טוב ☀️"];
  if (sorted.length) {
    parts.push(`להיום, ${formatWhen(todayISO, null, todayISO).replace("היום, ", "")}:`);
    parts.push(...sorted.slice(0, 12).map((o) => line(o.task, o.task.due_time)));
    if (sorted.length > 12) parts.push(`ועוד ${sorted.length - 12}`);
  } else {
    parts.push("אין משימות להיום.");
  }
  if (overdue.length) {
    parts.push("", "עדיין פתוח מימים קודמים:");
    parts.push(...overdue.slice(0, 8).map((t) => `${line(t, null)} · ${formatWhen(t.due_date, null, todayISO)}`));
    if (overdue.length > 8) parts.push(`ועוד ${overdue.length - 8}`);
  }

  return {
    dedupeKey: `chat:digest:${todayISO}`,
    body: parts.join("\n"),
    meta: {
      kind: "digest",
      task_ids: [...sorted.map((o) => o.task.id), ...overdue.map((t) => t.id)],
    },
  };
}
