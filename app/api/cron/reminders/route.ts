import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { openOccurrencesForDay, overdueSingles } from "@/lib/stats";
import { sendPushToMember, type PushPayload } from "@/lib/push";
import type { OccurrenceOverride, Responsibility, Task } from "@/lib/types";

// web-push signs with Node crypto — never Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MINUTES = 15;
const DIGEST_BODY_MAX_LINES = 5;
const UNASSIGNED_LABEL = "לא משויך";

// family_members carries reminder settings that aren't on the shared
// FamilyMember interface (they're only needed here), so this route types the
// rows it actually reads.
type ReminderMember = {
  id: string;
  name: string;
  type: "adult" | "child";
  reminders_enabled: boolean;
  digest_time: string | null;
  reminder_lead_minutes: number | null;
};

type PlannedNotification = {
  kind: "digest" | "task";
  dedupeKey: string;
  memberId: string;
  memberName: string;
  title: string;
  body: string;
  url: string;
};

// ── time helpers ─────────────────────────────────────────

/** "HH:MM" / "HH:MM:SS" → minutes since midnight, or null if unparseable. */
function timeToMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "H:MM" / "HH:MM:SS" → zero-padded "HH:MM". */
function formatHHMM(value: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/**
 * Local wall-clock in Asia/Jerusalem. Uses the IANA zone via Intl so DST is
 * handled by the runtime — never a hardcoded UTC offset.
 */
function jerusalemNow(): { todayISO: string; nowMinutes: number; iso: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // Some engines render midnight as "24" under hour12:false.
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));

  return {
    todayISO: `${get("year")}-${get("month")}-${get("day")}`,
    nowMinutes: hour * 60 + minute,
    iso: now.toISOString(),
  };
}

// ── core ─────────────────────────────────────────────────

async function handle(request: Request): Promise<NextResponse> {
  // 1. AUTH — a missing secret must fail closed, never fall through to allow.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/reminders] CRON_SECRET is not set");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. QUERY PARAMS
  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const atParam = url.searchParams.get("at");

  const clock = jerusalemNow();
  let nowMinutes = clock.nowMinutes;
  let at: string | null = null;

  if (atParam !== null) {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(atParam)) {
      return NextResponse.json({ error: "invalid at parameter, expected HH:MM" }, { status: 400 });
    }
    // Honored ONLY for dry runs; silently ignored on a real run.
    if (dry) {
      at = atParam;
      nowMinutes = timeToMinutes(atParam) as number;
    }
  }

  const todayISO = clock.todayISO;
  const windowEnd = nowMinutes + WINDOW_MINUTES;
  // Deliberately does not wrap across midnight: a 23:55 window ends at 24:10 and
  // simply matches nothing above 23:59.
  const inWindow = (minutes: number) => minutes >= nowMinutes && minutes < windowEnd;

  const errors: string[] = [];
  let supabase: SupabaseClient;
  try {
    supabase = createServiceClient();
  } catch (err) {
    console.error("[cron/reminders] service client unavailable:", (err as Error).message);
    return NextResponse.json(
      {
        now: clock.iso,
        todayISO,
        nowMinutes,
        windowEnd,
        dry,
        at,
        counts: { occurrencesToday: 0, overdueSingles: 0, recipients: 0 },
        planned: [],
        sent: 0,
        skippedDuplicate: 0,
        failed: 0,
        errors: ["service client unavailable"],
      },
      { status: 200 }
    );
  }

  // 4. LOAD — same partitioning as app/(app)/home/page.tsx: primary rows vs
  // override rows. No joins needed; labels resolve through the lookup maps below.
  const [tasksRes, overridesRes, membersRes, responsibilitiesRes] = await Promise.all([
    supabase.from("tasks").select("*").is("recurrence_parent_id", null),
    supabase
      .from("tasks")
      .select("id, recurrence_parent_id, due_date, status, completed_at")
      .not("recurrence_parent_id", "is", null),
    supabase
      .from("family_members")
      .select("id, name, type, reminders_enabled, digest_time, reminder_lead_minutes"),
    supabase.from("responsibilities").select("id, owner_id"),
  ]);

  for (const [label, res] of [
    ["tasks", tasksRes],
    ["overrides", overridesRes],
    ["members", membersRes],
    ["responsibilities", responsibilitiesRes],
  ] as const) {
    if (res.error) errors.push(`load ${label}: ${res.error.message}`);
  }

  const tasks = (tasksRes.data as Task[] | null) ?? [];
  const overrides = (overridesRes.data as OccurrenceOverride[] | null) ?? [];
  const members = (membersRes.data as ReminderMember[] | null) ?? [];
  const responsibilities =
    (responsibilitiesRes.data as Pick<Responsibility, "id" | "owner_id">[] | null) ?? [];

  // The shared occurrence engine — never reimplemented here.
  const occurrences = openOccurrencesForDay(tasks, overrides, todayISO);
  const overdue = overdueSingles(tasks, todayISO);

  // 5. RECIPIENTS. Quiet hours (quiet_from / quiet_to) are intentionally IGNORED
  // in this version by explicit decision; those columns are not read.
  const recipients = members.filter((m) => m.type === "adult" && m.reminders_enabled);

  // 6. ASSIGNEE LABEL — one helper, both paths.
  const memberNameById = new Map(members.map((m) => [m.id, m.name]));
  const responsibilityOwnerById = new Map(responsibilities.map((r) => [r.id, r.owner_id]));

  function assigneeLabel(task: Task): string {
    if (task.assignee_id) {
      const name = memberNameById.get(task.assignee_id);
      if (name) return name;
    }
    if (task.responsibility_id) {
      const ownerId = responsibilityOwnerById.get(task.responsibility_id);
      const ownerName = ownerId ? memberNameById.get(ownerId) : undefined;
      if (ownerName) return ownerName;
    }
    return UNASSIGNED_LABEL;
  }

  const planned: PlannedNotification[] = [];

  // 7. DIGEST PATH
  const todayCount = occurrences.length;
  const overdueCount = overdue.length;

  if (todayCount > 0 || overdueCount > 0) {
    const todayLabel = todayCount === 1 ? "משימה אחת להיום" : `${todayCount} משימות להיום`;
    const digestTitle =
      todayCount > 0 && overdueCount > 0
        ? `${todayLabel}, ${overdueCount} באיחור`
        : todayCount > 0
        ? todayLabel
        : overdueCount === 1
        ? "משימה אחת באיחור"
        : `${overdueCount} משימות באיחור`;

    const allLines = [
      ...occurrences.map((occ) => `${occ.task.title} — ${assigneeLabel(occ.task)}`),
      ...overdue.map((t) => `באיחור: ${t.title} — ${assigneeLabel(t)}`),
    ];
    const shown = allLines.slice(0, DIGEST_BODY_MAX_LINES);
    if (allLines.length > DIGEST_BODY_MAX_LINES) {
      shown.push(`ועוד ${allLines.length - DIGEST_BODY_MAX_LINES}`);
    }
    const digestBody = shown.join("\n");

    for (const member of recipients) {
      const digestMinutes = member.digest_time ? timeToMinutes(member.digest_time) : null;
      if (digestMinutes === null || !inWindow(digestMinutes)) continue;
      planned.push({
        kind: "digest",
        dedupeKey: `digest:${member.id}:${todayISO}`,
        memberId: member.id,
        memberName: member.name,
        title: digestTitle,
        body: digestBody,
        url: "/tasks",
      });
    }
  }

  // 8. PER-TASK PATH. Lead time is per recipient, so the same task can fire in
  // different windows for the two adults — that is correct.
  for (const occ of occurrences) {
    const dueTime = occ.task.due_time;
    if (!dueTime || !occ.date) continue;
    const dueMinutes = timeToMinutes(dueTime);
    if (dueMinutes === null) continue;

    const label = assigneeLabel(occ.task);
    const body = `${formatHHMM(dueTime)} · ${label}`;

    for (const member of recipients) {
      const fireAt = dueMinutes - (member.reminder_lead_minutes ?? 0);
      if (!inWindow(fireAt)) continue;
      planned.push({
        kind: "task",
        dedupeKey: `task:${occ.task.id}:${occ.date}:${member.id}`,
        memberId: member.id,
        memberName: member.name,
        title: occ.task.title,
        body,
        url: "/tasks",
      });
    }
  }

  // 9 + 10. Claim the dedupe key BEFORE sending. A missed reminder is better
  // than a duplicate, so a failed send deliberately leaves the log row behind.
  let sent = 0;
  let skippedDuplicate = 0;
  let failed = 0;

  if (!dry) {
    for (const item of planned) {
      let claimed = false;
      try {
        const { data, error } = await supabase
          .from("notification_log")
          .upsert(
            { dedupe_key: item.dedupeKey, member_id: item.memberId, kind: item.kind },
            { onConflict: "dedupe_key", ignoreDuplicates: true }
          )
          .select("dedupe_key");

        if (error) {
          failed += 1;
          errors.push(`log ${item.kind}: ${error.message}`);
          continue;
        }
        // ignoreDuplicates → an empty result means the key already existed.
        claimed = Array.isArray(data) && data.length > 0;
      } catch (err) {
        failed += 1;
        errors.push(`log ${item.kind}: ${(err as Error).message}`);
        continue;
      }

      if (!claimed) {
        skippedDuplicate += 1;
        continue;
      }

      const payload: PushPayload = {
        title: item.title,
        body: item.body,
        url: item.url,
        tag: item.kind === "digest" ? "eitan-digest" : `eitan-task-${item.dedupeKey}`,
      };

      const result = await sendPushToMember(supabase, item.memberId, payload);
      if (result.sent > 0) sent += 1;
      else {
        failed += 1;
        errors.push(`send ${item.kind} to ${item.memberId}: no device accepted the push`);
      }
    }
  }

  // 11. Always 200. Never leaks the secret, the service key, endpoints or subscription keys.
  return NextResponse.json(
    {
      now: clock.iso,
      todayISO,
      nowMinutes,
      windowEnd,
      dry,
      at,
      counts: {
        occurrencesToday: todayCount,
        overdueSingles: overdueCount,
        recipients: recipients.length,
      },
      planned,
      sent,
      skippedDuplicate,
      failed,
      errors,
    },
    { status: 200 }
  );
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
