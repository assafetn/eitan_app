"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  FamilyMember,
  OccurrenceOverride,
  RecurrenceRule,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";
import { addDaysISO, expandOccurrences, isCompletedOccurrenceVisible, todayISO } from "@/lib/recurrence";
import { useCoalescedRefresh } from "@/lib/useCoalescedRefresh";
import TaskRow from "@/components/ui/TaskRow";
import SwipeToDelete from "@/components/ui/SwipeToDelete";
import AddTaskModal from "@/components/ui/AddTaskModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import { Plus } from "lucide-react";

const SAVE_FAILED = "השמירה נכשלה, נסו שוב";
const DELETE_FAILED = "המחיקה נכשלה, נסו שוב";

interface Props {
  initialTasks: Task[];
  initialOverrides: OccurrenceOverride[];
  members: FamilyMember[];
  childMembers: FamilyMember[];
  /** Heading shown at the top. Defaults to "משימות". */
  title?: string;
  /** Whether to show the "add task" button. Defaults to true. */
  showAddButton?: boolean;
  /** When true, completed occurrences are hidden entirely (open-only view). */
  openOnly?: boolean;
  /** The signed-in adult. When set, shows the "המשימות שלי / כל המשימות"
   *  filter; "mine" = tasks they own alone plus shared ones. */
  myMemberId?: string | null;
}

type OwnerView = "mine" | "all";
const OWNER_VIEW_KEY = "eitan.tasks.view";

const HORIZON_DAYS = 90;

// A single rendered row: either a non-recurring task or one expanded
// occurrence of a recurring series.
interface Occurrence {
  key: string; // `${taskId}:${YYYY-MM-DD}` for recurring, taskId for singles
  task: Task;
  date: string | null;
  status: TaskStatus;
  isRecurring: boolean;
}

export default function TasksClient({
  initialTasks,
  initialOverrides,
  members,
  childMembers,
  title = "משימות",
  showAddButton = true,
  openOnly = false,
  myMemberId = null,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [overrides, setOverrides] = useState<OccurrenceOverride[]>(initialOverrides);
  const [showAdd, setShowAdd] = useState(false);
  // When set, the add-task sheet opens in edit mode for this task (the series
  // parent, for a recurring occurrence).
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  // The occurrence awaiting delete confirmation (null = no dialog open).
  const [pendingDelete, setPendingDelete] = useState<Occurrence | null>(null);
  // Transient failure toast for reverted optimistic updates.
  const [toast, setToast] = useState<string | null>(null);
  // Coalesced re-fetch so the nav's tasks badge stays in sync after mutations.
  const scheduleRefresh = useCoalescedRefresh();

  const occurrences = useMemo<Occurrence[]>(() => {
    const start = todayISO();
    const end = addDaysISO(start, HORIZON_DAYS);

    const overrideMap = new Map<string, OccurrenceOverride>();
    for (const o of overrides) {
      overrideMap.set(`${o.recurrence_parent_id}:${o.due_date}`, o);
    }

    const out: Occurrence[] = [];
    for (const t of tasks) {
      if (t.recurrence_rule) {
        for (const date of expandOccurrences(t, start, end)) {
          const ov = overrideMap.get(`${t.id}:${date}`);
          const status: TaskStatus = ov?.status === "done" ? "done" : "open";
          // Open-only views (child overview) hide every done occurrence. The
          // default list keeps done occurrences visible in place, then hides
          // them once past the 3-day window (same rule as the resolver).
          if (status === "done") {
            if (openOnly) continue;
            if (!isCompletedOccurrenceVisible("done", ov?.completed_at ?? null)) continue;
          }
          out.push({
            key: `${t.id}:${date}`,
            task: t,
            date,
            status,
            isRecurring: true,
          });
        }
      } else {
        // Singles: done ones stay visible in a completed state (struck-through
        // / dimmed) until the 3-day window elapses; open-only views hide all.
        if (t.status === "done") {
          if (openOnly) continue;
          if (!isCompletedOccurrenceVisible("done", t.completed_at)) continue;
        }
        out.push({
          key: t.id,
          task: t,
          date: t.due_date,
          status: t.status,
          isRecurring: false,
        });
      }
    }
    return out;
  }, [tasks, overrides, openOnly]);

  // "המשימות שלי" by default; the choice is remembered on this device.
  const [view, setView] = useState<OwnerView>("mine");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(OWNER_VIEW_KEY);
      if (saved === "mine" || saved === "all") setView(saved);
    } catch {
      // storage unavailable: keep the default
    }
  }, []);
  const chooseView = (v: OwnerView) => {
    setView(v);
    try {
      localStorage.setItem(OWNER_VIEW_KEY, v);
    } catch {
      // ignore
    }
  };
  const filterMine = !!myMemberId && view === "mine";
  const visible = useMemo(
    () =>
      filterMine
        ? occurrences.filter(
            (o) => o.task.is_shared || o.task.assignee_id === myMemberId || !o.task.assignee_id
          )
        : occurrences,
    [occurrences, filterMine, myMemberId]
  );

  const { overdue, today, upcoming, noDate } = useMemo(
    () => groupOccurrences(visible),
    [visible]
  );

  async function getMyMemberId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return null;
    const { data } = await supabase.from("family_members").select("id").eq("auth_user_id", uid).single();
    return data?.id ?? null;
  }

  async function toggleOccurrence(occ: Occurrence) {
    const supabase = createClient();

    if (!occ.isRecurring) {
      // ── Single task: flip its own status row ──
      const newStatus: TaskStatus = occ.status === "open" ? "done" : "open";
      const completedAt = newStatus === "done" ? new Date().toISOString() : null;
      // Keep completed_at in sync locally so the 3-day auto-hide has a timestamp
      // and the row stays put (done, dimmed) instead of vanishing.
      const prevStatus = occ.task.status;
      const prevCompletedAt = occ.task.completed_at;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === occ.task.id ? { ...t, status: newStatus, completed_at: completedAt } : t
        )
      );
      const { error } = await supabase
        .from("tasks")
        .update({
          status: newStatus,
          completed_at: completedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", occ.task.id);
      if (error) {
        // Revert the optimistic flip and say so — never fail silently.
        setTasks((prev) =>
          prev.map((t) =>
            t.id === occ.task.id ? { ...t, status: prevStatus, completed_at: prevCompletedAt } : t
          )
        );
        setToast(SAVE_FAILED);
        return;
      }
      scheduleRefresh();
      return;
    }

    // ── Recurring occurrence: write/remove a single override row ──
    const parentId = occ.task.id;
    const date = occ.date as string;

    if (occ.status === "open") {
      // Mark this date done → insert one override row.
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
        // revert optimistic insert
        setOverrides((prev) => prev.filter((o) => o.id !== tempId));
        setToast(SAVE_FAILED);
      } else {
        setOverrides((prev) =>
          prev.map((o) => (o.id === tempId ? (data as OccurrenceOverride) : o))
        );
        scheduleRefresh();
      }
    } else {
      // Un-complete → delete the override row.
      const ov = overrides.find(
        (o) => o.recurrence_parent_id === parentId && o.due_date === date
      );
      if (!ov) return;
      setOverrides((prev) => prev.filter((o) => o.id !== ov.id));
      if (!ov.id.startsWith("temp:")) {
        const { error } = await supabase.from("tasks").delete().eq("id", ov.id);
        if (error) {
          setOverrides((prev) => [...prev, ov]);
          setToast(SAVE_FAILED);
          return;
        }
      }
      scheduleRefresh();
    }
  }

  // A row is "recurring" if it's a virtual occurrence expanded from a parent OR
  // the task itself carries a recurrence_rule (the series parent row).
  function isRecurringOcc(occ: Occurrence): boolean {
    return occ.isRecurring || !!occ.task.recurrence_rule;
  }

  // Delete is reached from the edit sheet (not a per-row trash icon) and always
  // confirms. The sheet edits the series parent / single row, so wrap it as an
  // occurrence for the shared confirm + performDelete path.
  function requestDeleteFromSheet(task: Task) {
    setPendingDelete({
      key: task.id,
      task,
      date: task.due_date,
      status: task.status,
      isRecurring: !!task.recurrence_rule,
    });
  }

  // Optimistic delete. Virtual occurrences aren't DB rows, so we always resolve
  // to the owning row — the recurrence parent id, falling back to the task's own
  // id — and delete THAT. Deleting a parent cascades its override rows (FK).
  async function performDelete(occ: Occurrence) {
    const targetId = occ.task.recurrence_parent_id ?? occ.task.id;
    // Snapshot for revert on failure.
    const removedTask = tasks.find((t) => t.id === targetId) ?? null;
    const removedOverrides = overrides.filter((o) => o.recurrence_parent_id === targetId);

    setTasks((prev) => prev.filter((t) => t.id !== targetId));
    setOverrides((prev) => prev.filter((o) => o.recurrence_parent_id !== targetId));

    const supabase = createClient();
    const { error } = await supabase.from("tasks").delete().eq("id", targetId);
    if (error) {
      // Revert (grouping re-sorts on render, so re-insert order doesn't matter).
      if (removedTask) setTasks((prev) => [removedTask, ...prev]);
      if (removedOverrides.length > 0) setOverrides((prev) => [...prev, ...removedOverrides]);
      setToast(DELETE_FAILED);
    } else {
      scheduleRefresh();
    }
  }

  async function addTask(data: {
    title: string;
    notes: string;
    due_date: string;
    due_time: string | null;
    assignee_id: string | null;
    child_id: string | null;
    recurrence_rule: RecurrenceRule | null;
    priority: TaskPriority;
    is_shared: boolean;
  }) {
    const supabase = createClient();
    const memberId = (await getMyMemberId(supabase)) ?? members[0]?.id;

    const { data: newTask, error } = await supabase
      .from("tasks")
      .insert({
        title: data.title,
        notes: data.notes || null,
        due_date: data.due_date || null,
        due_time: data.due_time,
        assignee_id: data.assignee_id || null,
        child_id: data.child_id || null,
        status: "open",
        priority: data.priority,
        is_shared: data.is_shared,
        recurrence_rule: data.recurrence_rule,
        created_by: memberId,
      })
      .select(
        "*, assignee:family_members!tasks_assignee_id_fkey(*), child:family_members!tasks_child_id_fkey(*)"
      )
      .single();

    if (error || !newTask) {
      // Keep the sheet open with everything the user typed, so they can retry.
      setToast(SAVE_FAILED);
      return;
    }

    setTasks((prev) => [newTask as Task, ...prev]);
    scheduleRefresh();
    setShowAdd(false);
  }

  // ── Save edits to an existing task (the series parent for a recurring row) ──
  async function updateTask(data: {
    title: string;
    notes: string;
    due_date: string;
    due_time: string | null;
    assignee_id: string | null;
    child_id: string | null;
    recurrence_rule: RecurrenceRule | null;
    priority: TaskPriority;
    is_shared: boolean;
  }) {
    if (!editingTask) return;
    const supabase = createClient();
    const id = editingTask.id;

    const { error } = await supabase
      .from("tasks")
      .update({
        title: data.title,
        notes: data.notes || null,
        due_date: data.due_date || null,
        due_time: data.due_time,
        assignee_id: data.assignee_id || null,
        child_id: data.child_id || null,
        recurrence_rule: data.recurrence_rule,
        priority: data.priority,
        is_shared: data.is_shared,
        // Picking an owner here answers Eitan's "למי התזכורת?" (migration 022).
        owner_pending: !data.is_shared && !data.assignee_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      // Nothing was saved — keep the sheet open with the edits intact.
      setToast(SAVE_FAILED);
      return;
    }

    // Update local state with re-hydrated joins so the row reflects edits without
    // a refetch.
    const assignee = members.find((m) => m.id === data.assignee_id) ?? null;
    const child = childMembers.find((c) => c.id === data.child_id) ?? null;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              title: data.title,
              notes: data.notes || null,
              due_date: data.due_date || null,
              due_time: data.due_time,
              assignee_id: data.assignee_id || null,
              child_id: data.child_id || null,
              recurrence_rule: data.recurrence_rule,
              priority: data.priority,
              is_shared: data.is_shared,
              assignee,
              child,
            }
          : t
      )
    );
    setEditingTask(null);
  }

  function renderRow(occ: Occurrence) {
    return (
      <SwipeToDelete key={occ.key} onDelete={() => setPendingDelete(occ)}>
      <TaskRow
        task={occ.task}
        adults={members}
        date={occ.date}
        status={occ.status}
        isRecurring={occ.isRecurring}
        onToggle={() => toggleOccurrence(occ)}
        onEdit={() => setEditingTask(occ.task)}
      />
      </SwipeToDelete>
    );
  }

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
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--sp-6)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-2xl)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {title}
        </h1>

        {showAddButton && (
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-1)",
            padding: "10px 16px",
            background: "var(--jmh-blue)",
            color: "var(--text-on-blue)",
            borderRadius: "var(--r-full)",
            border: "none",
            fontFamily: "var(--font)",
            fontWeight: 500,
            fontSize: "var(--text-sm)",
            cursor: "pointer",
            boxShadow: "var(--shadow-sm)",
            transition: `background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--jmh-blue-80)";
            e.currentTarget.style.boxShadow = "var(--shadow-md)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--jmh-blue)";
            e.currentTarget.style.boxShadow = "var(--shadow-sm)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
        >
          <Plus size={16} strokeWidth={2} />
          הוספת משימה
        </button>
        )}
      </div>

      {myMemberId && <OwnerViewToggle value={view} onChange={chooseView} />}

      {/* Empty state */}
      {visible.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "var(--sp-16) var(--sp-6)",
            color: "var(--text-muted)",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: "var(--sp-4)" }}
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <p style={{ fontFamily: "var(--font)", fontSize: "var(--text-base)", margin: 0 }}>
            {filterMine ? "אין לך משימות פתוחות" : "אין משימות פתוחות"}
          </p>
        </div>
      )}

      {overdue.length > 0 && (
        <Section title="באיחור" accent>{overdue.map(renderRow)}</Section>
      )}
      {today.length > 0 && (
        <Section title="היום">{today.map(renderRow)}</Section>
      )}
      {upcoming.length > 0 && (
        <Section title="קרוב">{upcoming.map(renderRow)}</Section>
      )}
      {noDate.length > 0 && (
        <Section title="ללא תאריך">{noDate.map(renderRow)}</Section>
      )}

      {(showAdd || editingTask) && (
        <AddTaskModal
          key={editingTask?.id ?? "new"}
          members={members}
          childMembers={childMembers}
          editingTask={editingTask}
          onClose={() => {
            setShowAdd(false);
            setEditingTask(null);
          }}
          onAdd={addTask}
          onSave={updateTask}
          onDelete={editingTask ? () => requestDeleteFromSheet(editingTask) : undefined}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="מחיקת משימה"
          message={
            isRecurringOcc(pendingDelete)
              ? "מחיקת המשימה תמחק את כל המופעים החוזרים שלה. להמשיך?"
              : "המשימה תימחק לצמיתות. להמשיך?"
          }
          confirmLabel="מחיקה"
          onConfirm={() => {
            const occ = pendingDelete;
            setPendingDelete(null);
            setEditingTask(null); // close the sheet the delete came from
            performDelete(occ);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

// "המשימות שלי" / "כל המשימות" — a two-option pill track like the top tabs.
function OwnerViewToggle({ value, onChange }: { value: OwnerView; onChange: (v: OwnerView) => void }) {
  const options: { v: OwnerView; label: string }[] = [
    { v: "mine", label: "המשימות שלי" },
    { v: "all", label: "כל המשימות" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="אילו משימות להציג"
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        marginBottom: "var(--sp-5)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-full)",
      }}
    >
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.v)}
            style={{
              flex: 1,
              minHeight: 36,
              border: "none",
              borderRadius: "var(--r-full)",
              background: active ? "var(--jmh-blue-05)" : "transparent",
              color: active ? "var(--jmh-blue)" : "var(--text-secondary)",
              fontFamily: "var(--font)",
              fontSize: "var(--text-sm)",
              fontWeight: active ? 600 : 500,
              cursor: "pointer",
              transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function groupOccurrences(occs: Occurrence[]) {
  const t = todayISO();
  const overdue: Occurrence[] = [];
  const today: Occurrence[] = [];
  const upcoming: Occurrence[] = [];
  const noDate: Occurrence[] = [];

  for (const o of occs) {
    if (!o.date) noDate.push(o);
    // Overdue = an open task dated before today — the same condition the coral
    // strip uses. Done past-due tasks are NOT overdue and stay in their date
    // group exactly as before.
    else if (o.date < t && o.status === "open") overdue.push(o);
    else if (o.date <= t) today.push(o); // today (or a still-visible past done task)
    else upcoming.push(o);
  }

  const byDate = (a: Occurrence, b: Occurrence) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0);
  overdue.sort(byDate); // most overdue (earliest) first
  today.sort(byDate);
  upcoming.sort(byDate);

  // A recurring series expands to one occurrence per day across the whole
  // horizon, so a single daily task would put ~90 rows into "קרוב". Show each
  // series once — its next occurrence — and not at all while it already has an
  // open row today (that row is the actionable one).
  const openTodaySeries = new Set(
    today.filter((o) => o.isRecurring && o.status === "open").map((o) => o.task.id)
  );
  const seenSeries = new Set<string>();
  const upcomingCollapsed = upcoming.filter((o) => {
    if (!o.isRecurring) return true;
    if (openTodaySeries.has(o.task.id) || seenSeries.has(o.task.id)) return false;
    seenSeries.add(o.task.id);
    return true;
  });

  return { overdue, today, upcoming: upcomingCollapsed, noDate };
}

function Section({
  title,
  children,
  accent = false,
}: {
  title: string;
  children: React.ReactNode;
  /** Coral header for the overdue group (reuses the existing overdue token). */
  accent?: boolean;
}) {
  return (
    <div style={{ marginBottom: "var(--sp-6)" }}>
      <p
        style={{
          fontFamily: "var(--font)",
          fontSize: "var(--text-xs)",
          fontWeight: accent ? 600 : 500,
          color: accent ? "var(--jmh-coral)" : "var(--text-muted)",
          margin: "0 0 var(--sp-2)",
        }}
      >
        {title}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
        {children}
      </div>
    </div>
  );
}
