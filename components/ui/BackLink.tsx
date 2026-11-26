import Link from "next/link";
import { ChevronRight } from "lucide-react";

// iOS-style back link above a page title: a chevron and the name of the
// screen it returns to, in the accent color. In RTL "back" points right.
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        minHeight: 44,
        // optical: the chevron's own side-bearing, not the box, meets the edge
        marginInlineStart: -6,
        paddingInlineEnd: "var(--sp-2)",
        fontFamily: "var(--font)",
        fontSize: "var(--text-base)",
        fontWeight: 500,
        color: "var(--jmh-blue)",
        textDecoration: "none",
      }}
    >
      <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
      {label}
    </Link>
  );
}
