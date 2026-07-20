"use client";

import { useMemo, useState } from "react";
import type { FamilyMember, OccurrenceOverride, Task } from "@/lib/types";
import {
  addDaysISO,
  resolveOccurrencesInRange,
  todayISO,
  weekdayIndexISO,
  WEEKDAY_KEYS,
  WEEKDAY_LETTERS,
  type ResolvedOccurrence,
} from "@/lib/recurrence";
import TaskRow from "@/components/ui/TaskRow";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface Props {
  /** Shared with the list view — ONE data source, no second fetch. */
  tasks: Task[];
  overrides: OccurrenceOverride[];
  /** The household adults — passed through to each TaskRow's person field. */
  adults: FamilyMember[];
  /** The 7.3 אחריות/owner filter predicate, shared with the list view. */
  filterTask: (t: Task) => boolean;
  /** The SAME override-writing toggle the list uses — updates shared state, so
   *  the change reflects in both views. */
  onToggle: (occ: ResolvedOccurrence) => void;
  /** Tapping a row in the day sheet opens edit (series parent for recurring). */
  onEdit?: (occ: ResolvedOccurrence) => void;
}

const GRID_CELLS = 42; // 6 rows × 7 columns

function dotColor(occ: ResolvedOccurrence): string {
  const token = occ.task.child?.color ?? occ.task.assignee?.color ?? "jmh-blue";
  return `var(--${token})`;
}

export default function CalendarView({ tasks, overrides, adults, filterTask, onToggle, onEdit }: Props) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0–11
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = todayISO();

  // Expand occurrences ONCE per visible month grid range (memoized). Same
  // resolver as the list, just a different window; then narrowed by the shared
  // filter so the grid dots / day sheet obey the active אחריות/owner cut.
  const { cells, occByDate } = useMemo(() => {
    const firstOfMonth = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
    const lead = weekdayIndexISO(firstOfMonth); // Sunday = 0
    const gridStart = addDaysISO(firstOfMonth, -lead);
    const cellDates = Array.from({ length: GRID_CELLS }, (_, i) => addDaysISO(gridStart, i));

    const resolved = resolveOccurrencesInRange(
      tasks,
      overrides,
      cellDates[0],
      cellDates[GRID_CELLS - 1]
    ).filter((occ) => filterTask(occ.task));

    const map = new Map<string, ResolvedOccurrence[]>();
    for (const occ of resolved) {
      if (!occ.date) continue;
      const list = map.get(occ.date) ?? [];
      list.push(occ);
      map.set(occ.date, list);
    }
    return { cells: cellDates, occByDate: map };
  }, [tasks, overrides, viewYear, viewMonth, filterTask]);

  const monthTitle = new Date(viewYear, viewMonth, 1).toLocaleDateString("he-IL", {
    month: "long",
    year: "numeric",
  });

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function goToday() {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
  }

  const detailOccurrences = selectedDate ? (occByDate.get(selectedDate) ?? []) : [];

  return (
    <div>
      {/* Header: prev / title / next + today */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--sp-5)",
          gap: "var(--sp-2)",
        }}
      >
        {/* prev (back in time → points right in RTL) */}
        <NavButton ariaLabel="חודש קודם" onClick={() => shiftMonth(-1)}>
          <ChevronRight size={18} strokeWidth={2} />
        </NavButton>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1 }}>
          <h2
            style={{
              fontFamily: "var(--font)",
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            {monthTitle}
          </h2>
          <button
            onClick={goToday}
            style={{
              fontFamily: "var(--font)",
              fontSize: "var(--text-xs)",
              fontWeight: 500,
              color: "var(--jmh-blue)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            היום
          </button>
        </div>

        {/* next (forward in time → points left in RTL) */}
        <NavButton ariaLabel="חודש הבא" onClick={() => shiftMonth(1)}>
          <ChevronLeft size={18} strokeWidth={2} />
        </NavButton>
      </div>

      {/* Weekday headers — Sunday rightmost in RTL */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "var(--sp-1)", marginBottom: "var(--sp-2)" }}>
        {WEEKDAY_KEYS.map((k) => (
          <div
            key={k}
            style={{
              textAlign: "center",
              fontFamily: "var(--font)",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              color: "var(--text-muted)",
            }}
          >
            {WEEKDAY_LETTERS[k]}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "var(--sp-1)" }}>
        {cells.map((date) => {
          const inMonth = date.slice(0, 7) === `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
          const isToday = date === today;
          const dayOccs = occByDate.get(date) ?? [];
          const dayNum = Number(date.slice(8, 10));

          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              style={{
                aspectRatio: "1 / 1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 3,
                padding: "6px 2px",
                background: isToday ? "var(--jmh-blue-05)" : "var(--surface)",
                border: `1px solid ${isToday ? "var(--jmh-blue-30)" : "var(--border)"}`,
                borderRadius: "var(--r-md)",
                cursor: "pointer",
                opacity: inMonth ? 1 : 0.4,
                transition: `background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)`,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font)",
                  fontSize: "var(--text-sm)",
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? "var(--jmh-blue)" : "var(--text-primary)",
                  lineHeight: 1.1,
                }}
              >
                {dayNum}
              </span>

              {/* up to 3 colored dots (assignee/child token); done = dimmed */}
              {dayOccs.length > 0 && (
                <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                  {dayOccs.slice(0, 3).map((occ) => (
                    <span
                      key={occ.key}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: dotColor(occ),
                        opacity: occ.status === "done" ? 0.3 : 1,
                      }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <DayDetailSheet
          date={selectedDate}
          occurrences={detailOccurrences}
          adults={adults}
          onClose={() => setSelectedDate(null)}
          onToggle={onToggle}
          onEdit={onEdit}
        />
      )}
    </div>
  );
}

function NavButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: 36,
        height: 36,
        borderRadius: "var(--r-full)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "var(--text-secondary)",
        flexShrink: 0,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {children}
    </button>
  );
}

function DayDetailSheet({
  date,
  occurrences,
  adults,
  onClose,
  onToggle,
  onEdit,
}: {
  date: string;
  occurrences: ResolvedOccurrence[];
  adults: FamilyMember[];
  onClose: () => void;
  onToggle: (occ: ResolvedOccurrence) => void;
  onEdit?: (occ: ResolvedOccurrence) => void;
}) {
  const heading = new Date(date + "T00:00:00").toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const sorted = [...occurrences].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return a.task.title.localeCompare(b.task.title, "he");
  });

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "oklch(0.13 0.020 240 / 0.4)", zIndex: 60 }}
      />
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
          maxHeight: "75dvh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: "var(--r-full)",
            background: "var(--border)",
            margin: "0 auto var(--sp-4)",
          }}
        />

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
            {heading}
          </h2>
          <button
            onClick={onClose}
            aria-label="סגור"
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

        {sorted.length === 0 ? (
          <p
            style={{
              fontFamily: "var(--font)",
              fontSize: "var(--text-base)",
              color: "var(--text-muted)",
              textAlign: "center",
              padding: "var(--sp-8) var(--sp-4)",
              margin: 0,
            }}
          >
            אין משימות ביום זה
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {sorted.map((occ) => (
              <TaskRow
                key={occ.key}
                task={occ.task}
                adults={adults}
                date={occ.date}
                status={occ.status}
                isRecurring={occ.isRecurring}
                onToggle={() => onToggle(occ)}
                onEdit={onEdit ? () => onEdit(occ) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
