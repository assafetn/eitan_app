"use client";

import { useState } from "react";
import type { FamilyMember, Label, RecurrenceRule, Responsibility, Task, Weekday } from "@/lib/types";
import { WEEKDAY_KEYS, WEEKDAY_LETTERS } from "@/lib/recurrence";
import { Check, Plus, X } from "lucide-react";

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
    assignee_id: string | null;
    child_id: string | null;
    responsibility_id: string | null;
    label_ids: string[];
    recurrence_rule: RecurrenceRule | null;
  }) => Promise<void>;
  /** Save edits to an existing task. Same payload shape as onAdd (priority and
   *  due_time are preserved by the parent, not edited here). */
  onSave?: (data: {
    title: string;
    notes: string;
    due_date: string;
    assignee_id: string | null;
    child_id: string | null;
    responsibility_id: string | null;
    label_ids: string[];
    recurrence_rule: RecurrenceRule | null;
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
    const payload = {
      title: title.trim(),
      notes,
      due_date: dueDate,
      assignee_id: assigneeId,
      child_id: childId,
      responsibility_id: responsibilityId,
      label_ids: [...labelIds],
      recurrence_rule: buildRecurrenceRule(),
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

      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          background: "var(--surface)",
          borderRadius: "var(--r-xl) var(--r-xl) 0 0",
          padding: "var(--sp-5) var(--sp-5) calc(var(--sp-8) + env(safe-area-inset-bottom, 0px))",
          zIndex: 70,
          boxShadow: "var(--shadow-xl)",
          maxWidth: 600,
          margin: "0 auto",
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: "var(--r-full)",
            background: "var(--border)",
            margin: "0 auto var(--sp-4)",
          }}
        />

        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--sp-5)",
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
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
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
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {/* Title */}
          <input
            autoFocus
            placeholder="שם המשימה"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={inputStyle}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--jmh-blue-60)";
              e.target.style.boxShadow = "0 0 0 3px oklch(0.54 0.14 240 / 0.12)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border-strong)";
              e.target.style.boxShadow = "none";
            }}
          />

          {/* Notes */}
          <textarea
            placeholder="הערות (אופציונלי)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{
              ...inputStyle,
              resize: "none",
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

          {/* Due date + assignee row */}
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--jmh-blue-60)";
                e.target.style.boxShadow = "0 0 0 3px oklch(0.54 0.14 240 / 0.12)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border-strong)";
                e.target.style.boxShadow = "none";
              }}
            />

            <select
              value={assigneeId ?? ""}
              onChange={(e) => setAssigneeId(e.target.value || null)}
              style={{ ...inputStyle, flex: 1, appearance: "none", cursor: "pointer" }}
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
          </div>

          {/* Responsibility selector (single-select, optional) + inline create */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
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

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              marginTop: "var(--sp-2)",
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
        </form>
      </div>
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
