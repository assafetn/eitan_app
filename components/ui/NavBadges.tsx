import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/currentUser";
import { todayISO } from "@/lib/recurrence";

// One request-scoped fetch that runs BOTH nav counts in a single Promise.all,
// head-only (`count: 'exact', head: true`) so no row data is transferred. It is
// wrapped in React `cache()` so the two <NavBadge> renders below (one per icon,
// each in its own Suspense boundary) share this single execution — the queries
// run exactly once per request even though there are two badge slots.
//
// LIMITATION (accepted by design): virtual recurring occurrences that fall due
// today are NOT counted here. Expanding recurrence on the layout's hot path would
// reintroduce the navigation latency this streamed design avoids. We count only
// stored rows; lib/recurrence.ts is untouched and no occurrence rows are
// pre-generated.
export const getNavBadgeCounts = cache(async (): Promise<{ tasks: number; shopping: number }> => {
  const supabase = await createClient();

  // The current adult, resolved the same way the app already does (getMyMemberId):
  // the family member whose auth_user_id is the session user. `getSessionUser` is
  // the request-cached user the layout already fetched — no new auth round-trip.
  const user = await getSessionUser();
  let myId: string | null = null;
  if (user) {
    const { data: me } = await supabase
      .from("family_members")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    myId = me?.id ?? null;
  }

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

  const shoppingQuery = supabase
    .from("shopping_items")
    .select("id", { count: "exact", head: true })
    .eq("is_checked", false);

  const [tasksRes, shoppingRes] = await Promise.all([tasksQuery, shoppingQuery]);

  return { tasks: tasksRes.count ?? 0, shopping: shoppingRes.count ?? 0 };
});

// Async server component rendered (Suspense-wrapped) into a nav icon's corner.
// Returns null when the count is 0 so nothing renders — never a zero badge.
export async function NavBadge({ kind }: { kind: "tasks" | "shopping" }) {
  const counts = await getNavBadgeCounts();
  const count = kind === "tasks" ? counts.tasks : counts.shopping;
  if (count <= 0) return null;

  // Accessible text (not color): contributes to the nav link's accessible name
  // so the count is announced. The visual pill itself is aria-hidden.
  const srText = kind === "tasks" ? `${count} משימות דורשות תשומת לב` : `${count} פריטים בקנייה`;
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
          position: "absolute",
          top: -6,
          insetInlineStart: -6, // top-start corner (top-right in RTL)
          minWidth: 16,
          height: 16,
          paddingInline: display.length > 1 ? 4 : 0,
          boxSizing: "border-box",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--r-full)",
          background: "var(--jmh-coral)",
          color: "white",
          fontFamily: "var(--font)",
          fontSize: 11,
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
