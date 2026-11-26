// Messages the reminder cron posts into the shared chat as Eitan.
// One post per task occurrence and one digest per day, for the whole
// household (not one per adult like the pushes). meta.dedupe_key and
// migration 016 make a repeat run a no-op.

import type { FamilyMember, Task } from "@/lib/types";
import type { ResolvedOccurrence } from "@/lib/recurrence";
import { formatWhen } from "./time";
import { effectiveLead, leadLabel } from "@/lib/pushChoice";
import { taskEmoji } from "@/lib/emoji";

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
    body: `${taskEmoji(t)} תזכורת${who ? ` ${who}` : ""}: ${t.title} · ${when}\nכשזה נעשה, כתבו לי ״בוצע״.`,
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
    return `${taskEmoji(t)} ${time ? `${time.slice(0, 5)} ` : ""}${t.title}${who ? ` (${who})` : ""}`;
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

/**
 * Summary Eitan posts once the adults have answered his question buttons
 * (whose / when) and the task is complete. One per task (dedupe key).
 */
export function buildTaskSavedPost(task: Task, adults: Named[], today: string): ChatPost {
  const who = task.is_shared ? "שניכם" : adults.find((a) => a.id === task.assignee_id)?.name ?? "—";
  const lines = [`${taskEmoji(task)} שמרתי: ${task.title}`, `למי: ${who}`];
  if (task.due_time) {
    lines.push(`מתי: ${formatWhen(task.due_date, task.due_time, today)}`);
    lines.push(task.push_enabled ? `פוש: ${pushWhen(task)}` : "פוש: בלי");
  } else {
    lines.push(`מתי: ${task.due_date ? `${formatWhen(task.due_date, null, today)} · ` : ""}בלי תזכורת`);
  }
  return {
    dedupeKey: `chat:saved:${task.id}`,
    body: lines.join("\n"),
    meta: { kind: "task_saved", task_ids: [task.id] },
  };
}

/** "חצי שעה לפני (07:30)" — the lead and the clock time the push goes out. */
function pushWhen(task: Task): string {
  const lead = effectiveLead(task);
  const [h, m] = (task.due_time as string).split(":").map(Number);
  const at = (((h * 60 + m - lead) % 1440) + 1440) % 1440;
  const hhmm = `${String(Math.floor(at / 60)).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}`;
  const label = lead === 30 ? "חצי שעה לפני" : leadLabel(lead);
  return lead === 0 ? label : `${label} (${hhmm})`;
}
