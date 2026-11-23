import { SkelBar } from "@/components/ui/Skeleton";

// Matches ChatClient: title, a few alternating bubbles, then the composer.
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
        height: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 96px)",
        display: "flex",
        flexDirection: "column",
        maxWidth: 640,
        margin: "0 auto",
        padding: "var(--sp-5) var(--sp-4) var(--sp-3)",
      }}
    >
      <SkelBar w="25%" h={28} radius="var(--r-md)" />
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
