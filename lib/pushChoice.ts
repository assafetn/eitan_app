// A task's push choice (migration 021), shared by Eitan's tools, the reminder
// cron and the buttons under Eitan's replies in the chat.

import type { Task } from "@/lib/types";

/** Every adult's default (family_members.reminder_lead_minutes, migration 020). */
export const DEFAULT_PUSH_LEAD_MINUTES = 30;

/** The lead choices offered as buttons, in order. */
export const PUSH_LEAD_CHOICES = [30, 15, 0] as const;

/** "30 דק׳ לפני" / "רבע שעה לפני" / "בזמן" / "שעה לפני" … */
export function leadLabel(minutes: number): string {
  if (minutes === 0) return "בזמן";
  if (minutes === 15) return "רבע שעה לפני";
  if (minutes === 60) return "שעה לפני";
  if (minutes % 60 === 0) return `${minutes / 60} שעות לפני`;
  return `${minutes} דק׳ לפני`;
}

export function effectiveLead(task: Pick<Task, "push_lead_minutes">): number {
  return task.push_lead_minutes ?? DEFAULT_PUSH_LEAD_MINUTES;
}

/** One line describing when the push goes out, for Eitan and the chat card. */
export function pushLabel(task: Pick<Task, "push_enabled" | "push_lead_minutes" | "due_time">): string {
  if (!task.push_enabled) return "בלי פוש";
  if (!task.due_time) return "בלי שעה, אז אין פוש (רק בסיכום של 07:30)";
  return `פוש ${leadLabel(effectiveLead(task))}`;
}
