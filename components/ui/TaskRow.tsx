"use client";

import type { FamilyMember, Label, Responsibility, Task, TaskStatus } from "@/lib/types";
import { formatDueDate, recurrenceLabel, todayISO } from "@/lib/recurrence";
import { getTaskPeople } from "@/lib/taskPeople";
import { Calendar, Check, Repeat, Trash2, User } from "lucide-react";

// At 390px we show at most this many label chips, then a "+N" overflow chip,
// so a heavily-labelled task never blows the row height out.
const LABEL_CAP = 2;

interface Props {
  task: Task;
  /** The household adults — used to resolve a shared task to both people. */
  adults: FamilyMember[];
  /** The occurrence/display date (YYYY-MM-DD), or null for an undated single. */
  date: string | null;
  /** Resolved status for this occurrence. */
  status: TaskStatus;
  /** Whether this row is an occurrence of a recurring series. */
  isRecurring: boolean;
  onToggle: () => void;
  /** Optional. When provided, renders a trash button that requests deletion.
   *  The list view passes it; the calendar opts out (rows are cramped there). */
  onDelete?: () => void;
  /** Tapping the row body (not the toggle/delete targets) opens edit. */
  onEdit?: () => void;
}

export default function TaskRow({ task, adults, date, status, isRecurring, onToggle, onDelete, onEdit }: Props) {
  const isDone = status === "done";
  const isUrgent = date ? date < todayISO() : false;
  // High-priority ("דחוף") signalling: a coral background tint + an explicit
  // text chip (never colour alone). Completed rows opt out entirely — the
  // dimmed done styling takes over. Independent of `isUrgent`/overdue, so an
  // overdue high-priority task keeps both its coral edge strip and this tint.
  const isHighPriority = task.priority === "high" && !isDone;

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

  // The single derived "who is on this task" concept: shared → both adults, else
  // the assignee, else nobody. One field, rendered from one User icon.
  const people = getTaskPeople(task, adults);
  const peopleNames = people.map((p) => p.name).join(" · ");
  const child = task.child ?? null;

  return (
    <div
      className="task-strip"
      onClick={onEdit}
      style={{
        "--strip-color": stripColor,
        background: isHighPriority
          ? "color-mix(in oklch, var(--jmh-coral) 8%, var(--surface))"
          : "var(--surface)",
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
      {/* Toggle circle. The visible circle stays 20px, but the button pads out to
          a 44×44 touch target and pulls back with a matching negative margin, so
          the row layout and its neighbours don't shift at 390px RTL. */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-label={isDone ? "סמן כפתוח" : "סמן כהושלם"}
        style={{
          padding: 12, // 12 + 20 circle + 12 = 44px hit area (box-sizing: border-box)
          margin: -12, // neutralises the padding so the footprint stays 20px
          background: "transparent",
          border: "none",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: `2px solid ${isDone ? "var(--jmh-sage)" : isUrgent ? "var(--jmh-coral)" : "var(--border-strong)"}`,
            background: isDone ? "var(--jmh-sage)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            transition: `background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)`,
          }}
        >
          {isDone && <Check size={10} strokeWidth={2.5} />}
        </span>
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
          // Build the metadata row (date · recurrence · person(s) · child) as an
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

          // One person field: a single User icon then the name, or both names
          // joined by " · " for a shared task. No word-prefix.
          const peopleNode = peopleNames ? (
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
              {peopleNames}
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

          // "דחוף" text chip — the required non-colour signal for a high-priority
          // open task. A distinct pill, so it sits before the dotted metadata
          // without a dot separator of its own.
          const urgentNode = isHighPriority ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "1px 8px",
                borderRadius: "var(--r-full)",
                background: "color-mix(in oklch, var(--jmh-coral) 14%, var(--surface))",
                border: "1px solid color-mix(in oklch, var(--jmh-coral) 30%, transparent)",
                fontFamily: "var(--font)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--jmh-coral)",
                flexShrink: 0,
              }}
            >
              דחוף
            </span>
          ) : null;

          const items = [dateNode, recurrenceNode, peopleNode, childNode].filter(Boolean);
          if (!urgentNode && items.length === 0) return null;

          return (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }}>
              {urgentNode}
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
          aria-label="מחיקת משימה"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            padding: 8, // 8 + 28 + 8 = 44px hit area
            margin: -8, // keep the 28px visual footprint (row layout unchanged)
            boxSizing: "content-box",
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
