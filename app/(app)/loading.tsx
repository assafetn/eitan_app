// Shared route-loading skeleton for the (app) tabs.
//
// Why this fixes the tab-switch latency: every tab's page.tsx is
// `force-dynamic` and fetches from Supabase on each navigation. Without a
// Suspense boundary, <Link> has no static shell to prefetch, so a tab tap
// blocks on the full server round-trip (1–2s) before anything changes. This
// loading.tsx IS that boundary: navigation now swaps to this skeleton
// instantly (and it's prefetched), while the real page streams in behind it.
//
// The shared layout — including <BottomNav> — stays mounted; only this page
// area is replaced. Tokens only, RTL inherited from <html dir="rtl">.

// A single grey placeholder bar. `w` is a CSS width (e.g. "45%", 20).
function Bar({
  w,
  h = 12,
  radius = "var(--r-sm)",
}: {
  w: string | number;
  h?: number;
  radius?: string;
}) {
  return (
    <span
      className="skeleton"
      style={{
        display: "block",
        width: w,
        height: h,
        borderRadius: radius,
        background: "var(--border)",
      }}
    />
  );
}

// A placeholder that mirrors the surface/border card used across the tabs
// (task rows, shopping rows, family cards): a leading circle + two text lines.
function RowCard() {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <span
        className="skeleton"
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "var(--border)",
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
        <Bar w="60%" h={12} />
        <Bar w="35%" h={10} />
      </span>
    </div>
  );
}

export default function AppLoading() {
  return (
    <div
      aria-hidden="true"
      style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: "var(--sp-6) var(--sp-4)",
        paddingTop: "var(--sp-8)",
      }}
    >
      {/* Header placeholder */}
      <div style={{ marginBottom: "var(--sp-6)" }}>
        <Bar w="45%" h={28} radius="var(--r-md)" />
      </div>

      {/* List placeholder */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <RowCard key={i} />
        ))}
      </div>
    </div>
  );
}
