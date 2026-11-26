import { SkelBar, SkelGroup, SkelPageShell } from "@/components/ui/Skeleton";

// Matches TasksClient: title + "add" pill, the mine/all segmented control,
// then the sections as inset groups.
export default function TasksLoading() {
  return (
    <SkelPageShell>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 44,
          margin: "var(--sp-2) 0 var(--sp-5)",
        }}
      >
        <SkelBar w="35%" h={28} radius="var(--r-md)" />
        <SkelBar w={112} h={40} radius="var(--r-full)" />
      </div>

      <SkelBar w="100%" h={40} radius="var(--r-full)" style={{ marginBottom: "var(--sp-6)" }} />

      <SkelGroup count={3} />
      <SkelGroup count={2} />
    </SkelPageShell>
  );
}
