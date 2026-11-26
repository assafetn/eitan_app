// Eitan's tools: the only things the AI can do to the household's data.
//
// Every tool runs with the SENDER's Supabase session (RLS applies exactly as
// if they had tapped the button themselves) and returns a short JSON string.
// Dates/times are validated here — the model's output is never trusted as-is.

import type { SupabaseClient } from "@supabase/supabase-js";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import type { FamilyMember, OccurrenceOverride, RecurrenceRule, Task, Weekday } from "@/lib/types";
import { recurrenceLabel, resolveOccurrencesInRange, WEEKDAY_KEYS, type ResolvedOccurrence } from "@/lib/recurrence";
import { addDays, formatWhen, isISODate, normalizeTime, weekdayIndex } from "./time";
import { pushLabel } from "@/lib/pushChoice";

export interface EitanContext {
  /** The sender's session client — RLS applies. */
  supabase: SupabaseClient;
  sender: FamilyMember;
  otherAdult: FamilyMember | null;
  adults: FamilyMember[];
  children: FamilyMember[];
  /** Today in Jerusalem, YYYY-MM-DD. */
  today: string;
  /** Task ids created/changed this turn — stored on the reply for later steps. */
  touchedTaskIds: Set<string>;
  /** The chat message being answered (recorded as a memory's source). */
  messageId?: string | null;
}

const TASK_SELECT =
  "*, assignee:family_members!tasks_assignee_id_fkey(*), child:family_members!tasks_child_id_fkey(*)";

type ForWhom = "sender" | "other" | "both" | "ask";

// ── data access ──────────────────────────────────────────

export async function loadTasks(supabase: SupabaseClient): Promise<{ tasks: Task[]; overrides: OccurrenceOverride[] }> {
  const [{ data: tasks, error: e1 }, { data: overrides, error: e2 }] = await Promise.all([
    supabase.from("tasks").select(TASK_SELECT).is("recurrence_parent_id", null),
    supabase
      .from("tasks")
      .select("id, recurrence_parent_id, due_date, status, completed_at")
      .not("recurrence_parent_id", "is", null),
  ]);
  if (e1 || e2) throw new Error(`load tasks failed: ${(e1 ?? e2)?.message}`);
  return { tasks: (tasks as Task[]) ?? [], overrides: (overrides as OccurrenceOverride[]) ?? [] };
}

function peopleLabel(task: Task, ctx: EitanContext): string {
  if (task.owner_pending) return "עוד לא נקבע (שאלת למי)";
  if (task.is_shared) return "שניכם";
  if (task.assignee_id) return ctx.adults.find((a) => a.id === task.assignee_id)?.name ?? "לא ידוע";
  return "שניכם"; // no owner can no longer happen (migration 019)
}

function describe(occ: ResolvedOccurrence, ctx: EitanContext) {
  const t = occ.task;
  return {
    task_id: t.id,
    title: t.title,
    when: formatWhen(occ.date, t.due_time, ctx.today),
    date: occ.date,
    time: t.due_time ? t.due_time.slice(0, 5) : null,
    for: peopleLabel(t, ctx),
    child: t.child_id ? ctx.children.find((c) => c.id === t.child_id)?.name ?? null : null,
    repeats: t.recurrence_rule ? recurrenceLabel(t.recurrence_rule) : null,
    push: pushLabel(t),
    status: occ.status,
    notes: t.notes,
  };
}

function byWhen(a: ResolvedOccurrence, b: ResolvedOccurrence): number {
  const ka = `${a.date ?? "9999-99-99"} ${a.task.due_time ?? "99:99"}`;
  const kb = `${b.date ?? "9999-99-99"} ${b.task.due_time ?? "99:99"}`;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/**
 * Open items Eitan should know about up front: anything overdue (14 days
 * back), the next 30 days, and undated to-dos. Capped so the prompt stays small.
 */
export async function openItemsSnapshot(ctx: EitanContext, cap = 60) {
  const { tasks, overrides } = await loadTasks(ctx.supabase);
  const occ = resolveOccurrencesInRange(tasks, overrides, addDays(ctx.today, -14), addDays(ctx.today, 30), {
    includeUndated: true,
  })
    .filter((o) => o.status === "open")
    .sort(byWhen);
  return {
    items: occ.slice(0, cap).map((o) => ({ ...describe(o, ctx), overdue: !!o.date && o.date < ctx.today })),
    truncated: occ.length > cap,
  };
}

/** Everything Eitan remembers about the family, oldest first (capped). */
export async function loadMemories(ctx: EitanContext, cap = 200) {
  const { data, error } = await ctx.supabase
    .from("memories")
    .select("id, fact, about_member_id")
    .order("created_at", { ascending: true })
    .limit(cap);
  if (error) throw new Error(`load memories failed: ${error.message}`);
  const people = [...ctx.adults, ...ctx.children];
  return ((data as { id: string; fact: string; about_member_id: string | null }[]) ?? []).map((m) => ({
    memory_id: m.id,
    fact: m.fact,
    about: m.about_member_id ? people.find((p) => p.id === m.about_member_id)?.name ?? null : null,
  }));
}

// ── input normalisation ──────────────────────────────────

function resolvePeople(
  forWhom: ForWhom,
  ctx: EitanContext
): { assignee_id: string | null; is_shared: boolean; owner_pending: boolean } {
  switch (forWhom) {
    case "sender":
      return { assignee_id: ctx.sender.id, is_shared: false, owner_pending: false };
    case "other":
      return { assignee_id: ctx.otherAdult?.id ?? ctx.sender.id, is_shared: false, owner_pending: false };
    case "ask":
      // Saved without an owner; the chat card asks "למי התזכורת?".
      return { assignee_id: null, is_shared: false, owner_pending: true };
    case "both":
    default:
      return { assignee_id: null, is_shared: true, owner_pending: false };
  }
}

function buildRule(
  freq: "none" | "daily" | "weekly" | null,
  days: string[] | null,
  anchorDate: string | null
): RecurrenceRule | null | undefined {
  if (freq === null) return undefined; // "unchanged" (update only)
  if (freq === "none") return null;
  if (freq === "daily") return { freq: "daily" };
  const valid = (days ?? []).filter((d): d is Weekday => (WEEKDAY_KEYS as string[]).includes(d));
  if (valid.length > 0) return { freq: "weekly", days: Array.from(new Set(valid)) };
  // Weekly with no days given: repeat on the anchor date's weekday.
  return { freq: "weekly", days: [WEEKDAY_KEYS[weekdayIndex(anchorDate ?? "1970-01-04")]] };
}

const ok = (data: Record<string, unknown>) => JSON.stringify({ ok: true, ...data });
const fail = (error: string) => JSON.stringify({ ok: false, error });

// ── tool definitions ─────────────────────────────────────

const FOR_WHOM = {
  type: "string",
  enum: ["sender", "other", "both"],
  description:
    'Who owns it (only the owner gets its reminders): "sender" = the adult who wrote the message ("לי", "תזכיר לי"); "other" = the other adult (by name, "לה"/"לו"); "both" = the two adults together ("לנו", "לשנינו").',
} as const;

const FOR_WHOM_NEW = {
  type: "string",
  enum: ["sender", "other", "both", "ask"],
  description:
    FOR_WHOM.description +
    ' "ask" = the message does not say whose it is: never guess, save it with "ask" and ask "למי התזכורת?" (the app shows buttons for each adult and both).',
} as const;

// Plain integers, not nullable: strict tool schemas allow at most 16
// nullable/union parameters across all tools, and the API rejects the whole
// request above that (it did, 2026-11-26).
const PUSH_BEFORE_NEW = {
  type: "integer",
  description:
    "Phone push for a timed task: minutes before due_time. 30 = the default; use it unless they said otherwise (\"רבע שעה לפני\" = 15, \"בזמן\" = 0, \"בלי התראה\" = -1 for no push).",
} as const;

const PUSH_BEFORE_UPDATE = {
  type: "integer",
  description:
    "-2 = leave unchanged (the usual value). Otherwise minutes before due_time (30 = default, 15, 0 = at the time) or -1 = no push. Only change it when they asked.",
} as const;

/** -2 = unchanged; -1 = off; 0..1440 = minutes before (30 = the default). */
function pushPatch(value: number): { push_enabled: boolean; push_lead_minutes: number | null } | null | "bad" {
  if (value === -2) return null;
  if (value === -1) return { push_enabled: false, push_lead_minutes: null };
  if (!Number.isInteger(value) || value < 0 || value > 1440) return "bad";
  // 30 is everyone's default: store null so it follows the adult's setting.
  return { push_enabled: true, push_lead_minutes: value === 30 ? null : value };
}

const WEEKDAYS = {
  type: ["array", "null"],
  items: { type: "string", enum: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] },
  description: 'For weekly repeats: the weekdays (sun = ראשון … sat = שבת). Null otherwise.',
} as const;

export function makeTools(ctx: EitanContext) {
  const listTasks = betaTool({
    name: "list_tasks",
    description:
      "List reminders/tasks whose date falls in a date range (Jerusalem dates, inclusive). Use for questions beyond the open-items snapshot in the system prompt, e.g. a further-out week or done items. Recurring tasks are expanded into one row per date.",
    strict: true,
    inputSchema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "YYYY-MM-DD" },
        to_date: { type: "string", description: "YYYY-MM-DD, at most 92 days after from_date" },
        include_done: { type: "boolean" },
        include_undated: { type: "boolean", description: "Also list to-dos that have no date." },
      },
      required: ["from_date", "to_date", "include_done", "include_undated"],
      additionalProperties: false,
    },
    run: async (input) => {
      if (!isISODate(input.from_date) || !isISODate(input.to_date)) return fail("dates must be YYYY-MM-DD");
      if (input.to_date < input.from_date) return fail("to_date is before from_date");
      if (input.to_date > addDays(input.from_date, 92)) return fail("range too long (max 92 days)");
      const { tasks, overrides } = await loadTasks(ctx.supabase);
      const occ = resolveOccurrencesInRange(tasks, overrides, input.from_date, input.to_date, {
        includeUndated: input.include_undated,
      })
        .filter((o) => input.include_done || o.status === "open")
        .sort(byWhen);
      return ok({ count: occ.length, items: occ.slice(0, 100).map((o) => describe(o, ctx)) });
    },
  });

  const createTask = betaTool({
    name: "create_task",
    description:
      "Create a reminder / task. A task with a due_time gets a push reminder at that time; with only a date it appears in the morning summary. Only call this when the adults asked for something to be remembered or done.",
    strict: true,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short Hebrew title, e.g. 'לקחת את איתן לרופא'" },
        for_whom: FOR_WHOM_NEW,
        child_id: { type: ["string", "null"], description: "Id of the child this is about, from the family list, or null." },
        due_date: { type: ["string", "null"], description: "YYYY-MM-DD in Jerusalem, or null for an undated to-do." },
        due_time: { type: ["string", "null"], description: "HH:MM 24h, or null." },
        repeat: { type: "string", enum: ["none", "daily", "weekly"] },
        repeat_days: WEEKDAYS,
        push_minutes_before: PUSH_BEFORE_NEW,
        notes: { type: ["string", "null"] },
      },
      required: ["title", "for_whom", "child_id", "due_date", "due_time", "repeat", "repeat_days", "push_minutes_before", "notes"],
      additionalProperties: false,
    },
    run: async (input) => {
      const title = input.title.trim();
      if (!title) return fail("title is empty");
      if (input.due_date !== null && !isISODate(input.due_date)) return fail("due_date must be YYYY-MM-DD");
      const dueTime = input.due_time === null ? null : normalizeTime(input.due_time);
      if (input.due_time !== null && !dueTime) return fail("due_time must be HH:MM");
      if (input.child_id && !ctx.children.some((c) => c.id === input.child_id)) return fail("unknown child_id");
      const push = pushPatch(input.push_minutes_before);
      if (push === "bad" || input.push_minutes_before === -2) return fail("push_minutes_before must be -1 or 0..1440");

      // A repeating task needs a start date; default to today.
      const dueDate = input.due_date ?? (input.repeat !== "none" ? ctx.today : null);
      const rule = buildRule(input.repeat, input.repeat_days, dueDate) ?? null;
      const people = resolvePeople(input.for_whom as ForWhom, ctx);

      const { data, error } = await ctx.supabase
        .from("tasks")
        .insert({
          title,
          notes: input.notes?.trim() || null,
          due_date: dueDate,
          due_time: dueTime,
          assignee_id: people.assignee_id,
          is_shared: people.is_shared,
          child_id: input.child_id,
          status: "open",
          priority: "normal",
          recurrence_rule: rule,
          ...(push ?? {}),
          // No time given: the chat asks "מתי להזכיר?" once (migration 023).
          time_pending: dueTime === null,
          created_by: ctx.sender.id,
        })
        .select(TASK_SELECT)
        .single();
      if (error || !data) return fail(`save failed: ${error?.message ?? "unknown"}`);
      const task = data as Task;
      ctx.touchedTaskIds.add(task.id);
      return ok({
        created: describe(
          { key: task.id, task, date: task.due_date, status: "open", isRecurring: !!rule, completedAt: null },
          ctx
        ),
      });
    },
  });

  const updateTask = betaTool({
    name: "update_task",
    description:
      "Change an existing task (the whole series, for a repeating one). Every field is required by the schema: pass null to leave a field unchanged.",
    strict: true,
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        title: { type: ["string", "null"] },
        for_whom: { anyOf: [FOR_WHOM, { type: "null" }] },
        due_date: { type: ["string", "null"], description: "YYYY-MM-DD, or null = unchanged" },
        due_time: { type: ["string", "null"], description: "HH:MM, or null = unchanged" },
        remove_time: { type: "boolean", description: "true to clear the time (keeps the date)" },
        repeat: { anyOf: [{ type: "string", enum: ["none", "daily", "weekly"] }, { type: "null" }] },
        repeat_days: WEEKDAYS,
        push_minutes_before: PUSH_BEFORE_UPDATE,
        notes: { type: ["string", "null"] },
      },
      required: ["task_id", "title", "for_whom", "due_date", "due_time", "remove_time", "repeat", "repeat_days", "push_minutes_before", "notes"],
      additionalProperties: false,
    },
    run: async (input) => {
      const { data: existing } = await ctx.supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("id", input.task_id)
        .is("recurrence_parent_id", null)
        .maybeSingle();
      if (!existing) return fail("task not found");
      const current = existing as Task;

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.title !== null) {
        if (!input.title.trim()) return fail("title is empty");
        patch.title = input.title.trim();
      }
      if (input.for_whom !== null) Object.assign(patch, resolvePeople(input.for_whom as ForWhom, ctx));
      if (input.due_date !== null) {
        if (!isISODate(input.due_date)) return fail("due_date must be YYYY-MM-DD");
        patch.due_date = input.due_date;
      }
      if (input.remove_time) {
        patch.due_time = null;
        patch.time_pending = false; // they said it has no time
      } else if (input.due_time !== null) {
        const t = normalizeTime(input.due_time);
        if (!t) return fail("due_time must be HH:MM");
        patch.due_time = t;
        patch.time_pending = false;
      }
      const rule = buildRule(
        input.repeat as "none" | "daily" | "weekly" | null,
        input.repeat_days,
        (patch.due_date as string | undefined) ?? current.due_date
      );
      if (rule !== undefined) {
        patch.recurrence_rule = rule;
        if (rule && !current.due_date && patch.due_date === undefined) patch.due_date = ctx.today;
      }
      if (input.notes !== null) patch.notes = input.notes.trim() || null;
      const push = pushPatch(input.push_minutes_before);
      if (push === "bad") return fail("push_minutes_before must be -2, -1 or 0..1440");
      if (push) Object.assign(patch, push);

      const { data, error } = await ctx.supabase.from("tasks").update(patch).eq("id", current.id).select(TASK_SELECT).single();
      if (error || !data) return fail(`save failed: ${error?.message ?? "unknown"}`);
      const task = data as Task;
      ctx.touchedTaskIds.add(task.id);
      return ok({
        updated: describe(
          { key: task.id, task, date: task.due_date, status: task.status, isRecurring: !!task.recurrence_rule, completedAt: task.completed_at },
          ctx
        ),
      });
    },
  });

  const setDone = betaTool({
    name: "set_task_done",
    description:
      "Mark a task done (or open again). For a repeating task, pass the occurrence_date of the one day being completed.",
    strict: true,
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        done: { type: "boolean" },
        occurrence_date: { type: ["string", "null"], description: "YYYY-MM-DD for a repeating task, else null" },
      },
      required: ["task_id", "done", "occurrence_date"],
      additionalProperties: false,
    },
    run: async (input) => {
      const { data: existing } = await ctx.supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("id", input.task_id)
        .is("recurrence_parent_id", null)
        .maybeSingle();
      if (!existing) return fail("task not found");
      const task = existing as Task;
      const now = new Date().toISOString();

      if (!task.recurrence_rule) {
        const { error } = await ctx.supabase
          .from("tasks")
          .update({ status: input.done ? "done" : "open", completed_at: input.done ? now : null, updated_at: now })
          .eq("id", task.id);
        if (error) return fail(`save failed: ${error.message}`);
        ctx.touchedTaskIds.add(task.id);
        return ok({ title: task.title, status: input.done ? "done" : "open" });
      }

      // Repeating: one override row per completed date (same shape the app writes).
      const date = input.occurrence_date;
      if (!date || !isISODate(date)) return fail("occurrence_date (YYYY-MM-DD) is required for a repeating task");
      const { data: ov } = await ctx.supabase
        .from("tasks")
        .select("id")
        .eq("recurrence_parent_id", task.id)
        .eq("due_date", date)
        .maybeSingle();
      if (input.done && !ov) {
        const { error } = await ctx.supabase.from("tasks").insert({
          title: task.title,
          status: "done",
          priority: "normal",
          recurrence_parent_id: task.id,
          due_date: date,
          created_by: ctx.sender.id,
          completed_at: now,
        });
        if (error) return fail(`save failed: ${error.message}`);
      } else if (!input.done && ov) {
        const { error } = await ctx.supabase.from("tasks").delete().eq("id", (ov as { id: string }).id);
        if (error) return fail(`save failed: ${error.message}`);
      }
      ctx.touchedTaskIds.add(task.id);
      return ok({ title: task.title, date: formatWhen(date, null, ctx.today), status: input.done ? "done" : "open" });
    },
  });

  const deleteTask = betaTool({
    name: "delete_task",
    description:
      "Permanently delete a task (for a repeating task: the whole series). Only call this after an adult has explicitly confirmed the deletion in the chat.",
    strict: true,
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
      additionalProperties: false,
    },
    run: async (input) => {
      const { data: existing } = await ctx.supabase
        .from("tasks")
        .select("id, title")
        .eq("id", input.task_id)
        .is("recurrence_parent_id", null)
        .maybeSingle();
      if (!existing) return fail("task not found");
      // Override rows cascade with the parent (recurrence_parent_id ON DELETE CASCADE).
      const { error } = await ctx.supabase.from("tasks").delete().eq("id", input.task_id);
      if (error) return fail(`delete failed: ${error.message}`);
      return ok({ deleted: (existing as { title: string }).title });
    },
  });

  const people = () => [...ctx.adults, ...ctx.children];

  const rememberFact = betaTool({
    name: "remember_fact",
    description:
      "Save (or correct) a lasting fact about the family, so it is known in every future conversation. Pass replaces_memory_id to correct or update an existing fact instead of adding a duplicate.",
    strict: true,
    inputSchema: {
      type: "object",
      properties: {
        fact: { type: "string", description: "One short, self-contained Hebrew sentence, e.g. 'נועה אלרגית לבוטנים'." },
        about_member_id: { type: ["string", "null"], description: "Id of the family member it is about (adult or child), or null." },
        replaces_memory_id: { type: ["string", "null"], description: "memory_id of the fact this one corrects, or null for a new fact." },
      },
      required: ["fact", "about_member_id", "replaces_memory_id"],
      additionalProperties: false,
    },
    run: async (input) => {
      const fact = input.fact.trim();
      if (!fact) return fail("fact is empty");
      if (fact.length > 500) return fail("fact is too long (max 500 characters)");
      if (input.about_member_id && !people().some((p) => p.id === input.about_member_id)) return fail("unknown about_member_id");

      if (input.replaces_memory_id) {
        const { data, error } = await ctx.supabase
          .from("memories")
          .update({ fact, about_member_id: input.about_member_id, updated_at: new Date().toISOString() })
          .eq("id", input.replaces_memory_id)
          .select("id");
        if (error) return fail(`save failed: ${error.message}`);
        if (!data || data.length === 0) return fail("memory not found");
        return ok({ updated: fact });
      }

      const { error } = await ctx.supabase.from("memories").insert({
        fact,
        about_member_id: input.about_member_id,
        source_message_id: ctx.messageId ?? null,
        created_by: ctx.sender.id,
      });
      if (error) return fail(`save failed: ${error.message}`);
      return ok({ saved: fact });
    },
  });

  const forgetFact = betaTool({
    name: "forget_fact",
    description: "Remove a saved fact when an adult asks to forget it, or when it is no longer true.",
    strict: true,
    inputSchema: {
      type: "object",
      properties: { memory_id: { type: "string" } },
      required: ["memory_id"],
      additionalProperties: false,
    },
    run: async (input) => {
      const { data, error } = await ctx.supabase.from("memories").delete().eq("id", input.memory_id).select("fact");
      if (error) return fail(`delete failed: ${error.message}`);
      if (!data || data.length === 0) return fail("memory not found");
      return ok({ forgotten: (data[0] as { fact: string }).fact });
    },
  });

  return [listTasks, createTask, updateTask, setDone, deleteTask, rememberFact, forgetFact];
}
