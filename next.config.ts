import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {},
  // Retired entry points. As config redirects they are answered at the edge
  // before middleware runs — no auth check, no server function, no database.
  // (As page-level redirect() calls they went through the whole (app) layout
  // first, so an old home-screen icon opening /home paid for two page loads.)
  // The matching page.tsx files stay as a fallback.
  async redirects() {
    return [
      { source: "/", destination: "/chat", permanent: false },
      { source: "/home", destination: "/chat", permanent: false },
      { source: "/calendar", destination: "/tasks", permanent: false },
    ];
  },
};

export default nextConfig;
