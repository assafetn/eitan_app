import { SkelBar, SkelCircle, SkelList, SkelPageShell } from "@/components/ui/Skeleton";

// Matches HomeClient: greeting header + settings gear, a summary card, then the
// "today / upcoming" task list.
export default function HomeLoading() {
  return (
    <SkelPageShell>
      {/* Header: app name / greeting / date, with a gear on the trailing edge */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--sp-3)",
          marginBottom: "var(--sp-8)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", flex: 1, minWidth: 0 }}>
          <SkelBar w="30%" h={12} />
          <SkelBar w="60%" h={28} radius="var(--r-md)" />
          <SkelBar w="45%" h={12} />
        </div>
        <SkelCircle size={40} />
      </div>

      {/* Summary card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-sm)",
          padding: "var(--sp-5)",
          marginBottom: "var(--sp-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-4)",
        }}
      >
        <SkelBar w="70%" h={16} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <SkelBar w="25%" h={10} />
          <SkelBar w="90%" h={12} />
          <SkelBar w="80%" h={12} />
        </div>
      </div>

      {/* Section label + task rows */}
      <div style={{ marginBottom: "var(--sp-2)" }}>
        <SkelBar w="20%" h={10} />
      </div>
      <SkelList count={4} />
    </SkelPageShell>
  );
}
