import { createClient } from "@/lib/supabase/server";
import type { FamilyMember, OccurrenceOverride, Task } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import TasksClient from "@/app/(app)/tasks/TasksClient";

export const dynamic = "force-dynamic";

export default async function ChildTasksPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const supabase = await createClient();

  // The child's tasks depend only on childId (not on the other lookups), so they
  // join the same batch — one round-trip instead of two. Only the overrides
  // query below genuinely depends on the fetched task ids.
  const [
    { data: child },
    { data: members },
    { data: children },
    { data: tasks },
  ] = await Promise.all([
    supabase.from("family_members").select("*").eq("id", childId).eq("type", "child").single(),
    supabase.from("family_members").select("*").eq("type", "adult").order("name"),
    supabase.from("family_members").select("*").eq("type", "child").order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select(
        "*, assignee:family_members!tasks_assignee_id_fkey(*), child:family_members!tasks_child_id_fkey(*)"
      )
      .is("recurrence_parent_id", null)
      .eq("child_id", childId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);

  if (!child) notFound();

  const parentIds = ((tasks as Task[]) ?? [])
    .filter((t) => t.recurrence_rule)
    .map((t) => t.id);

  let overrides: OccurrenceOverride[] = [];
  if (parentIds.length > 0) {
    const { data } = await supabase
      .from("tasks")
      .select("id, recurrence_parent_id, due_date, status, completed_at")
      .in("recurrence_parent_id", parentIds);
    overrides = (data as OccurrenceOverride[]) ?? [];
  }

  return (
    <div>
      {/* Back to family overview */}
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          margin: "0 auto",
          padding: "var(--sp-6) var(--sp-4) 0",
        }}
      >
        <Link
          href="/family"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-1)",
            fontFamily: "var(--font)",
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
            textDecoration: "none",
          }}
        >
          <ChevronRight size={16} strokeWidth={2} />
          חזרה למשפחה
        </Link>
      </div>

      <TasksClient
        initialTasks={(tasks as Task[]) ?? []}
        initialOverrides={overrides}
        members={(members as FamilyMember[]) ?? []}
        childMembers={(children as FamilyMember[]) ?? []}
        title={(child as FamilyMember).name}
        showAddButton={false}
        openOnly
      />
    </div>
  );
}
