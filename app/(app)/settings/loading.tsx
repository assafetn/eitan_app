import { SkelBar, SkelGroup, SkelPageShell, SkelTitle } from "@/components/ui/Skeleton";

// Matches SettingsClient: back link + title, then the appearance segmented
// control and the family / notifications groups.
export default function SettingsLoading() {
  return (
    <SkelPageShell>
      <SkelTitle w="35%" back />

      <div style={{ marginBottom: "var(--sp-8)" }}>
        <div style={{ margin: "0 var(--sp-1) var(--sp-2)" }}>
          <SkelBar w={48} h={12} />
        </div>
        <SkelBar w="100%" h={46} radius="var(--r-full)" />
      </div>

      <SkelGroup count={1} lead={32} />
      <SkelGroup count={1} lead={32} />
    </SkelPageShell>
  );
}
