// Shared route-loading skeleton for the (app) tabs.
//
// Why this fixes the tab-switch latency: every tab's page.tsx is
// `force-dynamic` and fetches from Supabase on each navigation. Without a
// Suspense boundary, <Link> has no static shell to prefetch, so a tab tap
// blocks on the full server round-trip (1–2s) before anything changes. This
// loading.tsx IS that boundary: navigation now swaps to this skeleton
// instantly (and it's prefetched), while the real page streams in behind it.
//
// The shared layout — including <TopTabs> — stays mounted; only this page
// area is replaced. Tokens only, RTL inherited from <html dir="rtl">.
import { SkelGroup, SkelPageShell, SkelTitle } from "@/components/ui/Skeleton";

export default function AppLoading() {
  return (
    <SkelPageShell>
      <SkelTitle w="40%" />
      <SkelGroup count={5} />
    </SkelPageShell>
  );
}
