import { createClient } from "@/lib/supabase/server";
import type { FamilyMember, Task } from "@/lib/types";
import { openTaskCountsByChild } from "@/lib/stats";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

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
    <div
      style={{
        width: "100%",
        maxWidth: 600,
        margin: "0 auto",
        padding: "var(--sp-6) var(--sp-4)",
        paddingTop: "var(--sp-8)",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font)",
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "var(--text-primary)",
          margin: "0 0 var(--sp-6)",
        }}
      >
        משפחה
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        {kids.map((child) => {
          const age = computeAge(child.birthdate);
          const count = counts.get(child.id) ?? 0;
          return (
            <Link
              key={child.id}
              href={`/family/${child.id}`}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-4)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                padding: "var(--sp-5)",
                boxShadow: "var(--shadow-sm)",
                textDecoration: "none",
                overflow: "hidden",
              }}
            >
              {/* Color accent stripe (token-driven) */}
              <span
                style={{
                  position: "absolute",
                  insetInlineStart: 0,
                  top: 0,
                  bottom: 0,
                  width: 4,
                  background: `var(--${child.color})`,
                }}
              />

              {/* Initial chip in the child's color */}
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--r-full)",
                  background: `var(--${child.color}-bg, var(--jmh-blue-05))`,
                  border: `1px solid var(--${child.color})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontFamily: "var(--font)",
                  fontSize: "var(--text-md)",
                  fontWeight: 700,
                  color: `var(--${child.color})`,
                }}
              >
                {child.name.slice(0, 1)}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font)",
                    fontSize: "var(--text-md)",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {child.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font)",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  {age !== null ? `גיל ${age}` : "גיל לא ידוע"}
                  {" · "}
                  {count === 1 ? "משימה אחת פתוחה" : `${count} משימות פתוחות`}
                </div>
              </div>

              <ChevronLeft size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
