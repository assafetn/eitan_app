import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionMember } from "@/lib/currentUser";
import { todayISO } from "@/lib/recurrence";

// One request-scoped head-only count (`count: 'exact', head: true`) so no row
// data is transferred. It is wrapped in React `cache()` so the <NavBadge>
// render below (in its own Suspense boundary) shares this single execution —
// the query runs exactly once per request.
//
// LIMITATION (accepted by design): virtual recurring occurrences that fall due
// today are NOT counted here. Expanding recurrence on the layout's hot path would
// reintroduce the navigation latency this streamed design avoids. We count only
// stored rows; lib/recurrence.ts is untouched and no occurrence rows are
// pre-generated.
export const getNavBadgeCounts = cache(async (): Promise<{ tasks: number }> => {
  const supabase = await createClient();

  // The current family member. getSessionMember is request-cached and the
  // chat/tasks pages fetch it too, so this shares their single lookup instead
  // of running its own query before the count.
  const me = await getSessionMember();
  const myId: string | null = me?.id ?? null;

  const today = todayISO();

  // TASKS: open primary rows that are (high priority AND mine) OR due today.
  // A single head count with an `.or()` filter — COUNT tallies each row once, so
  // a task matching both branches is deduplicated inherently. Restricted to
  // primary rows (recurrence_parent_id null) so per-occurrence override rows
  // aren't counted as tasks.
  let tasksQuery = supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .is("recurrence_parent_id", null);
  tasksQuery = myId
    ? tasksQuery.or(`and(priority.eq.high,assignee_id.eq.${myId}),due_date.eq.${today}`)
    : tasksQuery.eq("due_date", today);

  const tasksRes = await tasksQuery;

  return { tasks: tasksRes.count ?? 0 };
});

// Async server component rendered (Suspense-wrapped) next to a tab's label
// (inline), or into an icon's corner. Returns null when the count is 0 so
// nothing renders — never a zero badge.
export async function NavBadge({ kind, inline = false }: { kind: "tasks"; inline?: boolean }) {
  const counts = await getNavBadgeCounts();
  const count = counts[kind];
  if (count <= 0) return null;

  // Accessible text (not color): contributes to the nav link's accessible name
  // so the count is announced. The visual pill itself is aria-hidden.
  const srText = `${count} משימות דורשות תשומת לב`;
  const display = count > 99 ? "99+" : String(count);

  return (
    <>
      <span
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {srText}
      </span>
      <span
        aria-hidden="true"
        style={{
          ...(inline
            ? { position: "static" as const }
            : { position: "absolute" as const, top: -6, insetInlineStart: -6 }), // top-start corner (top-right in RTL)
          minWidth: 18,
          height: 18,
          paddingInline: display.length > 1 ? 5 : 0,
          boxSizing: "border-box",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--r-full)",
          background: "var(--jmh-coral)",
          color: "var(--text-on-blue)",
          fontFamily: "var(--font)",
          fontSize: "var(--text-xs)", // the 12px floor
          fontWeight: 600,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          pointerEvents: "none",
        }}
      >
        {display}
      </span>
    </>
  );
}
