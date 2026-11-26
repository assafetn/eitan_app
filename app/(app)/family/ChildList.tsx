import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { FamilyMember } from "@/lib/types";

export interface ChildListItem {
  child: FamilyMember;
  age: number | null;
  count: number;
}

// The children on the family screen, one inset group with a row per child.
// Each child's own color shows only in their initial — no side stripe.
export default function ChildList({ items }: { items: ChildListItem[] }) {
  if (items.length === 0) {
    return (
      <p style={{ fontFamily: "var(--font)", fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: 0 }}>
        עדיין אין ילדים במשפחה.
      </p>
    );
  }

  return (
    <div className="group">
      {items.map(({ child, age, count }) => (
        <Link
          key={child.id}
          href={`/family/${child.id}`}
          className="group-row group-row--tap"
          style={
            {
              ["--row-inset" as string]: "68px",
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-3)",
              minHeight: 68,
              padding: "12px 16px",
              textDecoration: "none",
            } as React.CSSProperties
          }
        >
          {/* Initial in the child's color */}
          <span
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--r-full)",
              background: `var(--${child.color}-bg, var(--jmh-blue-05))`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontFamily: "var(--font)",
              fontSize: "var(--text-md)",
              fontWeight: 600,
              color: `var(--${child.color})`,
            }}
          >
            {child.name.slice(0, 1)}
          </span>

          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span
              style={{
                fontFamily: "var(--font)",
                fontSize: "var(--text-md)",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {child.name}
            </span>
            <span style={{ fontFamily: "var(--font)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              {age !== null ? `גיל ${age}` : "גיל לא ידוע"}
              {" · "}
              {count === 0 ? "אין משימות פתוחות" : count === 1 ? "משימה אחת פתוחה" : `${count} משימות פתוחות`}
            </span>
          </span>

          <ChevronLeft size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        </Link>
      ))}
    </div>
  );
}
