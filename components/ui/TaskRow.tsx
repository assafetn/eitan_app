"use client";

import type { Label, Responsibility, Task, TaskStatus } from "@/lib/types";
import { recurrenceLabel, todayISO } from "@/lib/recurrence";
import { Calendar, Check, Repeat, Trash2, User } from "lucide-react";

// At 390px we show at most this many label chips, then a "+N" overflow chip,
// so a heavily-labelled task never blows the row height out.
const LABEL_CAP = 2;

interface Props {
  task: Task;
  /** The occurrence/display date (YYYY-MM-DD), or null for an undated single. */
  date: string | null;
  /** Resolved status for this occurrence. */
  status: TaskStatus;
  /** Whether this row is an occurrence of a recurring series. */
  isRecurring: boolean;
  onToggle: () => void;
  /** Present only for recurring rows — deletes the whole series. */
  onDelete?: () => void;
  /** Tapping the row body (not the toggle/delete targets) opens edit. */
  onEdit?: () => void;
}

// Israeli DD/MM, dropping the year when it's the current year; a due_time
// (HH:MM, 24h) is appended when present.
function formatDueDate(iso: string, time: string | null): string {
  const [y, m, d] = iso.split("-");
  let out = `${d}/${m}`;
  if (y !== String(new Date().getFullYear())) out += `/${y}`;
  if (time) out += ` ${time.slice(0, 5)}`;
  return out;
}

export default function TaskRow({ task, date, status, isRecurring, onToggle, onDelete, onEdit }: Props) {
  const isDone = status === "done";
  const isUrgent = date ? date < todayISO() : false;

  const responsibility = task.responsibility ?? null;
  const labels = task.labels ?? [];
  const hasBadges = !!responsibility || labels.length > 0;

  const stripColor = isDone
    ? "var(--jmh-sage)"
    : isUrgent
    ? "var(--jmh-coral)"
    : task.priority === "high"
    ? "var(--jmh-gold)"
    : "var(--border-strong)";

  // "Owner" = the adult who owns this task's responsibility (not the assignee).
  // Nothing shown when the task has no responsibility.
  const ownerName = responsibility?.owner?.name ?? null;
  const child = task.child ?? null;

  return (
    <div
      className="task-strip"
      onClick={onEdit}
      style={{
        "--strip-color": stripColor,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "12px 14px 12px 17px",
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        boxShadow: "var(--shadow-sm)",
        cursor: "pointer",
        transition: `box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)`,
        opacity: isDone ? 0.6 : 1,
      } as React.CSSProperties}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Toggle circle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-label={isDone ? "סמן כפתוח" : "סמן כהושלם"}
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: `2px solid ${isDone ? "var(--jmh-sage)" : isUrgent ? "var(--jmh-coral)" : "var(--border-strong)"}`,
          background: isDone ? "var(--jmh-sage)" : "transparent",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "white",
          padding: 0,
          transition: `background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)`,
        }}
      >
        {isDone && <Check size={10} strokeWidth={2.5} />}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-1)", minWidth: 0 }}>
          {isRecurring && (
            <Repeat
              size={12}
              strokeWidth={2}
              style={{ color: "var(--jmh-blue)", flexShrink: 0 }}
              aria-label="משימה חוזרת"
            />
          )}
          <span
            style={{
              fontFamily: "var(--font)",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              color: isDone ? "var(--text-muted)" : "var(--text-primary)",
              textDecoration: isDone ? "line-through" : "none",
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {task.title}
          </span>
        </div>

        {(() => {
          // Build the metadata row (date · recurrence · owner · child) as an
          // ordered list so dot separators only appear between present items.
          const dateNode = date ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "var(--font)",
                fontSize: 11,
                fontWeight: isUrgent && !isDone ? 500 : 400,
                color: isUrgent && !isDone ? "var(--jmh-coral)" : "var(--text-muted)",
              }}
            >
              <Calendar size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
              {formatDueDate(date, task.due_time)}
            </span>
          ) : null;

          const recurrenceNode =
            isRecurring && task.recurrence_rule ? (
              <span style={{ fontFamily: "var(--font)", fontSize: 11, color: "var(--text-muted)" }}>
                {recurrenceLabel(task.recurrence_rule)}
              </span>
            ) : null;

          const ownerNode = ownerName ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "var(--font)",
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              <User size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
              {ownerName}
            </span>
          ) : null;

          const childNode = child ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--sp-1)",
                fontFamily: "var(--font)",
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: `var(--${child.color})`,
                  flexShrink: 0,
                }}
              />
              {child.name}
            </span>
          ) : null;

          const items = [dateNode, recurrenceNode, ownerNode, childNode].filter(Boolean);
          if (items.length === 0) return null;

          return (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }}>
              {items.map((node, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)" }}>
                  {i > 0 && <span style={{ color: "var(--border-strong)", fontSize: 11 }}>·</span>}
                  {node}
                </span>
              ))}
            </div>
          );
        })()}

        {/* Responsibility badge + label chips (7.3). Only rendered when present
            — a task with neither looks exactly as it did before. */}
        {hasBadges && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-1)",
              flexWrap: "wrap",
              marginTop: 3,
            }}
          >
            {responsibility && <ResponsibilityBadge responsibility={responsibility} />}
            {labels.slice(0, LABEL_CAP).map((l) => (
              <LabelChip key={l.id} label={l} />
            ))}
            {labels.length > LABEL_CAP && <MoreChip count={labels.length - LABEL_CAP} />}
          </div>
        )}
      </div>

      {/* Right cluster: optional series delete */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="מחק סדרה"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: "var(--r-sm)",
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            flexShrink: 0,
            transition: `background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--jmh-coral-bg)";
            e.currentTarget.style.color = "var(--jmh-coral)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

// Compact responsibility badge: color dot + name. Color may be null → fall back
// to a neutral token rather than crashing on `var(--null)`.
function ResponsibilityBadge({ responsibility }: { responsibility: Responsibility }) {
  const dotColor = responsibility.color ? `var(--${responsibility.color})` : "var(--border-strong)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--sp-1)",
        maxWidth: 150,
        padding: "2px 8px",
        borderRadius: "var(--r-full)",
        background: "var(--bg)",
        border: "1px solid var(--border)",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
      <span
        style={{
          fontFamily: "var(--font)",
          fontSize: 11,
          fontWeight: 500,
          color: "var(--text-secondary)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {responsibility.name}
      </span>
    </span>
  );
}

// Lighter than the responsibility badge — labels are secondary metadata.
function LabelChip({ label }: { label: Label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        maxWidth: 110,
        padding: "2px 7px",
        borderRadius: "var(--r-sm)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {label.color && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: `var(--${label.color})`, flexShrink: 0 }} />
      )}
      <span
        style={{
          fontFamily: "var(--font)",
          fontSize: 10,
          color: "var(--text-muted)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label.name}
      </span>
    </span>
  );
}

function MoreChip({ count }: { count: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: "var(--r-sm)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        fontFamily: "var(--font)",
        fontSize: 10,
        color: "var(--text-muted)",
        flexShrink: 0,
      }}
    >
      ‎+{count}
    </span>
  );
}
