import { SkelBar } from "@/components/ui/Skeleton";

// Matches ChatClient: a few alternating bubbles (sender-side corner at the
// top of each), then the pill composer and send button.
export default function ChatLoading() {
  const bubbles: { w: string; h: number; mine: boolean }[] = [
    { w: "58%", h: 52, mine: false },
    { w: "42%", h: 36, mine: true },
    { w: "70%", h: 52, mine: false },
    { w: "36%", h: 36, mine: true },
  ];
  return (
    <div
      aria-hidden="true"
      dir="rtl"
      style={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        maxWidth: 640,
        margin: "0 auto",
        padding: "var(--sp-2) var(--sp-3) var(--sp-3)",
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "var(--sp-3)" }}>
        {bubbles.map((b, i) => (
          <div key={i} style={{ display: "flex", justifyContent: b.mine ? "flex-end" : "flex-start" }}>
            <SkelBar
              w={b.w}
              h={b.h}
              radius="18px"
              style={b.mine ? { borderStartEndRadius: 6 } : { borderStartStartRadius: 6 }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "var(--sp-2)", marginTop: "var(--sp-5)" }}>
        <SkelBar w="100%" h={44} radius="22px" />
        <SkelBar w={44} h={44} radius="var(--r-full)" style={{ flexShrink: 0 }} />
      </div>
    </div>
  );
}
