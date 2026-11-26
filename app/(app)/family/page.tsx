import { createClient } from "@/lib/supabase/server";
import type { FamilyMember, Task } from "@/lib/types";
import { openTaskCountsByChild } from "@/lib/stats";
import ChildList from "./ChildList";
import BackLink from "@/components/ui/BackLink";

export const dynamic = "force-dynamic";

function computeAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const b = new Date(birthdate + "T00:00:00");
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export default async function FamilyPage() {
  const supabase = await createClient();

  const [{ data: children }, { data: childTasks }] = await Promise.all([
    supabase
      .from("family_members")
      .select("*")
      .eq("type", "child")
      .order("created_at", { ascending: true }),
    // Primary rows for the per-child open count (shared helper applies the
    // filters: open + child-tagged + series parent counted once).
    supabase
      .from("tasks")
      .select("child_id, status, recurrence_parent_id, recurrence_rule")
      .is("recurrence_parent_id", null),
  ]);

  const kids = (children as FamilyMember[]) ?? [];
  const counts = openTaskCountsByChild((childTasks as Task[]) ?? []);

  return (
    <div className="page">
      {/* Family is reached from Settings. */}
      <BackLink href="/settings" label="הגדרות" />
      <h1 className="page-title" style={{ margin: "var(--sp-1) 0 var(--sp-6)" }}>
        משפחה
      </h1>

      <ChildList
        items={kids.map((child) => ({ child, age: computeAge(child.birthdate), count: counts.get(child.id) ?? 0 }))}
      />
    </div>
  );
}
