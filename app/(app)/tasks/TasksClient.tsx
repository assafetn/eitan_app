"use client";

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  FamilyMember,
  Label,
  OccurrenceOverride,
  RecurrenceRule,
  Responsibility,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";
import { addDaysISO, expandOccurrences, isCompletedOccurrenceVisible, todayISO } from "@/lib/recurrence";
import { getTaskPeople } from "@/lib/taskPeople";
import { useCoalescedRefresh } from "@/lib/useCoalescedRefresh";
import TaskRow from "@/components/ui/TaskRow";
import AddTaskModal from "@/components/ui/AddTaskModal";
import CalendarView from "@/components/ui/CalendarView";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import { CalendarDays, List, Plus } from "lucide-react";

const SAVE_FAILED = "השמירה נכשלה, נסו שוב";
const DELETE_FAILED = "המחיקה נכשלה, נסו שוב";

interface Props {
  initialTasks: Task[];
  initialOverrides: OccurrenceOverride[];
  members: FamilyMember[];
  childMembers: FamilyMember[];
  /** Existing responsibilities, offered in the add-task sheet. Defaults to []. */
  responsibilities?: Responsibility[];
  /** Existing labels, offered in the add-task sheet. Defaults to []. */
  labels?: Label[];
  /** Heading shown at the top. Defaults to "משימות". */
  title?: string;
  /** Whether to show the "add task" button. Defaults to true. */
  showAddButton?: boolean;
  /** When true, completed occurrences are hidden entirely (open-only view). */
  openOnly?: boolean;
  /** Whether to show the אחריות/owner filter bar. /tasks only; off elsewhere. */
  showFilter?: boolean;
  /** Whether to show the רשימה/לוח שנה view toggle. /tasks only; off elsewhere. */
  showViewToggle?: boolean;
}

// אחריות filter selection: a responsibility id, "all", or "none" (unassigned).
type RespFilter = string | "all" | "none";
// owner filter selection: an adult member id, or "all".
type OwnerFilter = string | "all";
// Which view of the same data is shown in the משימות tab.
type TaskView = "list" | "calendar";

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
  responsibilities: initialResponsibilities = [],
  labels: initialLabels = [],
  title = "משימות",
  showAddButton = true,
  openOnly = false,
  showFilter = false,
  showViewToggle = false,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [overrides, setOverrides] = useState<OccurrenceOverride[]>(initialOverrides);
  // Held in state so inline-created responsibilities/labels appear immediately
  // and persist across re-opens of the sheet within this session.
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>(initialResponsibilities);
  const [labels, setLabels] = useState<Label[]>(initialLabels);
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

  // Filter state — local UI only, resets on reload (7.3). The two cuts combine.
  const [respFilter, setRespFilter] = useState<RespFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  // View toggle — local UI only. Always opens to the list (locked: list is primary).
  const [view, setView] = useState<TaskView>("list");

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

  // Open-task counts per filter label, derived from the SAME occurrence list the
  // view builds (no new query, no re-implemented status logic). A recurring
  // series counts once — distinct task id — not once per expanded occurrence, so
  // the badge reads as "open tasks", not a huge occurrence tally. Counts are
  // per-label totals, independent of the currently active אחריות/owner cut
  // (simpler + predictable; the two cuts otherwise combine).
  const filterCounts = useMemo(() => {
    const respSets = new Map<string, Set<string>>();
    const ownerSets = new Map<string, Set<string>>();
    const allSet = new Set<string>();
    const noneSet = new Set<string>();
    for (const occ of occurrences) {
      if (occ.status !== "open") continue; // open only — exclude done/completed
      const t = occ.task;
      allSet.add(t.id);
      // אחריות counts — driven by responsibility_id, matching the respFilter cut.
      if (t.responsibility_id) {
        let rs = respSets.get(t.responsibility_id);
        if (!rs) respSets.set(t.responsibility_id, (rs = new Set()));
        rs.add(t.id);
      } else {
        noneSet.add(t.id);
      }
      // owner counts — driven by the SAME getTaskPeople predicate the owner cut
      // uses below, so a shared task counts for both adults and counts never
      // disagree with the rows the filter shows.
      for (const p of getTaskPeople(t, members)) {
        let os = ownerSets.get(p.id);
        if (!os) ownerSets.set(p.id, (os = new Set()));
        os.add(t.id);
      }
    }
    const resp: Record<string, number> = {};
    respSets.forEach((s, id) => (resp[id] = s.size));
    const owner: Record<string, number> = {};
    ownerSets.forEach((s, id) => (owner[id] = s.size));
    return { all: allSet.size, none: noneSet.size, resp, owner };
  }, [occurrences, members]);

  // ONE filter predicate, shared by BOTH views. Recurring occurrences carry
  // their series parent in `occ.task`, so filtering by responsibility/owner
  // includes/excludes them by the PARENT (same rule as 7.3). useCallback keeps
  // its identity stable so CalendarView's memo doesn't churn.
  const filterActive = respFilter !== "all" || ownerFilter !== "all";
  const matchesFilter = useCallback(
    (t: Task): boolean => {
      // אחריות cut
      if (respFilter === "none") {
        if (t.responsibility_id !== null) return false;
      } else if (respFilter !== "all") {
        if (t.responsibility_id !== respFilter) return false;
      }
      // owner cut — tested against the derived people (shared → both adults,
      // else assignee, else responsibility owner). A shared task matches BOTH
      // adults' filters; a task with no people matches neither.
      if (ownerFilter !== "all") {
        const peopleIds = getTaskPeople(t, members).map((p) => p.id);
        if (!peopleIds.includes(ownerFilter)) return false;
      }
      return true;
    },
    [respFilter, ownerFilter, members]
  );

  // List view: narrow the resolved occurrences; date grouping below is unchanged.
  const filteredOccurrences = useMemo(
    () => (filterActive ? occurrences.filter((occ) => matchesFilter(occ.task)) : occurrences),
    [occurrences, filterActive, matchesFilter]
  );

  const { overdue, today, upcoming, noDate } = useMemo(
    () => groupOccurrences(filteredOccurrences),
    [filteredOccurrences]
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
      setTasks((prev) =>
        prev.map((t) =>
          t.id === occ.task.id ? { ...t, status: newStatus, completed_at: completedAt } : t
        )
      );
      await supabase
        .from("tasks")
        .update({
          status: newStatus,
          completed_at: completedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", occ.task.id);
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
        await supabase.from("tasks").delete().eq("id", ov.id);
      }
      scheduleRefresh();
    }
  }

  // A row is "recurring" if it's a virtual occurrence expanded from a parent OR
  // the task itself carries a recurrence_rule (the series parent row).
  function isRecurringOcc(occ: Occurrence): boolean {
    return occ.isRecurring || !!occ.task.recurrence_rule;
  }

  // Decide whether a delete needs confirmation. Done single tasks delete
  // immediately; open singles and ALL recurring tasks confirm first.
  function requestDelete(occ: Occurrence) {
    if (!isRecurringOcc(occ) && occ.status === "done") {
      performDelete(occ);
      return;
    }
    setPendingDelete(occ);
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

  // ── Inline create-new from the add-task sheet (7.2b) ──
  // Minimal: responsibility = name + owner; label = name. Color/edit/delete
  // stay in settings. Inserts go to the same tables under is_adult() RLS.
  async function createResponsibility(name: string, ownerId: string): Promise<Responsibility | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("responsibilities")
      .insert({ name, owner_id: ownerId, color: null })
      .select("*, owner:family_members!responsibilities_owner_id_fkey(*)")
      .single();
    if (error || !data) return null;
    const resp = data as Responsibility;
    setResponsibilities((prev) => [...prev, resp]);
    return resp;
  }

  async function createLabel(name: string): Promise<Label | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("labels")
      .insert({ name, color: null })
      .select("*")
      .single();
    if (error || !data) return null;
    const label = data as Label;
    setLabels((prev) => [...prev, label]);
    return label;
  }

  async function addTask(data: {
    title: string;
    notes: string;
    due_date: string;
    due_time: string | null;
    assignee_id: string | null;
    child_id: string | null;
    responsibility_id: string | null;
    label_ids: string[];
    recurrence_rule: RecurrenceRule | null;
    priority: TaskPriority;
    is_shared: boolean;
  }) {
    const supabase = createClient();
    const memberId = (await getMyMemberId(supabase)) ?? members[0]?.id;

    // responsibility_id + labels live on the SERIES PARENT (this row). Recurring
    // occurrences inherit them, exactly like child_id and due_time — override
    // rows never carry them.
    const { data: newTask } = await supabase
      .from("tasks")
      .insert({
        title: data.title,
        notes: data.notes || null,
        due_date: data.due_date || null,
        due_time: data.due_time,
        assignee_id: data.assignee_id || null,
        child_id: data.child_id || null,
        responsibility_id: data.responsibility_id || null,
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

    if (newTask) {
      // Attach the selected labels via the task_labels join.
      if (data.label_ids.length > 0) {
        await supabase
          .from("task_labels")
          .insert(data.label_ids.map((label_id) => ({ task_id: (newTask as Task).id, label_id })));
      }
      // Hydrate the joined responsibility + labels from props so local state is
      // complete without an extra round-trip. (Row badges render in 7.3.)
      const responsibility = responsibilities.find((r) => r.id === data.responsibility_id) ?? null;
      const taskLabels = labels.filter((l) => data.label_ids.includes(l.id));
      setTasks((prev) => [{ ...(newTask as Task), responsibility, labels: taskLabels }, ...prev]);
      scheduleRefresh();
    }
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
    responsibility_id: string | null;
    label_ids: string[];
    recurrence_rule: RecurrenceRule | null;
    priority: TaskPriority;
    is_shared: boolean;
  }) {
    if (!editingTask) return;
    const supabase = createClient();
    const id = editingTask.id;

    await supabase
      .from("tasks")
      .update({
        title: data.title,
        notes: data.notes || null,
        due_date: data.due_date || null,
        due_time: data.due_time,
        assignee_id: data.assignee_id || null,
        child_id: data.child_id || null,
        responsibility_id: data.responsibility_id || null,
        recurrence_rule: data.recurrence_rule,
        priority: data.priority,
        is_shared: data.is_shared,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Diff the label set: remove dropped links, add new ones.
    const prevLabelIds = new Set((editingTask.labels ?? []).map((l) => l.id));
    const nextLabelIds = new Set(data.label_ids);
    const toRemove = [...prevLabelIds].filter((lid) => !nextLabelIds.has(lid));
    const toAdd = data.label_ids.filter((lid) => !prevLabelIds.has(lid));
    if (toRemove.length > 0) {
      await supabase.from("task_labels").delete().eq("task_id", id).in("label_id", toRemove);
    }
    if (toAdd.length > 0) {
      await supabase.from("task_labels").insert(toAdd.map((label_id) => ({ task_id: id, label_id })));
    }

    // Update local state with re-hydrated joins so the row reflects edits without
    // a refetch. Lists come from state/props (they include the owner join).
    const responsibility = responsibilities.find((r) => r.id === data.responsibility_id) ?? null;
    const assignee = members.find((m) => m.id === data.assignee_id) ?? null;
    const child = childMembers.find((c) => c.id === data.child_id) ?? null;
    const taskLabels = labels.filter((l) => data.label_ids.includes(l.id));
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
              responsibility_id: data.responsibility_id || null,
              recurrence_rule: data.recurrence_rule,
              priority: data.priority,
              is_shared: data.is_shared,
              assignee,
              child,
              responsibility,
              labels: taskLabels,
            }
          : t
      )
    );
    setEditingTask(null);
  }

  function renderRow(occ: Occurrence) {
    return (
      <TaskRow
        key={occ.key}
        task={occ.task}
        adults={members}
        date={occ.date}
        status={occ.status}
        isRecurring={occ.isRecurring}
        onToggle={() => toggleOccurrence(occ)}
        onEdit={() => setEditingTask(occ.task)}
        onDelete={() => requestDelete(occ)}
      />
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
            color: "white",
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
          הוסף משימה
        </button>
        )}
      </div>

      {/* View toggle — swaps the content below between the list and the month
          calendar. Both views share the loaded data + the filter bar below. */}
      {showViewToggle && (
        <ViewToggle view={view} onChange={setView} />
      )}

      {/* Filter bar — sits between the toggle and the content so it visibly
          governs whichever view is shown. /tasks only; needs responsibilities. */}
      {showFilter && responsibilities.length > 0 && (
        <FilterBar
          responsibilities={responsibilities}
          adults={members}
          respFilter={respFilter}
          ownerFilter={ownerFilter}
          onRespChange={setRespFilter}
          onOwnerChange={setOwnerFilter}
          counts={filterCounts}
        />
      )}

      {view === "calendar" ? (
        <CalendarView
          tasks={tasks}
          overrides={overrides}
          adults={members}
          filterTask={matchesFilter}
          onToggle={toggleOccurrence}
          onEdit={(occ) => setEditingTask(occ.task)}
        />
      ) : (
        <>
          {/* Empty state — filter-aware copy */}
          {filteredOccurrences.length === 0 && (
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
                {filterActive ? "אין משימות באחריות זו" : "אין משימות פתוחות"}
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
        </>
      )}

      {(showAdd || editingTask) && (
        <AddTaskModal
          key={editingTask?.id ?? "new"}
          members={members}
          childMembers={childMembers}
          responsibilities={responsibilities}
          labels={labels}
          editingTask={editingTask}
          onClose={() => {
            setShowAdd(false);
            setEditingTask(null);
          }}
          onAdd={addTask}
          onSave={updateTask}
          onCreateResponsibility={createResponsibility}
          onCreateLabel={createLabel}
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
            performDelete(occ);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} />
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

  return { overdue, today, upcoming, noDate };
}

// Segmented control to switch the משימות tab between the list and the month
// calendar. Both render the same data; this only swaps the view below.
function ViewToggle({ view, onChange }: { view: TaskView; onChange: (v: TaskView) => void }) {
  return (
    <div style={{ display: "flex", marginBottom: "var(--sp-5)" }}>
      <div
        style={{
          display: "inline-flex",
          width: "100%",
          padding: 3,
          gap: 3,
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-full)",
        }}
      >
        <ViewSegItem
          label="רשימה"
          active={view === "list"}
          onClick={() => onChange("list")}
          icon={<List size={15} strokeWidth={2} />}
        />
        <ViewSegItem
          label="לוח שנה"
          active={view === "calendar"}
          onClick={() => onChange("calendar")}
          icon={<CalendarDays size={15} strokeWidth={2} />}
        />
      </div>
    </div>
  );
}

function ViewSegItem({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--sp-1)",
        padding: "8px 12px",
        borderRadius: "var(--r-full)",
        border: "none",
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--jmh-blue)" : "var(--text-muted)",
        fontFamily: "var(--font)",
        fontSize: "var(--text-sm)",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        boxShadow: active ? "var(--shadow-sm)" : "none",
        transition: `all var(--dur-fast) var(--ease-out)`,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// Filter bar: אחריות chips (primary) + a compact owner segmented control
// (secondary). The two cuts combine. Calm at 390px — chips wrap, owner sits on
// its own labelled row.
function FilterBar({
  responsibilities,
  adults,
  respFilter,
  ownerFilter,
  onRespChange,
  onOwnerChange,
  counts,
}: {
  responsibilities: Responsibility[];
  adults: FamilyMember[];
  respFilter: RespFilter;
  ownerFilter: OwnerFilter;
  onRespChange: (f: RespFilter) => void;
  onOwnerChange: (f: OwnerFilter) => void;
  /** Open-task counts per filter label (per-label totals, filter-independent). */
  counts: { all: number; none: number; resp: Record<string, number>; owner: Record<string, number> };
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", marginBottom: "var(--sp-6)" }}>
      {/* אחריות chips */}
      <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
        <FilterChip label="הכל" count={counts.all} active={respFilter === "all"} onClick={() => onRespChange("all")} />
        {responsibilities.map((r) => (
          <FilterChip
            key={r.id}
            label={r.name}
            color={r.color}
            count={counts.resp[r.id] ?? 0}
            active={respFilter === r.id}
            onClick={() => onRespChange(r.id)}
          />
        ))}
        <FilterChip label="ללא אחריות" count={counts.none} active={respFilter === "none"} onClick={() => onRespChange("none")} />
      </div>

      {/* owner segmented control (secondary) */}
      {adults.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }}>
          <span
            style={{
              fontFamily: "var(--font)",
              fontSize: "var(--text-xs)",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            בעלים
          </span>
          <div
            style={{
              display: "inline-flex",
              padding: 3,
              gap: 3,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-full)",
            }}
          >
            <SegItem label="הכל" count={counts.all} active={ownerFilter === "all"} onClick={() => onOwnerChange("all")} />
            {adults.map((a) => (
              <SegItem
                key={a.id}
                label={a.name}
                count={counts.owner[a.id] ?? 0}
                active={ownerFilter === a.id}
                onClick={() => onOwnerChange(a.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Subtle inline open-task count: sits right after the chip's label, in the same
// muted metadata weight, hidden entirely at 0. On a selected chip it inherits the
// chip's (selected) foreground so it stays legible against the active fill.
function InlineCount({ count, active }: { count: number; active: boolean }) {
  if (count === 0) return null;
  return (
    <span
      style={{
        marginInlineStart: 4,
        fontSize: 12,
        fontWeight: 500,
        color: active ? "inherit" : "var(--text-muted)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {count}
    </span>
  );
}

function FilterChip({
  label,
  color,
  count,
  active,
  onClick,
}: {
  label: string;
  color?: string | null;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--sp-1)",
        padding: "6px 14px",
        borderRadius: "var(--r-full)",
        border: `1px solid ${active ? "var(--jmh-blue-30)" : "var(--border-strong)"}`,
        background: active ? "var(--jmh-blue-05)" : "var(--surface)",
        color: active ? "var(--jmh-blue)" : "var(--text-secondary)",
        fontFamily: "var(--font)",
        fontSize: "var(--text-sm)",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: `all var(--dur-fast) var(--ease-out)`,
      }}
    >
      {color && (
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: `var(--${color})`, flexShrink: 0 }} />
      )}
      {label}
      {typeof count === "number" && <InlineCount count={count} active={active} />}
    </button>
  );
}

function SegItem({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--sp-1)",
        padding: "5px 12px",
        borderRadius: "var(--r-full)",
        border: "none",
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--jmh-blue)" : "var(--text-muted)",
        fontFamily: "var(--font)",
        fontSize: "var(--text-sm)",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        boxShadow: active ? "var(--shadow-sm)" : "none",
        transition: `all var(--dur-fast) var(--ease-out)`,
      }}
    >
      {label}
      {typeof count === "number" && <InlineCount count={count} active={active} />}
    </button>
  );
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
          letterSpacing: "0.10em",
          textTransform: "uppercase",
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
