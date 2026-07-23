import { SkelBar, SkelList, SkelPageShell } from "@/components/ui/Skeleton";

// Matches TasksClient: title + "add" pill, the list/calendar view toggle, the
// filter chip rows, then a task list.
export default function TasksLoading() {
  return (
    <SkelPageShell>
      {/* Header: title + add button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--sp-6)",
        }}
      >
        <SkelBar w="35%" h={28} radius="var(--r-md)" />
        <SkelBar w={120} h={40} radius="var(--r-full)" />
      </div>

      {/* View toggle (full-width segmented pill) */}
      <SkelBar w="100%" h={44} radius="var(--r-full)" style={{ marginBottom: "var(--sp-5)" }} />

      {/* Filter chip rows */}
      <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", marginBottom: "var(--sp-3)" }}>
        {[64, 88, 72, 96].map((w, i) => (
          <SkelBar key={i} w={w} h={32} radius="var(--r-full)" />
        ))}
      </div>
      <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-6)" }}>
        {[48, 80, 80].map((w, i) => (
          <SkelBar key={i} w={w} h={30} radius="var(--r-full)" />
        ))}
      </div>

      {/* Section label + task rows */}
      <div style={{ marginBottom: "var(--sp-2)" }}>
        <SkelBar w="20%" h={10} />
      </div>
      <SkelList count={6} />
    </SkelPageShell>
  );
}
