"use client";

// Buttons under Eitan's reply about a task.
//
// When Eitan couldn't tell, the card asks first, open and on top:
//   "למי התזכורת?"  → אסף / נטלי / שניכם           (owner_pending, migration 022)
//   "מתי להזכיר?"   → reminder options / בלי תזכורת  (no due_time, push still on)
// After that (or when nothing is missing) it shows who it's for and when the
// push goes out (migration 021), collapsed to one line on older replies.
// Each tap saves the task directly (adults may update tasks under RLS).

import { useState } from "react";
import type { FamilyMember, Task } from "@/lib/types";
import { formatWhen, jerusalemNow, addDays } from "@/lib/eitan/time";
import { effectiveLead, leadLabel, pushLabel, PUSH_LEAD_CHOICES } from "@/lib/pushChoice";

export type CardTask = Pick<
  Task,
  | "id"
  | "title"
  | "due_date"
  | "due_time"
  | "assignee_id"
  | "is_shared"
  | "owner_pending"
  | "push_enabled"
  | "push_lead_minutes"
  | "status"
  | "recurrence_rule"
>;

export type TaskPatch = Partial<
  Pick<
    Task,
    "assignee_id" | "is_shared" | "owner_pending" | "push_enabled" | "push_lead_minutes" | "due_date" | "due_time"
  >
>;

interface Props {
  task: CardTask;
  adults: FamilyMember[];
  defaultExpanded: boolean;
  onPatch: (id: string, patch: TaskPatch) => void;
}

type ReminderOption = { label: string; date: string; time: string };

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Reminder choices for a task without a time. A task dated in the future gets
 * times on its own date; otherwise: in an hour, this evening, tomorrow.
 */
function reminderOptions(task: CardTask): ReminderOption[] {
  const now = jerusalemNow();
  const tomorrow = addDays(now.date, 1);
  if (task.due_date && task.due_date > now.date) {
    return ["08:00", "12:00", "17:00", "20:00"].map((t) => ({ label: t, date: task.due_date as string, time: t }));
  }
  const out: ReminderOption[] = [];
  const inAnHour = Math.ceil((toMinutes(now.time) + 60) / 5) * 5;
  if (inAnHour < 24 * 60) out.push({ label: "בעוד שעה", date: now.date, time: toHHMM(inAnHour) });
  if (toMinutes(now.time) < toMinutes("19:30")) out.push({ label: "היום ב-20:00", date: now.date, time: "20:00" });
  out.push({ label: "מחר ב-09:00", date: tomorrow, time: "09:00" });
  out.push({ label: "מחר ב-20:00", date: tomorrow, time: "20:00" });
  return out;
}

export default function TaskControls({ task, adults, defaultExpanded, onPatch }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const today = jerusalemNow().date;

  const needsOwner = task.owner_pending;
  const needsTime = !task.due_time && task.push_enabled;
  const asking = needsOwner || needsTime;
  const open = expanded || asking;

  const owner = needsOwner
    ? "עוד לא נקבע"
    : task.is_shared
      ? "שניכם"
      : adults.find((a) => a.id === task.assignee_id)?.name ?? "—";

  const setOwner = (who: string | "both") =>
    onPatch(
      task.id,
      who === "both"
        ? { is_shared: true, assignee_id: null, owner_pending: false }
        : { is_shared: false, assignee_id: who, owner_pending: false }
    );

  const setPush = (lead: number | "off") =>
    onPatch(task.id, lead === "off" ? { push_enabled: false } : { push_enabled: true, push_lead_minutes: lead });

  const setReminder = (date: string, time: string) =>
    onPatch(task.id, { due_date: date, due_time: time, push_enabled: true });

  // "שעה אחרת": on the task's own future date, else today if still ahead, else tomorrow.
  const setOtherTime = (hhmm: string) => {
    const now = jerusalemNow();
    const date =
      task.due_date && task.due_date > now.date ? task.due_date : hhmm > now.time ? now.date : addDays(now.date, 1);
    setReminder(date, hhmm);
  };

  return (
    <div
      dir="rtl"
      style={{
        maxWidth: "82%",
        marginTop: 4,
        background: "var(--surface)",
        border: `1px solid ${asking ? "var(--jmh-blue-60)" : "var(--border)"}`,
        borderRadius: "var(--r-lg)",
        padding: "8px 10px",
        boxShadow: "var(--shadow-sm)",
        fontFamily: "var(--font)",
        color: "var(--text-primary)",
      }}
    >
      <button
        type="button"
        onClick={() => !asking && setExpanded((v) => !v)}
        aria-expanded={open}
        style={{
          all: "unset",
          display: "block",
          width: "100%",
          cursor: asking ? "default" : "pointer",
          fontSize: "var(--text-sm)",
          lineHeight: 1.4,
        }}
      >
        <span style={{ fontWeight: 600 }}>{task.title}</span>
        {(task.due_date || task.due_time) && (
          <span style={{ color: "var(--text-secondary)" }}> · {formatWhen(task.due_date, task.due_time, today)}</span>
        )}
        {!open && (
          <span style={{ display: "block", color: "var(--text-secondary)", fontSize: "var(--text-xs)", marginTop: 2 }}>
            🔔 {owner} · {pushLabel(task)} · <span style={{ color: "var(--jmh-blue)" }}>שינוי</span>
          </span>
        )}
      </button>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {needsOwner && (
            <Question title="למי התזכורת?">
              {adults.map((a) => (
                <Chip key={a.id} big active={false} onClick={() => setOwner(a.id)}>
                  {a.name}
                </Chip>
              ))}
              <Chip big active={false} onClick={() => setOwner("both")}>
                שניכם
              </Chip>
            </Question>
          )}

          {needsTime && (
            <Question title="מתי להזכיר?">
              {reminderOptions(task).map((o) => (
                <Chip key={o.label} big active={false} onClick={() => setReminder(o.date, o.time)}>
                  {o.label}
                </Chip>
              ))}
              <TimePicker onPick={setOtherTime} />
              <Chip big active={false} onClick={() => setPush("off")}>
                בלי תזכורת
              </Chip>
            </Question>
          )}

          {!needsOwner && (
            <Row label="למי">
              {adults.map((a) => (
                <Chip key={a.id} active={!task.is_shared && task.assignee_id === a.id} onClick={() => setOwner(a.id)}>
                  {a.name}
                </Chip>
              ))}
              <Chip active={task.is_shared} onClick={() => setOwner("both")}>
                שניכם
              </Chip>
            </Row>
          )}

          {!needsTime && (
            <Row label="פוש">
              {PUSH_LEAD_CHOICES.map((lead) => (
                <Chip
                  key={lead}
                  disabled={!task.due_time}
                  active={!!task.due_time && task.push_enabled && effectiveLead(task) === lead}
                  onClick={() => setPush(lead)}
                >
                  {lead === 30 ? "חצי שעה לפני" : leadLabel(lead)}
                </Chip>
              ))}
              <Chip active={!task.push_enabled} onClick={() => setPush("off")}>
                בלי פוש
              </Chip>
            </Row>
          )}

          {!task.due_time && !task.push_enabled && (
            <button
              type="button"
              onClick={() => onPatch(task.id, { push_enabled: true })}
              style={{
                all: "unset",
                cursor: "pointer",
                fontSize: "var(--text-xs)",
                color: "var(--jmh-blue)",
              }}
            >
              בכל זאת להוסיף תזכורת
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--jmh-blue)" }}>{title}</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", minWidth: 28 }}>{label}</span>
      {children}
    </div>
  );
}

function Chip({
  active,
  big,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  big?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      style={{
        fontFamily: "var(--font)",
        fontSize: big ? "var(--text-base)" : "var(--text-sm)",
        fontWeight: big ? 500 : 400,
        lineHeight: 1,
        minHeight: big ? 40 : 32,
        padding: big ? "0 16px" : "0 12px",
        borderRadius: "var(--r-full)",
        border: `1px solid ${active ? "var(--jmh-blue)" : big ? "var(--jmh-blue-60)" : "var(--border-strong)"}`,
        background: active ? "var(--jmh-blue)" : big ? "var(--jmh-blue-05)" : "transparent",
        color: active ? "var(--text-on-blue)" : "var(--text-primary)",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "default" : "pointer",
        transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
      }}
    >
      {children}
    </button>
  );
}

/** "שעה אחרת": the native time picker, saved when it closes. */
function TimePicker({ onPick }: { onPick: (hhmm: string) => void }) {
  return (
    <label
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font)",
        fontSize: "var(--text-base)",
        minHeight: 40,
        padding: "0 16px",
        borderRadius: "var(--r-full)",
        border: "1px dashed var(--jmh-blue-60)",
        color: "var(--text-secondary)",
        cursor: "pointer",
      }}
    >
      שעה אחרת
      <input
        type="time"
        aria-label="שעה אחרת"
        // Saved on blur: iOS fires change on every wheel turn of the picker.
        onBlur={(e) => {
          if (e.target.value) onPick(e.target.value.slice(0, 5));
          e.target.value = "";
        }}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", fontSize: 16 }}
      />
    </label>
  );
}
