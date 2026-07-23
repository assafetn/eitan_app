import { SkelBar, SkelList, SkelPageShell } from "@/components/ui/Skeleton";

// Matches ShoppingClient: title, the add-item form row (name + quantity + add
// button), then the item list.
export default function ShoppingLoading() {
  return (
    <SkelPageShell>
      {/* Header */}
      <div style={{ marginBottom: "var(--sp-5)" }}>
        <SkelBar w="30%" h={28} radius="var(--r-md)" />
      </div>

      {/* Add form: name (flex) + quantity + 44px add button */}
      <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-6)" }}>
        <SkelBar w="100%" h={44} radius="var(--r-md)" style={{ flex: 1 }} />
        <SkelBar w={80} h={44} radius="var(--r-md)" />
        <SkelBar w={44} h={44} radius="var(--r-md)" />
      </div>

      {/* Item list */}
      <SkelList count={6} />
    </SkelPageShell>
  );
}
