import { createClient } from "@/lib/supabase/server";
import type { FamilyMember, Label, OccurrenceOverride, Responsibility, Task } from "@/lib/types";
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

  const [{ data: child }, { data: members }, { data: children }, { data: responsibilities }, { data: labels }] =
    await Promise.all([
      supabase.from("family_members").select("*").eq("id", childId).eq("type", "child").single(),
      supabase.from("family_members").select("*").eq("type", "adult").order("name"),
      supabase.from("family_members").select("*").eq("type", "child").order("created_at", { ascending: true }),
      supabase
        .from("responsibilities")
        .select("*, owner:family_members!responsibilities_owner_id_fkey(*)")
        .order("created_at", { ascending: true }),
      supabase.from("labels").select("*").order("created_at", { ascending: true }),
    ]);

  if (!child) notFound();

  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "*, assignee:family_members!tasks_assignee_id_fkey(*), child:family_members!tasks_child_id_fkey(*), responsibility:responsibilities!tasks_responsibility_id_fkey(*, owner:family_members!responsibilities_owner_id_fkey(*)), labels(*)"
    )
    .is("recurrence_parent_id", null)
    .eq("child_id", childId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

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
        responsibilities={(responsibilities as Responsibility[]) ?? []}
        labels={(labels as Label[]) ?? []}
        title={(child as FamilyMember).name}
        showAddButton={false}
        openOnly
      />
    </div>
  );
}
