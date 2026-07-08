import type { OccurrenceOverride, Task } from "@/lib/types";
import { resolveOccurrencesInRange, type ResolvedOccurrence } from "@/lib/recurrence";

/** Local YYYY-MM-DD for a timestamptz string (e.g. completed_at). */
export function localDateOfTimestamp(ts: string): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Open task counts per child — the SAME rule the משפחה screen uses:
 * count primary rows (recurrence_parent_id is null) with status 'open' and a
 * child_id; each recurring series parent is counted once (occurrences are NOT
 * expanded). Returns Map<childId, count>.
 */
export function openTaskCountsByChild(tasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.recurrence_parent_id != null) continue; // overrides excluded
    if (t.status !== "open") continue;
    if (!t.child_id) continue;
    counts.set(t.child_id, (counts.get(t.child_id) ?? 0) + 1);
  }
  return counts;
}

/** Today's OPEN occurrences — reuses the list/calendar occurrence engine. */
export function openOccurrencesForDay(
  tasks: Task[],
  overrides: OccurrenceOverride[],
  dayIso: string
): ResolvedOccurrence[] {
  return resolveOccurrencesInRange(tasks, overrides, dayIso, dayIso).filter(
    (o) => o.status === "open"
  );
}

/**
 * Completed-today count: single tasks whose completed_at is today, plus
 * recurring occurrences whose override row for today is done. No expansion.
 */
export function countCompletedToday(
  tasks: Task[],
  overrides: OccurrenceOverride[],
  todayIso: string
): number {
  let n = 0;
  for (const t of tasks) {
    if (t.recurrence_rule) continue; // the series parent itself is never "completed"
    if (t.recurrence_parent_id != null) continue; // primary singles only
    if (t.status === "done" && t.completed_at && localDateOfTimestamp(t.completed_at) === todayIso) {
      n++;
    }
  }
  for (const o of overrides) {
    if (o.status === "done" && o.due_date === todayIso) n++;
  }
  return n;
}
