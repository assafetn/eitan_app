"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { FamilyMember, OccurrenceOverride, Task, TaskStatus } from "@/lib/types";
import { addDaysISO, formatDueDate, resolveOccurrencesInRange, todayISO, type ResolvedOccurrence } from "@/lib/recurrence";
import TaskRow from "@/components/ui/TaskRow";
import Toast from "@/components/ui/Toast";
import { CircleCheck, Settings } from "lucide-react";

const SAVE_FAILED = "השמירה נכשלה, נסו שוב";

interface Props {
  appName: string;
  firstName: string | null;
  initialTasks: Task[];
  initialOverrides: OccurrenceOverride[];
  /** Household adults — threaded to each TaskRow's person field. */
  adults: FamilyMember[];
}

// How far ahead to look for the "next upcoming" fallback.
const UPCOMING_HORIZON_DAYS = 90;

function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "בוקר טוב";
  if (hour >= 12 && hour < 17) return "צהריים טובים";
  if (hour >= 17 && hour < 21) return "ערב טוב";
  return "לילה טוב";
}

function byDate(a: ResolvedOccurrence, b: ResolvedOccurrence): number {
  return (a.date ?? "") < (b.date ?? "") ? -1 : (a.date ?? "") > (b.date ?? "") ? 1 : 0;
}

// Hebrew count phrase for tasks: 1 → "משימה אחת", otherwise "N משימות".
function tasksCountPhrase(n: number): string {
  return n === 1 ? "משימה אחת" : `${n} משימות`;
}

// Templated (no AI) whole-household summary line. Zero → a calm empty state;
// otherwise a pluralized count with an optional overdue clause, e.g.
// "יש 3 משימות להיום, אחת מהן באיחור".
function summarySentence(todayCount: number, overdueCount: number): string {
  if (todayCount === 0) return "אין משימות פתוחות להיום";
  let s = `יש ${tasksCountPhrase(todayCount)} להיום`;
  if (overdueCount > 0) {
    s += `, ${overdueCount === 1 ? "אחת מהן" : `${overdueCount} מהן`} באיחור`;
  }
  return s;
}

export default function HomeClient({ appName, firstName, initialTasks, initialOverrides, adults }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [overrides, setOverrides] = useState<OccurrenceOverride[]>(initialOverrides);
  // Transient failure toast for reverted optimistic updates.
  const [toast, setToast] = useState<string | null>(null);

  const today = todayISO();

  // What to show: today's open tasks (incl. overdue, same as the list's "היום"),
  // and if there are none, the tasks on the nearest upcoming day instead.
  const { mode, list, todayCount, overdueCount, next3 } = useMemo<{
    mode: "today" | "upcoming" | "empty";
    list: ResolvedOccurrence[];
    todayCount: number;
    overdueCount: number;
    next3: ResolvedOccurrence[];
  }>(() => {
    // Open occurrences dated today (recurring today + singles due today).
    const todayResolved = resolveOccurrencesInRange(tasks, overrides, today, today).filter(
      (o) => o.status === "open"
    );
    // Overdue open singles (recurring series aren't back-filled) — count as "today".
    const overdue: ResolvedOccurrence[] = tasks
      .filter(
        (t) =>
          !t.recurrence_rule &&
          t.recurrence_parent_id == null &&
          t.status === "open" &&
          t.due_date != null &&
          t.due_date < today
      )
      .map((t) => ({
        key: t.id,
        task: t,
        date: t.due_date as string,
        status: "open" as const,
        isRecurring: false,
        completedAt: null,
      }));

    const todayList = [...overdue, ...todayResolved].sort(byDate);

    // Household summary counts (home fetches all tasks unfiltered → both adults
    // combined). "Today" mirrors the list: today's open + overdue open tasks.
    const overdueCount = overdue.length;
    const todayCount = todayList.length;

    // Next 3 upcoming open tasks, today onward, soonest first — same resolver and
    // status conditions used elsewhere (no new date logic).
    const next3 = resolveOccurrencesInRange(tasks, overrides, today, addDaysISO(today, UPCOMING_HORIZON_DAYS))
      .filter((o) => o.status === "open" && o.date)
      .sort(byDate)
      .slice(0, 3);

    if (todayList.length > 0) {
      return { mode: "today", list: todayList, todayCount, overdueCount, next3 };
    }

    // Fallback: the soonest upcoming day that has open tasks.
    const upcoming = resolveOccurrencesInRange(
      tasks,
      overrides,
      addDaysISO(today, 1),
      addDaysISO(today, UPCOMING_HORIZON_DAYS)
    )
      .filter((o) => o.status === "open" && o.date)
      .sort(byDate);

    if (upcoming.length === 0) {
      return { mode: "empty", list: [], todayCount, overdueCount, next3 };
    }
    const soonest = upcoming[0].date;
    return {
      mode: "upcoming",
      list: upcoming.filter((o) => o.date === soonest),
      todayCount,
      overdueCount,
      next3,
    };
  }, [tasks, overrides, today]);

  // Greeting + date use the browser's local time; suppress hydration mismatch
  // since the server clock differs from the user's.
  const [greeting] = useState(() => greetingForHour(new Date().getHours()));
  const [dateLine] = useState(() =>
    new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  );

  async function getMyMemberId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return null;
    const { data } = await supabase.from("family_members").select("id").eq("auth_user_id", uid).single();
    return data?.id ?? null;
  }

  // Same override / completed_at path as the list and calendar — a task toggled
  // here reflects everywhere because it writes the same row.
  async function toggleOccurrence(occ: ResolvedOccurrence) {
    const supabase = createClient();

    if (!occ.isRecurring) {
      const newStatus: TaskStatus = occ.status === "open" ? "done" : "open";
      setTasks((prev) =>
        prev.map((t) =>
          t.id === occ.task.id
            ? { ...t, status: newStatus, completed_at: newStatus === "done" ? new Date().toISOString() : null }
            : t
        )
      );
      await supabase
        .from("tasks")
        .update({
          status: newStatus,
          completed_at: newStatus === "done" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", occ.task.id);
      return;
    }

    const parentId = occ.task.id;
    const date = occ.date as string;

    if (occ.status === "open") {
      const tempId = `temp:${parentId}:${date}`;
      const completedAt = new Date().toISOString();
      setOverrides((prev) => [
        ...prev,
        { id: tempId, recurrence_parent_id: parentId, due_date: date, status: "done", completed_at: completedAt },
      ]);
      const memberId = (await getMyMemberId(supabase)) ?? occ.task.created_by;
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: occ.task.title,
          status: "done",
          priority: "normal",
          recurrence_parent_id: parentId,
          due_date: date,
          created_by: memberId,
          completed_at: completedAt,
        })
        .select("id, recurrence_parent_id, due_date, status, completed_at")
        .single();
      if (error || !data) {
        setOverrides((prev) => prev.filter((o) => o.id !== tempId));
        setToast(SAVE_FAILED);
      } else {
        setOverrides((prev) => prev.map((o) => (o.id === tempId ? (data as OccurrenceOverride) : o)));
      }
    } else {
      const ov = overrides.find((o) => o.recurrence_parent_id === parentId && o.due_date === date);
      if (!ov) return;
      setOverrides((prev) => prev.filter((o) => o.id !== ov.id));
      if (!ov.id.startsWith("temp:")) {
        await supabase.from("tasks").delete().eq("id", ov.id);
      }
    }
  }

  const sectionTitle = mode === "upcoming" ? "הקרוב" : "להיום";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 600,
        margin: "0 auto",
        padding: "var(--sp-6) var(--sp-4)",
        paddingTop: "var(--sp-8)",
      }}
    >
      {/* Header — welcome message */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--sp-3)",
          marginBottom: "var(--sp-8)",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--font)",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: "var(--jmh-blue)",
              margin: "0 0 var(--sp-1)",
            }}
          >
            {appName}
          </p>
          <h1
            suppressHydrationWarning
            style={{
              fontFamily: "var(--font)",
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            {firstName ? `${greeting}, ${firstName}` : greeting}
          </h1>
          <p
            suppressHydrationWarning
            style={{
              fontFamily: "var(--font)",
              fontSize: "var(--text-sm)",
              color: "var(--text-muted)",
              margin: "var(--sp-1) 0 0",
            }}
          >
            {dateLine}
          </p>
        </div>

        {/* Settings entry point — gear, not a nav tab (we're at tab capacity) */}
        <Link
          href="/settings"
          aria-label="הגדרות"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: "var(--r-full)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            boxShadow: "var(--shadow-sm)",
            flexShrink: 0,
          }}
        >
          <Settings size={18} strokeWidth={2} />
        </Link>
      </div>

      {/* Household summary — templated (no AI), both adults combined. Derived
          entirely from the tasks/overrides already passed to this page. */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-sm)",
          padding: "var(--sp-5)",
          marginBottom: "var(--sp-6)",
        }}
      >
        <p
          suppressHydrationWarning
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-md)",
            fontWeight: 600,
            color: "var(--text-primary)",
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          {summarySentence(todayCount, overdueCount)}
        </p>

        {/* Next 3 upcoming open tasks (today onward, soonest first) */}
        <div style={{ marginTop: "var(--sp-4)" }}>
          <p
            style={{
              fontFamily: "var(--font)",
              fontSize: "var(--text-xs)",
              fontWeight: 500,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              margin: "0 0 var(--sp-1)",
            }}
          >
            בקרוב
          </p>
          {next3.length === 0 ? (
            <p
              style={{
                fontFamily: "var(--font)",
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              אין משימות קרובות
            </p>
          ) : (
            <div>
              {next3.map((occ, i) => (
                <div
                  key={occ.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--sp-3)",
                    paddingBlock: "var(--sp-2)",
                    borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font)",
                      fontSize: "var(--text-sm)",
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      minWidth: 0,
                    }}
                  >
                    {occ.task.title}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font)",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    {formatDueDate(occ.date as string, occ.task.due_time)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tasks — today, or the next upcoming day if today is clear */}
      {mode === "empty" ? (
        <div style={{ textAlign: "center", padding: "var(--sp-12) var(--sp-6)", color: "var(--text-muted)" }}>
          <CircleCheck size={36} strokeWidth={1.5} style={{ color: "var(--border-strong)", marginBottom: "var(--sp-3)" }} />
          <p style={{ fontFamily: "var(--font)", fontSize: "var(--text-base)", margin: 0 }}>
            אין משימות קרובות. הכול רגוע.
          </p>
        </div>
      ) : (
        <>
          <p
            style={{
              fontFamily: "var(--font)",
              fontSize: "var(--text-xs)",
              fontWeight: 500,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              margin: "0 0 var(--sp-2)",
            }}
          >
            {sectionTitle}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {list.map((occ) => (
              // Tapping the row body opens the full משימות tab; the toggle circle
              // inside stops propagation, so it still completes in place.
              <div
                key={occ.key}
                onClick={() => router.push("/tasks")}
                role="link"
                aria-label={`פתח משימות: ${occ.task.title}`}
              >
                <TaskRow
                  task={occ.task}
                  adults={adults}
                  date={occ.date}
                  status={occ.status}
                  isRecurring={occ.isRecurring}
                  onToggle={() => toggleOccurrence(occ)}
                />
              </div>
            ))}
          </div>
        </>
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
