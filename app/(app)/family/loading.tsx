import { SkelBar, SkelCircle, SkelPageShell } from "@/components/ui/Skeleton";

// Matches FamilyPage: title + a list of child cards (color chip + name/age +
// chevron).
export default function FamilyLoading() {
  return (
    <SkelPageShell>
      <div style={{ marginBottom: "var(--sp-6)" }}>
        <SkelBar w="30%" h={28} radius="var(--r-md)" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-4)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: "var(--sp-5)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <SkelCircle size={44} />
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
              <SkelBar w="40%" h={14} />
              <SkelBar w="60%" h={11} />
            </span>
            <SkelBar w={18} h={18} radius="var(--r-sm)" />
          </div>
        ))}
      </div>
    </SkelPageShell>
  );
}
