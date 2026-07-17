import type { OccurrenceOverride, RecurrenceRule, Task, TaskStatus, Weekday } from "@/lib/types";

// Week starts Sunday — index 0 = Sunday … 6 = Saturday.
export const WEEKDAY_KEYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Single-letter Hebrew weekday labels (Sun→Sat).
export const WEEKDAY_LETTERS: Record<Weekday, string> = {
  sun: "א",
  mon: "ב",
  tue: "ג",
  wed: "ד",
  thu: "ה",
  fri: "ו",
  sat: "ש",
};

// ── Date helpers (date-only, timezone-safe) ───────────────

/** Today as a local YYYY-MM-DD string. */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add n days to a YYYY-MM-DD string, returning a YYYY-MM-DD string. */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Weekday index (0 = Sunday) for a YYYY-MM-DD string. */
export function weekdayIndexISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// ── Expansion ─────────────────────────────────────────────

/**
 * Pure expansion of a recurring series into occurrence dates within a window.
 *
 * - Returns an array of YYYY-MM-DD strings (inclusive of both ends).
 * - The series anchor is the task's due_date (its start date) if set,
 *   otherwise its creation date. Occurrences never precede the anchor.
 * - The window is always bounded by the caller (the list view passes
 *   today … today + 90 days), so "daily" can never expand infinitely.
 */
export function expandOccurrences(
  task: Task,
  rangeStart: string,
  rangeEnd: string
): string[] {
  const rule = task.recurrence_rule;
  if (!rule) return [];
  if (rangeStart > rangeEnd) return [];

  const seriesStart = task.due_date ?? task.created_at.slice(0, 10);
  // Clamp the effective start to the later of (window start, series start).
  const start = rangeStart > seriesStart ? rangeStart : seriesStart;
  if (start > rangeEnd) return [];

  const out: string[] = [];

  if (rule.freq === "daily") {
    for (let d = start; d <= rangeEnd; d = addDaysISO(d, 1)) {
      out.push(d);
    }
    return out;
  }

  // weekly
  const wanted = new Set(
    (rule.days ?? []).map((k) => WEEKDAY_KEYS.indexOf(k)).filter((i) => i >= 0)
  );
  if (wanted.size === 0) return [];
  for (let d = start; d <= rangeEnd; d = addDaysISO(d, 1)) {
    if (wanted.has(weekdayIndexISO(d))) out.push(d);
  }
  return out;
}

// ── Completed-task auto-hide (display-only) ───────────────

// A completed task/occurrence stays visible for this many days, then drops out
// of the list and calendar. The DB row is never touched — this is a pure
// display filter, single-sourced here so list and calendar behave identically.
export const COMPLETED_VISIBLE_DAYS = 3;

/**
 * Whether a done occurrence should still be shown. Open occurrences are always
 * visible; a done one is visible until COMPLETED_VISIBLE_DAYS have passed since
 * `completedAt`. A missing timestamp is treated as visible (fail-open — never
 * hide something we can't date).
 */
export function isCompletedOccurrenceVisible(
  status: TaskStatus,
  completedAt: string | null,
  now: number = Date.now()
): boolean {
  if (status !== "done") return true;
  if (!completedAt) return true;
  const ageMs = now - new Date(completedAt).getTime();
  return ageMs <= COMPLETED_VISIBLE_DAYS * 24 * 60 * 60 * 1000;
}

// ── Resolved occurrences across an arbitrary window ───────

/** One rendered occurrence: a single task or one expanded date of a series. */
export interface ResolvedOccurrence {
  key: string; // `${taskId}:${YYYY-MM-DD}` for recurring, taskId for singles
  task: Task;
  date: string | null; // YYYY-MM-DD, or null for an undated single
  status: TaskStatus;
  isRecurring: boolean;
  /** Completion timestamp for a done occurrence (from the override row for a
   *  series, or the task itself for a single); null when open/unknown. */
  completedAt: string | null;
}

/**
 * Single source of truth for turning tasks + override rows into resolved
 * occurrences over an arbitrary [rangeStart, rangeEnd] window. Both the list
 * (today…+90) and the calendar (the visible month grid) build on this — it
 * wraps expandOccurrences, it does not reimplement expansion.
 *
 * - Recurring: expand the rule across the window, then apply any matching
 *   override (recurrence_parent_id + due_date = that date) → no override = open.
 * - Single: placed on its due_date as-is, if that date falls in the window.
 * - Undated singles are omitted by default (they have no calendar placement);
 *   pass includeUndated to surface them (the list's "ללא תאריך" section).
 */
export function resolveOccurrencesInRange(
  tasks: Task[],
  overrides: OccurrenceOverride[],
  rangeStart: string,
  rangeEnd: string,
  opts: { includeUndated?: boolean } = {}
): ResolvedOccurrence[] {
  const overrideMap = new Map<string, OccurrenceOverride>();
  for (const o of overrides) {
    overrideMap.set(`${o.recurrence_parent_id}:${o.due_date}`, o);
  }

  const out: ResolvedOccurrence[] = [];
  for (const t of tasks) {
    if (t.recurrence_rule) {
      for (const date of expandOccurrences(t, rangeStart, rangeEnd)) {
        const ov = overrideMap.get(`${t.id}:${date}`);
        const status: TaskStatus = ov?.status === "done" ? "done" : "open";
        const completedAt = status === "done" ? ov?.completed_at ?? null : null;
        // Drop done occurrences past the visible window (display-only hide).
        if (!isCompletedOccurrenceVisible(status, completedAt)) continue;
        out.push({
          key: `${t.id}:${date}`,
          task: t,
          date,
          status,
          isRecurring: true,
          completedAt,
        });
      }
    } else {
      const completedAt = t.status === "done" ? t.completed_at : null;
      if (!isCompletedOccurrenceVisible(t.status, completedAt)) continue;
      const d = t.due_date;
      if (!d) {
        if (opts.includeUndated) {
          out.push({ key: t.id, task: t, date: null, status: t.status, isRecurring: false, completedAt });
        }
        continue;
      }
      if (d >= rangeStart && d <= rangeEnd) {
        out.push({ key: t.id, task: t, date: d, status: t.status, isRecurring: false, completedAt });
      }
    }
  }
  return out;
}

/**
 * Israeli DD/MM for a YYYY-MM-DD date, dropping the year when it's the current
 * year; an optional due_time (HH:MM, 24h) is appended when present. Shared by the
 * task rows and the home summary so the date reads identically everywhere.
 */
export function formatDueDate(iso: string, time: string | null): string {
  const [y, m, d] = iso.split("-");
  let out = `${d}/${m}`;
  if (y !== String(new Date().getFullYear())) out += `/${y}`;
  if (time) out += ` ${time.slice(0, 5)}`;
  return out;
}

/** Short Hebrew cadence label for a recurring task, e.g. "כל יום" / "ימים א ג". */
export function recurrenceLabel(rule: RecurrenceRule): string {
  if (rule.freq === "daily") return "כל יום";
  const letters = WEEKDAY_KEYS.filter((k) => rule.days.includes(k)).map(
    (k) => WEEKDAY_LETTERS[k]
  );
  return letters.length ? `ימים ${letters.join(" ")}` : "שבועי";
}
