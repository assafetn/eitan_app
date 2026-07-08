"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { OccurrenceOverride, Task, TaskStatus } from "@/lib/types";
import { addDaysISO, resolveOccurrencesInRange, todayISO, type ResolvedOccurrence } from "@/lib/recurrence";
import TaskRow from "@/components/ui/TaskRow";
import { CircleCheck, Settings } from "lucide-react";

interface Props {
  appName: string;
  firstName: string | null;
  initialTasks: Task[];
  initialOverrides: OccurrenceOverride[];
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

export default function HomeClient({ appName, firstName, initialTasks, initialOverrides }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [overrides, setOverrides] = useState<OccurrenceOverride[]>(initialOverrides);

  const today = todayISO();

  // What to show: today's open tasks (incl. overdue, same as the list's "היום"),
  // and if there are none, the tasks on the nearest upcoming day instead.
  const { mode, list } = useMemo<{ mode: "today" | "upcoming" | "empty"; list: ResolvedOccurrence[] }>(() => {
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
    if (todayList.length > 0) return { mode: "today", list: todayList };

    // Fallback: the soonest upcoming day that has open tasks.
    const upcoming = resolveOccurrencesInRange(
      tasks,
      overrides,
      addDaysISO(today, 1),
      addDaysISO(today, UPCOMING_HORIZON_DAYS)
    )
      .filter((o) => o.status === "open" && o.date)
      .sort(byDate);

    if (upcoming.length === 0) return { mode: "empty", list: [] };
    const soonest = upcoming[0].date;
    return { mode: "upcoming", list: upcoming.filter((o) => o.date === soonest) };
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
    </div>
  );
}
