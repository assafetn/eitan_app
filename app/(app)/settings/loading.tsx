import { SkelBar, SkelList, SkelPageShell } from "@/components/ui/Skeleton";

// Matches SettingsClient: a back-header, then a couple of labelled sections of
// rows (responsibilities, labels, members).
export default function SettingsLoading() {
  return (
    <SkelPageShell>
      {/* Back header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-6)" }}>
        <SkelBar w={40} h={40} radius="var(--r-full)" />
        <SkelBar w="35%" h={28} radius="var(--r-md)" />
      </div>

      {Array.from({ length: 2 }).map((_, s) => (
        <div key={s} style={{ marginBottom: "var(--sp-6)" }}>
          <div style={{ marginBottom: "var(--sp-3)" }}>
            <SkelBar w="30%" h={12} />
          </div>
          <SkelList count={3} />
        </div>
      ))}
    </SkelPageShell>
  );
}
