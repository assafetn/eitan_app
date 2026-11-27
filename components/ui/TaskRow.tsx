"use client";

import type { FamilyMember, Task, TaskStatus } from "@/lib/types";
import { formatDueDate, recurrenceLabel, todayISO } from "@/lib/recurrence";
import { getTaskPeople } from "@/lib/taskPeople";
import { Calendar, Check, Repeat, User } from "lucide-react";
import { taskEmoji } from "@/lib/emoji";

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
  /** Tapping the row body (not the toggle/delete targets) opens edit. */
  onEdit?: () => void;
  /** Multi-select mode: the whole row toggles selection, and a checkbox
   *  replaces the completion circle (so a tap can't complete by accident). */
  selectMode?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

export default function TaskRow({
  task,
  adults,
  date,
  status,
  isRecurring,
  onToggle,
  onEdit,
  selectMode = false,
  selected = false,
  onSelect,
}: Props) {
  const isDone = status === "done";
  const isUrgent = date ? date < todayISO() : false;
  // High-priority ("דחוף") signalling: a coral background tint + an explicit
  // text chip (never colour alone). Completed rows opt out entirely — the
  // dimmed done styling takes over. Overdue is signalled separately (coral
  // date + circle, and the list's "באיחור" group) — no side stripe.
  const isHighPriority = task.priority === "high" && !isDone;

  // The single derived "who is on this task" concept: shared → both adults, else
  // the assignee, else nobody. One field, rendered from one User icon.
  const people = getTaskPeople(task, adults);
  const peopleNames = people.map((p) => p.name).join(" · ");
  const child = task.child ?? null;

  return (
    <div
      // A row inside the section's inset group (globals.css .group-row): the
      // hairline above it starts at the title (--row-inset), and press/hover
      // feedback is a quiet fill.
      className={onEdit || selectMode ? "group-row group-row--tap" : "group-row"}
      onClick={selectMode ? onSelect : onEdit}
      {...(selectMode
        ? {
            role: "checkbox",
            "aria-checked": selected,
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onSelect?.();
              }
            },
          }
        : {})}
      style={{
        // Opaque even when tinted: the swipe's delete action sits underneath.
        ["--row-bg" as string]: selectMode && selected
          ? "var(--jmh-blue-05)"
          : isHighPriority
          ? "color-mix(in oklch, var(--jmh-coral) 6%, var(--surface))"
          : "var(--surface)",
        ["--row-inset" as string]: "50px",
        minHeight: 56,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      } as React.CSSProperties}
    >
      {selectMode ? (
        // Selection checkbox: a rounded square (not the round completion
        // circle) in the same 22px footprint, so rows don't shift. The row
        // itself is the 56px-tall target.
        <span
          aria-hidden="true"
          style={{
            width: 22,
            height: 22,
            flexShrink: 0,
            borderRadius: "var(--r-sm)",
            border: `1.5px solid ${selected ? "var(--jmh-blue)" : "var(--border-strong)"}`,
            background: selected ? "var(--jmh-blue)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-on-blue)",
            transition: `background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)`,
          }}
        >
          {selected && <Check size={14} strokeWidth={2.8} />}
        </span>
      ) : (
      // Toggle circle. The visible circle stays 20px, but the button pads out to
      // a 44×44 touch target and pulls back with a matching negative margin, so
      // the row layout and its neighbours don't shift at 390px RTL.
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-label={isDone ? "סימון כפתוחה" : "סימון כהושלמה"}
        style={{
          padding: 11, // 11 + 22 circle + 11 = 44px hit area (box-sizing: border-box)
          margin: -11, // neutralises the padding so the footprint stays 22px
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
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: `1.5px solid ${isDone ? "var(--jmh-sage)" : isUrgent ? "var(--jmh-coral)" : "var(--border-strong)"}`,
            background: isDone ? "var(--jmh-sage)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-on-blue)",
            transition: `background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)`,
          }}
        >
          {isDone && <Check size={13} strokeWidth={2.6} />}
        </span>
      </button>
      )}

      {/* Content — dimmed (not the whole row) when done, so the tinted
          background stays opaque over the swipe action. */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3, opacity: isDone ? 0.7 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-1)", minWidth: 0 }}>
          {/* What kind of task this is (lib/emoji.ts) — Eitan's pick, or a
              guess from the title. Decorative: the title says it in words. */}
          <span aria-hidden="true" style={{ fontSize: "var(--text-base)", lineHeight: 1, flexShrink: 0, marginInlineEnd: 2 }}>
            {taskEmoji(task)}
          </span>
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
              fontSize: "var(--text-base)", // the row's anchor — readable at a glance
              fontWeight: 500,
              color: isDone ? "var(--text-muted)" : "var(--text-primary)",
              textDecoration: isDone ? "line-through" : "none",
              textDecorationColor: "var(--border-strong)",
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
                fontSize: "var(--text-xs)",
                fontWeight: isUrgent && !isDone ? 500 : 400,
                color: isUrgent && !isDone ? "var(--jmh-coral)" : "var(--text-muted)",
              }}
            >
              <Calendar size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
              {/* Relative to the viewer's "today", which can differ from the
                  server's clock around midnight. */}
              <span suppressHydrationWarning>{formatDueDate(date, task.due_time)}</span>
            </span>
          ) : null;

          const recurrenceNode =
            isRecurring && task.recurrence_rule ? (
              <span style={{ fontFamily: "var(--font)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
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
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
              }}
            >
              <User size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
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
                fontSize: "var(--text-xs)",
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
                fontSize: "var(--text-xs)",
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
                  {i > 0 && <span style={{ color: "var(--border-strong)", fontSize: "var(--text-xs)" }}>·</span>}
                  {node}
                </span>
              ))}
            </div>
          );
        })()}

      </div>

    </div>
  );
}
