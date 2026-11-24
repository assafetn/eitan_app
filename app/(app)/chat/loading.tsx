import { SkelBar } from "@/components/ui/Skeleton";
import { TOP_TABS_HEIGHT } from "@/components/ui/TopTabs";

// Matches ChatClient: a few alternating bubbles, then the composer.
export default function ChatLoading() {
  const bubbles: { w: string; mine: boolean }[] = [
    { w: "55%", mine: false },
    { w: "40%", mine: true },
    { w: "70%", mine: false },
    { w: "35%", mine: true },
  ];
  return (
    <div
      dir="rtl"
      style={{
        position: "fixed",
        top: `calc(env(safe-area-inset-top) + ${TOP_TABS_HEIGHT}px)`,
        bottom: 0,
        insetInline: 0,
        display: "flex",
        flexDirection: "column",
        maxWidth: 640,
        margin: "0 auto",
        padding: "var(--sp-3) var(--sp-4) calc(var(--sp-3) + env(safe-area-inset-bottom))",
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "var(--sp-3)" }}>
        {bubbles.map((b, i) => (
          <div key={i} style={{ display: "flex", justifyContent: b.mine ? "flex-end" : "flex-start" }}>
            <SkelBar w={b.w} h={40} radius="var(--r-lg)" />
          </div>
        ))}
      </div>
      <div style={{ marginTop: "var(--sp-3)" }}>
        <SkelBar w="100%" h={44} radius="var(--r-lg)" />
      </div>
    </div>
  );
}
