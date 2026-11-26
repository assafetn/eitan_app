"use client";

// One-time question buttons under Eitan's reply, only when he couldn't fill
// something in:
//   "למי התזכורת?"  → אסף / נטלי / שניכם            (owner_pending, migration 022)
//   "מתי להזכיר?"   → reminder options / בלי תזכורת  (time_pending, migration 023)
// A tap saves the answer on the task (adults may update tasks under RLS) and
// that question disappears. With nothing left to ask, the card shows a short
// "saved" line for a moment and then renders nothing.

import { useEffect, useRef, useState } from "react";
import type { FamilyMember, Task } from "@/lib/types";
import { formatWhen, jerusalemNow, addDays } from "@/lib/eitan/time";

export type CardTask = Pick<
  Task,
  "id" | "title" | "due_date" | "due_time" | "assignee_id" | "is_shared" | "owner_pending" | "time_pending" | "status"
>;

export type TaskPatch = Partial<
  Pick<Task, "assignee_id" | "is_shared" | "owner_pending" | "time_pending" | "due_date" | "due_time">
>;

interface Props {
  task: CardTask;
  adults: FamilyMember[];
  onPatch: (id: string, patch: TaskPatch) => void;
}

type ReminderOption = { label: string; date: string; time: string };

const SAVED_VISIBLE_MS = 2500;

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Does this task still have a question for the adults? */
export function hasQuestion(task: CardTask): boolean {
  return task.status === "open" && (task.owner_pending || (task.time_pending && !task.due_time));
}

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

export default function TaskControls({ task, adults, onPatch }: Props) {
  const needsOwner = task.owner_pending;
  const needsTime = task.time_pending && !task.due_time;
  const asking = needsOwner || needsTime;

  // After the last answer on this device, show "נשמר" briefly, then nothing.
  const [saved, setSaved] = useState<string | null>(null);
  const wasAsking = useRef(asking);
  useEffect(() => {
    if (wasAsking.current && !asking) {
      const owner = task.is_shared ? "לשניכם" : `ל${adults.find((a) => a.id === task.assignee_id)?.name ?? ""}`;
      const when = task.due_time ? formatWhen(task.due_date, task.due_time, jerusalemNow().date) : "בלי תזכורת";
      setSaved(`✓ נשמר: ${owner} · ${when}`);
      const t = setTimeout(() => setSaved(null), SAVED_VISIBLE_MS);
      wasAsking.current = asking;
      return () => clearTimeout(t);
    }
    wasAsking.current = asking;
  }, [asking, task, adults]);

  if (!asking) {
    if (!saved) return null;
    return (
      <div
        role="status"
        style={{
          marginTop: 4,
          fontFamily: "var(--font)",
          fontSize: "var(--text-xs)",
          color: "var(--jmh-sage)",
        }}
      >
        {saved}
      </div>
    );
  }

  const setOwner = (who: string | "both") =>
    onPatch(
      task.id,
      who === "both"
        ? { is_shared: true, assignee_id: null, owner_pending: false }
        : { is_shared: false, assignee_id: who, owner_pending: false }
    );

  const setReminder = (date: string, time: string) =>
    onPatch(task.id, { due_date: date, due_time: time, time_pending: false });

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
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: "var(--surface)",
        border: "1px solid var(--jmh-blue-60)",
        borderRadius: "var(--r-lg)",
        padding: "10px 12px",
        boxShadow: "var(--shadow-sm)",
        fontFamily: "var(--font)",
        color: "var(--text-primary)",
      }}
    >
      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{task.title}</span>

      {needsOwner && (
        <Question title="למי התזכורת?">
          {adults.map((a) => (
            <Chip key={a.id} onClick={() => setOwner(a.id)}>
              {a.name}
            </Chip>
          ))}
          <Chip onClick={() => setOwner("both")}>שניכם</Chip>
        </Question>
      )}

      {needsTime && (
        <Question title="מתי להזכיר?">
          {reminderOptions(task).map((o) => (
            <Chip key={o.label} onClick={() => setReminder(o.date, o.time)}>
              {o.label}
            </Chip>
          ))}
          <TimePicker onPick={setOtherTime} />
          <Chip quiet onClick={() => onPatch(task.id, { time_pending: false })}>
            בלי תזכורת
          </Chip>
        </Question>
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

function Chip({ quiet, onClick, children }: { quiet?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: "var(--font)",
        fontSize: "var(--text-base)",
        fontWeight: 500,
        lineHeight: 1,
        minHeight: 40,
        padding: "0 16px",
        borderRadius: "var(--r-full)",
        border: `1px solid ${quiet ? "var(--border-strong)" : "var(--jmh-blue-60)"}`,
        background: quiet ? "transparent" : "var(--jmh-blue-05)",
        color: quiet ? "var(--text-secondary)" : "var(--text-primary)",
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease-out)",
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
        fontWeight: 500,
        minHeight: 40,
        padding: "0 16px",
        borderRadius: "var(--r-full)",
        border: "1px dashed var(--jmh-blue-60)",
        color: "var(--text-primary)",
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
