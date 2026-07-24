"use client";

import { useEffect, useRef, useState } from "react";
import type { FamilyMember, Label, RecurrenceRule, Responsibility, Task, TaskPriority, Weekday } from "@/lib/types";
import { addDaysISO, todayISO, WEEKDAY_KEYS, WEEKDAY_LETTERS } from "@/lib/recurrence";
import { Calendar, Check, Plus, X } from "lucide-react";

interface Props {
  members: FamilyMember[];
  childMembers: FamilyMember[];
  responsibilities: Responsibility[];
  labels: Label[];
  onClose: () => void;
  /** When set, the sheet opens in EDIT mode pre-filled from this task and
   *  submit calls onSave instead of onAdd. For a recurring series this is the
   *  series parent row. */
  editingTask?: Task | null;
  onAdd: (data: {
    title: string;
    notes: string;
    due_date: string;
    /** "HH:MM", or null when unset. Never "". */
    due_time: string | null;
    assignee_id: string | null;
    child_id: string | null;
    responsibility_id: string | null;
    label_ids: string[];
    recurrence_rule: RecurrenceRule | null;
    priority: TaskPriority;
    is_shared: boolean;
  }) => Promise<void>;
  /** Save edits to an existing task. Same payload shape as onAdd. */
  onSave?: (data: {
    title: string;
    notes: string;
    due_date: string;
    /** "HH:MM", or null when unset. Never "". */
    due_time: string | null;
    assignee_id: string | null;
    child_id: string | null;
    responsibility_id: string | null;
    label_ids: string[];
    recurrence_rule: RecurrenceRule | null;
    priority: TaskPriority;
    is_shared: boolean;
  }) => Promise<void>;
  /** Inline-create a responsibility (name + owner). Returns the new row, or
   *  null on failure. The parent persists it and adds it to the list. */
  onCreateResponsibility: (name: string, ownerId: string) => Promise<Responsibility | null>;
  /** Inline-create a label (name only). Returns the new row, or null. */
  onCreateLabel: (name: string) => Promise<Label | null>;
}

type RecurrenceChoice = "none" | "daily" | "weekly";

const RECURRENCE_OPTIONS: { value: RecurrenceChoice; label: string }[] = [
  { value: "none", label: "ללא חזרה" },
  { value: "daily", label: "יומי" },
  { value: "weekly", label: "שבועי" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-md)",
  fontFamily: "var(--font)",
  fontSize: "var(--text-base)",
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
  transition: `border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)`,
  direction: "rtl",
};

const fieldLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font)",
  fontSize: "var(--text-xs)",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

// The sheet's max-height must fall back gracefully: older engines that don't
// understand `dvh` keep the `vh` line; modern mobile Safari uses `dvh` (which
// tracks the visible viewport incl. the address bar). Two `max-height`
// declarations in one rule can't be expressed in a React style object (keys
// collapse), so this rule is injected once. The `vh` line is intentionally
// listed before the `dvh` override.
const SHEET_CSS = `
.atm-sheet { max-height: 90vh; max-height: 90dvh; }
`;

export default function AddTaskModal({
  members,
  childMembers,
  responsibilities,
  labels,
  onClose,
  editingTask,
  onAdd,
  onSave,
  onCreateResponsibility,
  onCreateLabel,
}: Props) {
  const isEditing = !!editingTask;
  const [title, setTitle] = useState(editingTask?.title ?? "");
  const [notes, setNotes] = useState(editingTask?.notes ?? "");
  const [dueDate, setDueDate] = useState(editingTask?.due_date ?? "");
  // "דחוף" — maps to the tasks.priority column ('high' | 'normal'), not a Label.
  const [urgent, setUrgent] = useState(editingTask?.priority === "high");
  // The calendar is collapsed by default behind an icon button; quick chips
  // cover the common dates. Auto-reveal when editing a task whose existing date
  // matches none of the presets, so the chosen date stays visible/changeable.
  const today = todayISO();
  const datePresets: { label: string; value: string }[] = [
    { label: "היום", value: today },
    { label: "מחר", value: addDaysISO(today, 1) },
    { label: "בעוד 3 ימים", value: addDaysISO(today, 3) },
    { label: "שבוע הבא", value: addDaysISO(today, 7) },
  ];
  // The single (visually hidden) native date input; the calendar icon opens it
  // directly via showPicker(), so there's no intermediate reveal step.
  const dateInputRef = useRef<HTMLInputElement>(null);
  // Optional due time. "" = unset. Postgres `time` comes back as "HH:MM:SS";
  // <input type="time"> speaks "HH:MM", so we normalise to "HH:MM" on the way in
  // and send "HH:MM" (or null) on the way out.
  const [dueTime, setDueTime] = useState(editingTask?.due_time?.slice(0, 5) ?? "");
  const timeInputRef = useRef<HTMLInputElement>(null);
  const timePresets: { label: string; value: string }[] = [
    { label: "בוקר", value: "08:00" },
    { label: "צהריים", value: "12:00" },
    { label: "ערב", value: "18:00" },
    { label: "לילה", value: "20:00" },
  ];
  // A time without a date is meaningless here, so the whole control is disabled
  // until a date exists (and clearing the date clears the time — see the effect).
  const timeDisabled = !dueDate;
  const [assigneeId, setAssigneeId] = useState<string | null>(editingTask?.assignee_id ?? null);
  const [childId, setChildId] = useState<string | null>(editingTask?.child_id ?? null);
  const [responsibilityId, setResponsibilityId] = useState<string | null>(
    editingTask?.responsibility_id ?? null
  );
  const [labelIds, setLabelIds] = useState<Set<string>>(
    new Set((editingTask?.labels ?? []).map((l) => l.id))
  );
  // Inline create-new reveals — collapsed by default to keep the sheet calm.
  const [creatingResp, setCreatingResp] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceChoice>(
    editingTask?.recurrence_rule?.freq ?? "none"
  );
  const [weekDays, setWeekDays] = useState<Set<Weekday>>(
    new Set(
      editingTask?.recurrence_rule?.freq === "weekly" ? editingTask.recurrence_rule.days : []
    )
  );
  const [submitting, setSubmitting] = useState(false);

  const weeklyNeedsDays = recurrence === "weekly" && weekDays.size === 0;
  const canSubmit = !!title.trim() && !weeklyNeedsDays && !submitting;

  // Lock background scroll while the modal is open; restore the prior value in
  // the cleanup so it can't leak even if this component throws while mounted.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Clearing the date clears the time with it — a bare time has no meaning.
  useEffect(() => {
    if (!dueDate && dueTime) setDueTime("");
  }, [dueDate, dueTime]);

  // Open a native picker straight from a tap. showPicker() is the modern path
  // (and may throw without a user gesture); focus()+click() is the fallback for
  // engines that lack it. Shared by the date and time fields.
  function openNativePicker(ref: React.RefObject<HTMLInputElement | null>) {
    const el = ref.current;
    if (!el) return;
    const withPicker = el as HTMLInputElement & { showPicker?: () => void };
    if (typeof withPicker.showPicker === "function") {
      try {
        withPicker.showPicker();
        return;
      } catch {
        // fall through to focus + click
      }
    }
    el.focus();
    el.click();
  }

  function toggleLabel(id: string) {
    setLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleWeekday(day: Weekday) {
    setWeekDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function buildRecurrenceRule(): RecurrenceRule | null {
    if (recurrence === "daily") return { freq: "daily" };
    if (recurrence === "weekly") {
      const days = WEEKDAY_KEYS.filter((k) => weekDays.has(k));
      return days.length ? { freq: "weekly", days } : null;
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    // "משותף" (no specific adult chosen) means the task belongs to BOTH adults:
    // is_shared:true + assignee_id:null. A named adult means is_shared:false +
    // that id. This is the single source of the shared flag on save.
    const isShared = assigneeId === null;
    const payload = {
      title: title.trim(),
      notes,
      due_date: dueDate,
      // Only meaningful alongside a date; always null rather than "" when unset.
      due_time: dueDate && dueTime ? dueTime : null,
      assignee_id: isShared ? null : assigneeId,
      child_id: childId,
      responsibility_id: responsibilityId,
      label_ids: [...labelIds],
      recurrence_rule: buildRecurrenceRule(),
      priority: (urgent ? "high" : "normal") as TaskPriority,
      is_shared: isShared,
    };
    if (isEditing && onSave) await onSave(payload);
    else await onAdd(payload);
    setSubmitting(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "oklch(0.13 0.020 240 / 0.4)",
          zIndex: 60,
        }}
      />

      {/* Sheet — strict 3-zone flex column: header (pinned) / body (scrolls) /
          footer (pinned, clears the iOS home indicator). Height is capped with a
          dvh max-height (vh fallback) via the .atm-sheet rule. */}
      <div
        className="atm-sheet"
        style={{
          position: "fixed",
          bottom: 0,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          background: "var(--surface)",
          borderRadius: "var(--r-xl) var(--r-xl) 0 0",
          zIndex: 70,
          boxShadow: "var(--shadow-xl)",
          maxWidth: 600,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* HEADER zone — flex:0 0 auto; never shrinks, never scrolls. Surface
            background + bottom hairline so it reads as pinned when body scrolls. */}
        <div
          style={{
            flex: "0 0 auto",
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            padding: "var(--sp-3) var(--sp-5) var(--sp-4)",
          }}
        >
          {/* Handle */}
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: "var(--r-full)",
              background: "var(--border)",
              margin: "0 auto var(--sp-3)",
            }}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font)",
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              {isEditing ? "עריכת משימה" : "משימה חדשה"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: "var(--r-full)",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text-muted)",
              }}
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* The form fills the remaining height and is itself a flex column so the
            body scrolls while the footer stays pinned. */}
        <form
          onSubmit={handleSubmit}
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* BODY zone — flex:1 1 auto; the only scroll container. */}
          <div
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              overflowY: "auto",
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-3)",
              padding: "var(--sp-5)",
            }}
          >
            {/* Title */}
          <input
            autoFocus
            placeholder="שם המשימה"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ ...inputStyle, flexShrink: 0 }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--jmh-blue-60)";
              e.target.style.boxShadow = "0 0 0 3px oklch(0.54 0.14 240 / 0.12)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border-strong)";
              e.target.style.boxShadow = "none";
            }}
          />

          {/* Notes — multi-line. flexShrink:0 keeps it from being squeezed to a
              single line by the flex-column body; resize:vertical lets the user
              grow it without ever breaking the 390px width. */}
          <textarea
            placeholder="הערות (אופציונלי)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{
              ...inputStyle,
              flexShrink: 0,
              minHeight: 80,
              resize: "vertical",
              lineHeight: 1.5,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--jmh-blue-60)";
              e.target.style.boxShadow = "0 0 0 3px oklch(0.54 0.14 240 / 0.12)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border-strong)";
              e.target.style.boxShadow = "none";
            }}
          />

          {/* Due date: quick preset chips + a collapsed calendar behind an icon.
              Chips wrap (no horizontal scroll at 390px); each is a >=44px target. */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", flexShrink: 0 }}>
            <span style={fieldLabelStyle}>תאריך יעד</span>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }}>
              {datePresets.map((p) => (
                <DateChip
                  key={p.value}
                  label={p.label}
                  active={dueDate === p.value}
                  onClick={() => setDueDate(p.value)}
                />
              ))}
              <button
                type="button"
                aria-label="בחר תאריך אחר"
                onClick={() => openNativePicker(dateInputRef)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 44,
                  borderRadius: "var(--r-full)",
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: `all var(--dur-fast) var(--ease-out)`,
                }}
              >
                <Calendar size={18} strokeWidth={2} />
              </button>
            </div>
            {/* Single native date input, visually hidden but still operable so
                showPicker() (or the focus+click fallback) opens the OS calendar.
                Never display:none / visibility:hidden — both disable the picker.
                Its onChange drives the same dueDate the chips reflect. */}
            <input
              ref={dateInputRef}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="תאריך יעד"
              tabIndex={-1}
              style={{
                position: "absolute",
                opacity: 0,
                width: 1,
                height: 1,
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Optional due time. Same chip component/styling as the date row.
              Disabled (and muted) until a date is chosen. */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", flexShrink: 0 }}>
            <span style={fieldLabelStyle}>שעה</span>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }}>
              {timePresets.map((p) => (
                <DateChip
                  key={p.value}
                  label={
                    <>
                      {p.label} <TimeText value={p.value} />
                    </>
                  }
                  active={dueTime === p.value}
                  disabled={timeDisabled}
                  onClick={() => setDueTime(p.value)}
                />
              ))}
              {/* Custom time — active whenever the chosen time isn't a preset. */}
              <DateChip
                label="שעה אחרת"
                active={!!dueTime && !timePresets.some((p) => p.value === dueTime)}
                disabled={timeDisabled}
                onClick={() => openNativePicker(timeInputRef)}
              />
              {/* Clear affordance; reads as selected when no time is set. */}
              <DateChip
                label="ללא שעה"
                active={!dueTime}
                disabled={timeDisabled}
                onClick={() => setDueTime("")}
              />
            </div>

            {timeDisabled && (
              <span
                style={{
                  fontFamily: "var(--font)",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  lineHeight: 1.5,
                }}
              >
                בחרו תאריך יעד כדי לקבוע שעה.
              </span>
            )}

            {/* Visually hidden native time input, opened via showPicker(). */}
            <input
              ref={timeInputRef}
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              aria-label="שעת יעד"
              tabIndex={-1}
              disabled={timeDisabled}
              style={{
                position: "absolute",
                opacity: 0,
                width: 1,
                height: 1,
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Assignee — the empty "משותף" option means shared (both adults); a
              named option means that single adult. This drives is_shared on save. */}
          <select
            value={assigneeId ?? ""}
            onChange={(e) => setAssigneeId(e.target.value || null)}
            style={{ ...inputStyle, appearance: "none", cursor: "pointer", flexShrink: 0 }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--jmh-blue-60)";
              e.target.style.boxShadow = "0 0 0 3px oklch(0.54 0.14 240 / 0.12)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border-strong)";
              e.target.style.boxShadow = "none";
            }}
          >
            <option value="">משותף</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          {/* Urgency — maps to tasks.priority ('high' when on, else 'normal'). */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", flexShrink: 0 }}>
            <span style={fieldLabelStyle}>עדיפות</span>
            <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setUrgent((u) => !u)}
                aria-pressed={urgent}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 44,
                  padding: "0 16px",
                  borderRadius: "var(--r-full)",
                  border: `1px solid ${urgent ? "var(--jmh-coral)" : "var(--border-strong)"}`,
                  background: urgent
                    ? "color-mix(in oklch, var(--jmh-coral) 12%, var(--surface))"
                    : "var(--surface)",
                  color: urgent ? "var(--jmh-coral)" : "var(--text-secondary)",
                  fontFamily: "var(--font)",
                  fontSize: "var(--text-sm)",
                  fontWeight: urgent ? 600 : 400,
                  cursor: "pointer",
                  transition: `all var(--dur-fast) var(--ease-out)`,
                }}
              >
                דחוף
              </button>
            </div>
          </div>

          {/* Responsibility selector (single-select, optional) + inline create */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", flexShrink: 0 }}>
            <span style={fieldLabelStyle}>אחריות</span>
            <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
              <ChildPill
                label="ללא"
                active={responsibilityId === null}
                onClick={() => setResponsibilityId(null)}
              />
              {responsibilities.map((r) => (
                <ChildPill
                  key={r.id}
                  label={r.name}
                  color={r.color}
                  active={responsibilityId === r.id}
                  onClick={() => setResponsibilityId(r.id)}
                />
              ))}
              {!creatingResp && (
                <AddChip label="אחריות חדשה" onClick={() => setCreatingResp(true)} />
              )}
            </div>
            {creatingResp && (
              <InlineCreate
                placeholder="שם האחריות"
                owners={members}
                onCancel={() => setCreatingResp(false)}
                onConfirm={async (name, ownerId) => {
                  const created = await onCreateResponsibility(name, ownerId!);
                  if (!created) return false;
                  setResponsibilityId(created.id); // auto-select the new one
                  setCreatingResp(false);
                  return true;
                }}
              />
            )}
          </div>

          {/* Labels multi-select (optional) + inline create */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", flexShrink: 0 }}>
            <span style={fieldLabelStyle}>תוויות</span>
            <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
              {labels.map((l) => (
                <ChildPill
                  key={l.id}
                  label={l.name}
                  color={l.color}
                  active={labelIds.has(l.id)}
                  onClick={() => toggleLabel(l.id)}
                />
              ))}
              {!creatingLabel && (
                <AddChip label="תווית חדשה" onClick={() => setCreatingLabel(true)} />
              )}
            </div>
            {creatingLabel && (
              <InlineCreate
                placeholder="שם התווית"
                onCancel={() => setCreatingLabel(false)}
                onConfirm={async (name) => {
                  const created = await onCreateLabel(name);
                  if (!created) return false;
                  setLabelIds((prev) => new Set(prev).add(created.id)); // auto-toggle on
                  setCreatingLabel(false);
                  return true;
                }}
              />
            )}
          </div>

          {/* Child selector (optional) */}
          {childMembers.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", flexShrink: 0 }}>
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
                ילד
              </span>
              <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
                <ChildPill label="ללא" active={childId === null} onClick={() => setChildId(null)} />
                {childMembers.map((c) => (
                  <ChildPill
                    key={c.id}
                    label={c.name}
                    color={c.color}
                    active={childId === c.id}
                    onClick={() => setChildId(c.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recurrence control */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", flexShrink: 0 }}>
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
              חזרה
            </span>
            <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
              {RECURRENCE_OPTIONS.map((o) => {
                const active = recurrence === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setRecurrence(o.value)}
                    style={{
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
                    {o.label}
                  </button>
                );
              })}
            </div>

            {/* Weekly day pickers — RTL row, week starts Sunday (rightmost) */}
            {recurrence === "weekly" && (
              <div style={{ display: "flex", gap: "var(--sp-2)", marginTop: "var(--sp-1)" }}>
                {WEEKDAY_KEYS.map((day) => {
                  const active = weekDays.has(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      aria-pressed={active}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--r-full)",
                        border: `1px solid ${active ? "var(--jmh-blue)" : "var(--border-strong)"}`,
                        background: active ? "var(--jmh-blue)" : "var(--surface)",
                        color: active ? "white" : "var(--text-secondary)",
                        fontFamily: "var(--font)",
                        fontSize: "var(--text-sm)",
                        fontWeight: 600,
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: `all var(--dur-fast) var(--ease-out)`,
                      }}
                    >
                      {WEEKDAY_LETTERS[day]}
                    </button>
                  );
                })}
              </div>
            )}

            {recurrence !== "none" && (
              <span
                style={{
                  fontFamily: "var(--font)",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  lineHeight: 1.5,
                }}
              >
                התאריך למעלה הוא תאריך ההתחלה של הסדרה.
              </span>
            )}
          </div>

          </div>

          {/* FOOTER zone — flex:0 0 auto; pinned. padding-bottom clears the iOS
              home indicator via the safe-area inset. */}
          <div
            style={{
              flex: "0 0 auto",
              background: "var(--surface)",
              borderTop: "1px solid var(--border)",
              padding: "var(--sp-4) var(--sp-5)",
              paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            }}
          >
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: "100%",
                padding: "14px var(--sp-6)",
                background: canSubmit ? "var(--jmh-blue)" : "var(--jmh-blue-30)",
                color: "white",
                borderRadius: "var(--r-full)",
                border: "none",
                fontFamily: "var(--font)",
                fontWeight: 600,
                fontSize: "var(--text-base)",
                cursor: canSubmit ? "pointer" : "not-allowed",
                boxShadow: canSubmit ? "var(--shadow-sm)" : "none",
                transition: `background var(--dur-fast) var(--ease-out)`,
              }}
            >
              {submitting ? "שומר..." : isEditing ? "שמור שינויים" : "הוסף משימה"}
            </button>
          </div>
        </form>
      </div>
      <style>{SHEET_CSS}</style>
    </>
  );
}

// Dashed ghost chip that opens an inline create-new form. Visually distinct
// from the solid selectable pills so it reads as "add", not "select".
function AddChip({ label, onClick }: { label: string; onClick: () => void }) {
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
        border: "1px dashed var(--border-strong)",
        background: "transparent",
        color: "var(--text-secondary)",
        fontFamily: "var(--font)",
        fontSize: "var(--text-sm)",
        fontWeight: 500,
        cursor: "pointer",
        transition: `border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--jmh-blue-30)";
        e.currentTarget.style.color = "var(--jmh-blue)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)";
        e.currentTarget.style.color = "var(--text-secondary)";
      }}
    >
      <Plus size={14} strokeWidth={2} />
      {label}
    </button>
  );
}

// Compact inline create row. Lives INSIDE the outer task <form>, so it must not
// nest a <form>; confirm is a type="button" and Enter is handled manually so it
// never submits the task. `owners` present → show a (adults-only) owner select.
function InlineCreate({
  placeholder,
  owners,
  onConfirm,
  onCancel,
}: {
  placeholder: string;
  owners?: FamilyMember[];
  onConfirm: (name: string, ownerId: string | null) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const needsOwner = !!owners && owners.length > 0;
  const [ownerId, setOwnerId] = useState<string>(owners?.[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const canConfirm = !!name.trim() && (!needsOwner || !!ownerId) && !busy;

  async function confirm() {
    if (!canConfirm) return;
    setBusy(true);
    // On success the parent collapses this (unmount resets local state); on
    // failure we stay open so the user can retry.
    await onConfirm(name.trim(), needsOwner ? ownerId : null);
    setBusy(false);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)",
        marginTop: "var(--sp-1)",
        padding: "var(--sp-3)",
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
      }}
    >
      <input
        autoFocus
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirm();
          }
        }}
        style={inputStyle}
      />

      {needsOwner && (
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
        >
          {owners!.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}

      <div style={{ display: "flex", gap: "var(--sp-2)" }}>
        <button
          type="button"
          onClick={confirm}
          disabled={!canConfirm}
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--sp-1)",
            padding: "9px var(--sp-4)",
            background: canConfirm ? "var(--jmh-blue)" : "var(--jmh-blue-30)",
            color: "white",
            borderRadius: "var(--r-full)",
            border: "none",
            fontFamily: "var(--font)",
            fontWeight: 600,
            fontSize: "var(--text-sm)",
            cursor: canConfirm ? "pointer" : "not-allowed",
            transition: `background var(--dur-fast) var(--ease-out)`,
          }}
        >
          <Check size={15} strokeWidth={2} />
          {busy ? "שומר..." : "הוסף"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--sp-1)",
            padding: "9px var(--sp-4)",
            background: "var(--surface)",
            color: "var(--text-secondary)",
            borderRadius: "var(--r-full)",
            border: "1px solid var(--border-strong)",
            fontFamily: "var(--font)",
            fontWeight: 500,
            fontSize: "var(--text-sm)",
            cursor: "pointer",
          }}
        >
          <X size={15} strokeWidth={2} />
          ביטול
        </button>
      </div>
    </div>
  );
}

// Quick date preset chip. >=44px touch target (minHeight), pill styling that
// matches the other selectable chips, with a selected (active) state.
// A clock time such as "18:00" would otherwise be reordered by the RTL bidi
// algorithm (rendering as 00:18) when it sits next to Hebrew text. Isolating it
// as an LTR run keeps the digits in the right order.
function TimeText({ value }: { value: string }) {
  return (
    <span dir="ltr" style={{ unicodeBidi: "isolate" }}>
      {value}
    </span>
  );
}

// Shared quick-select chip for both the date and time rows. `disabled` renders
// the muted, non-interactive state used while no due date is set.
function DateChip({
  label,
  active,
  onClick,
  disabled = false,
}: {
  label: React.ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        padding: "0 16px",
        borderRadius: "var(--r-full)",
        border: `1px solid ${
          disabled ? "var(--border)" : active ? "var(--jmh-blue-30)" : "var(--border-strong)"
        }`,
        background: disabled ? "var(--bg)" : active ? "var(--jmh-blue-05)" : "var(--surface)",
        color: disabled ? "var(--text-muted)" : active ? "var(--jmh-blue)" : "var(--text-secondary)",
        fontFamily: "var(--font)",
        fontSize: "var(--text-sm)",
        fontWeight: active && !disabled ? 600 : 400,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        whiteSpace: "nowrap",
        transition: `all var(--dur-fast) var(--ease-out)`,
      }}
    >
      {label}
    </button>
  );
}

function ChildPill({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string | null;
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
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: `var(--${color})`,
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </button>
  );
}
