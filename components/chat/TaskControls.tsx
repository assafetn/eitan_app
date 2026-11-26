"use client";

// Buttons under Eitan's confirmation of a task: who it's for, whether and
// when its push goes out, and a time when it has none. Each tap saves the
// task directly (adults may update tasks under RLS); the reminder cron reads
// push_enabled / push_lead_minutes (migration 021).

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
  | "push_enabled"
  | "push_lead_minutes"
  | "status"
  | "recurrence_rule"
>;

export type TaskPatch = Partial<
  Pick<Task, "assignee_id" | "is_shared" | "push_enabled" | "push_lead_minutes" | "due_date" | "due_time">
>;

const QUICK_TIMES = ["08:00", "12:00", "17:00", "20:00"];

interface Props {
  task: CardTask;
  adults: FamilyMember[];
  defaultExpanded: boolean;
  onPatch: (id: string, patch: TaskPatch) => void;
}

export default function TaskControls({ task, adults, defaultExpanded, onPatch }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const today = jerusalemNow().date;
  const owner = task.is_shared ? "שניכם" : adults.find((a) => a.id === task.assignee_id)?.name ?? "—";
  const hasTime = !!task.due_time;

  const setOwner = (who: string | "both") =>
    onPatch(task.id, who === "both" ? { is_shared: true, assignee_id: null } : { is_shared: false, assignee_id: who });

  const setPush = (lead: number | "off") =>
    onPatch(task.id, lead === "off" ? { push_enabled: false } : { push_enabled: true, push_lead_minutes: lead });

  // A time on an undated task: today if it's still ahead, otherwise tomorrow.
  const setTime = (hhmm: string) => {
    const patch: TaskPatch = { due_time: hhmm };
    if (!task.due_date) {
      const now = jerusalemNow();
      patch.due_date = hhmm > now.time ? now.date : addDays(now.date, 1);
    }
    onPatch(task.id, patch);
  };

  const summary = `${owner} · ${pushLabel(task)}`;

  return (
    <div
      dir="rtl"
      style={{
        maxWidth: "82%",
        marginTop: 4,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "8px 10px",
        boxShadow: "var(--shadow-sm)",
        fontFamily: "var(--font)",
        color: "var(--text-primary)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          all: "unset",
          display: "block",
          width: "100%",
          cursor: "pointer",
          fontSize: "var(--text-sm)",
          lineHeight: 1.4,
        }}
      >
        <span style={{ fontWeight: 600 }}>{task.title}</span>
        <span style={{ color: "var(--text-secondary)" }}> · {formatWhen(task.due_date, task.due_time, today)}</span>
        {!expanded && (
          <span style={{ display: "block", color: "var(--text-secondary)", fontSize: "var(--text-xs)", marginTop: 2 }}>
            🔔 {summary} · <span style={{ color: "var(--jmh-blue)" }}>שינוי</span>
          </span>
        )}
      </button>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
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

          {!hasTime && (
            <Row label="שעה">
              {QUICK_TIMES.map((t) => (
                <Chip key={t} active={false} onClick={() => setTime(t)}>
                  {t}
                </Chip>
              ))}
              <TimePicker onPick={setTime} />
            </Row>
          )}

          <Row label="פוש">
            {PUSH_LEAD_CHOICES.map((lead) => (
              <Chip
                key={lead}
                disabled={!hasTime}
                active={hasTime && task.push_enabled && effectiveLead(task) === lead}
                onClick={() => setPush(lead)}
              >
                {lead === 30 ? "חצי שעה לפני" : leadLabel(lead)}
              </Chip>
            ))}
            <Chip active={!task.push_enabled} onClick={() => setPush("off")}>
              בלי פוש
            </Chip>
          </Row>
          {!hasTime && task.push_enabled && (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              בלי שעה אין פוש, רק ברשימת הבוקר של 07:30. בחרו שעה למעלה.
            </span>
          )}
        </div>
      )}
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
  disabled,
  onClick,
  children,
}: {
  active: boolean;
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
        fontSize: "var(--text-sm)",
        lineHeight: 1,
        minHeight: 32,
        padding: "0 12px",
        borderRadius: "var(--r-full)",
        border: `1px solid ${active ? "var(--jmh-blue)" : "var(--border-strong)"}`,
        background: active ? "var(--jmh-blue)" : "transparent",
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

/** "שעה אחרת": the native time picker, saved when a value is chosen. */
function TimePicker({ onPick }: { onPick: (hhmm: string) => void }) {
  return (
    <label
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        fontSize: "var(--text-sm)",
        minHeight: 32,
        padding: "0 12px",
        borderRadius: "var(--r-full)",
        border: "1px dashed var(--border-strong)",
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
