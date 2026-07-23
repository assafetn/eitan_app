"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ShoppingItem } from "@/lib/types";
import { getShoppingEmoji } from "@/lib/shoppingEmoji";
import { useCoalescedRefresh } from "@/lib/useCoalescedRefresh";
import Toast from "@/components/ui/Toast";
import { Check, Plus, Trash2 } from "lucide-react";

const SAVE_FAILED = "השמירה נכשלה, נסו שוב";

// Gentle horizontal marquee for names that overflow even after a 2-line clamp.
// Transform-only (never width/left), with a ~2s pause baked into the keyframe at
// each end (18% / 68% of a 10s loop ≈ 1.8s). Disabled entirely under reduced
// motion — the `!important` beats the inline `animation`, and the JS gate below
// also keeps such rows on the plain 2-line clamp. Injected once (see root).
const MARQUEE_CSS = `
@keyframes shopping-marquee {
  0%, 18% { transform: translateX(0); }
  50%, 68% { transform: translateX(var(--marquee-distance, 0px)); }
  100% { transform: translateX(0); }
}
@media (prefers-reduced-motion: reduce) {
  .shopping-marquee-track { animation: none !important; transform: none !important; }
}
`;

interface Props {
  initialItems: ShoppingItem[];
}

// Unchecked first (oldest-first), then checked (oldest-first) sunk to bottom.
function sortItems(items: ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((a, b) => {
    if (a.is_checked !== b.is_checked) return a.is_checked ? 1 : -1;
    return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
  });
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "var(--bg)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-md)",
  fontFamily: "var(--font)",
  fontSize: "var(--text-base)",
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
  direction: "rtl",
  transition: `border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)`,
};

function focusRing(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = "var(--jmh-blue-60)";
  e.target.style.boxShadow = "0 0 0 3px oklch(0.54 0.14 240 / 0.12)";
}
function blurRing(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = "var(--border-strong)";
  e.target.style.boxShadow = "none";
}

export default function ShoppingClient({ initialItems }: Props) {
  const [items, setItems] = useState<ShoppingItem[]>(initialItems);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [adding, setAdding] = useState(false);
  // Transient failure toast for reverted optimistic updates.
  const [toast, setToast] = useState<string | null>(null);
  // Coalesced re-fetch so the nav's shopping badge stays in sync after mutations.
  const scheduleRefresh = useCoalescedRefresh();

  const sorted = useMemo(() => sortItems(items), [items]);
  const checkedCount = items.filter((i) => i.is_checked).length;

  async function getMyMemberId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return null;
    const { data } = await supabase.from("family_members").select("id").eq("auth_user_id", uid).single();
    return data?.id ?? null;
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || adding) return;
    setAdding(true);

    const supabase = createClient();
    const memberId = await getMyMemberId(supabase);
    if (!memberId) {
      setAdding(false);
      return;
    }

    const { data, error } = await supabase
      .from("shopping_items")
      .insert({
        name: trimmed,
        quantity: quantity.trim() || null,
        is_checked: false,
        added_by: memberId,
      })
      .select("*, adder:family_members!shopping_items_added_by_fkey(*)")
      .single();

    if (!error && data) {
      setItems((prev) => [...prev, data as ShoppingItem]);
      setName("");
      setQuantity("");
      scheduleRefresh();
    }
    setAdding(false);
  }

  async function toggleItem(item: ShoppingItem) {
    const next = !item.is_checked;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_checked: next } : i)));
    const supabase = createClient();
    const { error } = await supabase.from("shopping_items").update({ is_checked: next }).eq("id", item.id);
    if (error) {
      // revert optimistic toggle
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_checked: item.is_checked } : i)));
      setToast(SAVE_FAILED);
    } else {
      scheduleRefresh();
    }
  }

  async function deleteItem(item: ShoppingItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const supabase = createClient();
    const { error } = await supabase.from("shopping_items").delete().eq("id", item.id);
    if (error) {
      // revert optimistic delete (sortItems re-orders on render, so order here doesn't matter)
      setItems((prev) => [...prev, item]);
      setToast(SAVE_FAILED);
    } else {
      scheduleRefresh();
    }
  }

  async function clearChecked() {
    const removed = items.filter((i) => i.is_checked);
    if (removed.length === 0) return;
    const ids = removed.map((i) => i.id);
    setItems((prev) => prev.filter((i) => !i.is_checked));
    const supabase = createClient();
    const { error } = await supabase.from("shopping_items").delete().in("id", ids);
    if (error) {
      // revert optimistic clear
      setItems((prev) => [...prev, ...removed]);
      setToast(SAVE_FAILED);
    } else {
      scheduleRefresh();
    }
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 600,
        margin: "0 auto",
        padding: "var(--sp-6) var(--sp-4)",
        paddingTop: "var(--sp-8)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--sp-5)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-2xl)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          קניות
        </h1>

        {checkedCount > 0 && (
          <button
            onClick={clearChecked}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--sp-1)",
              padding: "8px 14px",
              background: "transparent",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--r-full)",
              fontFamily: "var(--font)",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: `background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--jmh-coral-bg)";
              e.currentTarget.style.borderColor = "var(--jmh-coral)";
              e.currentTarget.style.color = "var(--jmh-coral)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "var(--border-strong)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <Trash2 size={14} strokeWidth={2} />
            נקה שנבדקו
          </button>
        )}
      </div>

      {/* Add form */}
      <form onSubmit={addItem} style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-6)" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="הוסף פריט"
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          onFocus={focusRing}
          onBlur={blurRing}
        />
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="כמות"
          // Digits keypad on mobile without switching to type="number" — quantity
          // stays a nullable free-text string (no spinners, no RTL misbehaviour).
          inputMode="numeric"
          pattern="[0-9]*"
          style={{ ...inputStyle, width: 80, flexShrink: 0 }}
          onFocus={focusRing}
          onBlur={blurRing}
        />
        <button
          type="submit"
          disabled={!name.trim() || adding}
          aria-label="הוסף פריט"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            flexShrink: 0,
            background: name.trim() ? "var(--jmh-blue)" : "var(--jmh-blue-30)",
            color: "white",
            border: "none",
            borderRadius: "var(--r-md)",
            cursor: name.trim() ? "pointer" : "not-allowed",
            boxShadow: name.trim() ? "var(--shadow-sm)" : "none",
            transition: `background var(--dur-fast) var(--ease-out)`,
          }}
        >
          <Plus size={18} strokeWidth={2} />
        </button>
      </form>

      {/* Empty state */}
      {items.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "var(--sp-16) var(--sp-6)",
            color: "var(--text-muted)",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: "var(--sp-4)" }}
          >
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <p style={{ fontFamily: "var(--font)", fontSize: "var(--text-base)", margin: "0 0 var(--sp-1)" }}>
            הרשימה ריקה
          </p>
          <p style={{ fontFamily: "var(--font)", fontSize: "var(--text-sm)", margin: 0 }}>
            הוסף את הפריט הראשון למעלה
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          {sorted.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onToggle={() => toggleItem(item)}
              onDelete={() => deleteItem(item)}
            />
          ))}
        </div>
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} />
      <style>{MARQUEE_CSS}</style>
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const checked = item.is_checked;
  const adderColor = item.adder?.color ? `var(--${item.adder.color})` : "var(--border-strong)";

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
        opacity: checked ? 0.6 : 1,
        transition: `opacity var(--dur-fast) var(--ease-out)`,
      }}
    >
      {/* Toggle (rightmost in RTL). The visible circle stays 20px; the button
          pads out to a 44×44 touch target and pulls back with a matching negative
          margin so the row layout is unchanged. */}
      <button
        onClick={onToggle}
        aria-label={checked ? "בטל סימון" : "סמן כנקנה"}
        style={{
          padding: 12, // 12 + 20 circle + 12 = 44px hit area
          margin: -12, // neutralises the padding so the footprint stays 20px
          background: "transparent",
          border: "none",
          flexShrink: 0,
          alignSelf: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: `2px solid ${checked ? "var(--jmh-sage)" : "var(--border-strong)"}`,
            background: checked ? "var(--jmh-sage)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            transition: `background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)`,
          }}
        >
          {checked && <Check size={10} strokeWidth={2.5} />}
        </span>
      </button>

      {/* Leading item emoji (shopping-list-only design exception). Inferred live
          from the name; dims with the row via the row's opacity. Decorative —
          the name follows, so it's hidden from assistive tech. */}
      <span
        aria-hidden="true"
        style={{ fontSize: "var(--text-lg)", lineHeight: 1, flexShrink: 0, alignSelf: "center" }}
      >
        {getShoppingEmoji(item.name)}
      </span>

      {/* Name + quantity */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
        <ItemName name={item.name} checked={checked} />
        {item.quantity && (
          <span
            style={{
              fontFamily: "var(--font)",
              fontSize: "var(--text-sm)",
              color: "var(--text-muted)",
              flexShrink: 0,
            }}
          >
            {item.quantity}
          </span>
        )}
      </div>

      {/* Added-by color dot */}
      <span
        title={item.adder?.name ?? undefined}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: adderColor,
          flexShrink: 0,
          alignSelf: "center",
        }}
      />

      {/* Delete. 28px visual, expanded to a 44×44 hit area via padding + negative
          margin so the footprint stays 28px and the row layout is unchanged. */}
      <button
        onClick={onDelete}
        aria-label="מחק פריט"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          padding: 8, // 8 + 28 + 8 = 44px hit area
          margin: -8, // keep the 28px footprint
          boxSizing: "content-box",
          borderRadius: "var(--r-sm)",
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          flexShrink: 0,
          alignSelf: "center",
          transition: `background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--jmh-coral-bg)";
          e.currentTarget.style.color = "var(--jmh-coral)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--text-muted)";
        }}
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

// Item name display with three states, decided by measurement:
//  • fits / wraps within 2 lines → 2-line clamp with ellipsis (the default)
//  • overflows even 2 lines + motion allowed → single-line horizontal marquee
//  • reduced motion → always the 2-line clamp (never the marquee)
// Only transform is animated. The marquee is a sibling of the controls (never an
// overlay over them) and carries no click handlers, so tap-to-toggle / delete /
// toast behaviour is untouched.
function ItemName({ name, checked }: { name: string; checked: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [marquee, setMarquee] = useState(false);
  const [distance, setDistance] = useState(0);
  const [reduced, setReduced] = useState(false);

  // Mirror state into refs so the ResizeObserver callback never reads stale
  // values without needing to re-subscribe on every change.
  const marqueeRef = useRef(marquee);
  marqueeRef.current = marquee;
  const distanceRef = useRef(distance);
  distanceRef.current = distance;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  // Track the reduced-motion preference; re-evaluate when it changes.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const evaluate = () => {
      const el = textRef.current;
      const container = wrapRef.current;
      if (!el || !container) return;

      // Reduced motion (or no room): never marquee — plain 2-line clamp.
      if (reducedRef.current) {
        if (marqueeRef.current) setMarquee(false);
        return;
      }

      if (marqueeRef.current) {
        // Currently a single-line track: el.scrollWidth is the full text width.
        const overflow = el.scrollWidth - container.clientWidth;
        if (overflow <= 0) {
          setMarquee(false);
          setDistance(0);
        } else if (Math.ceil(overflow) !== distanceRef.current) {
          setDistance(Math.ceil(overflow));
        }
      } else {
        // Currently a 2-line clamp box: a taller scrollHeight means the text is
        // being truncated past two lines — the only case that earns a marquee.
        const clipped = el.scrollHeight > el.clientHeight + 1;
        if (clipped) {
          const full = measureSingleLineWidth(el);
          const overflow = Math.ceil(full - container.clientWidth);
          if (overflow > 0) {
            setDistance(overflow);
            setMarquee(true);
          }
        }
      }
    };

    evaluate();
    const ro = new ResizeObserver(() => evaluate());
    const w = wrapRef.current;
    if (w) ro.observe(w);
    return () => ro.disconnect();
    // Re-run when the name changes, the mode flips, or the motion pref changes.
  }, [name, marquee, reduced]);

  const baseText: React.CSSProperties = {
    fontFamily: "var(--font)",
    fontSize: "var(--text-base)",
    fontWeight: 500,
    color: checked ? "var(--text-muted)" : "var(--text-primary)",
    textDecoration: checked ? "line-through" : "none",
  };

  return (
    <div ref={wrapRef} style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
      {marquee ? (
        <span
          ref={textRef}
          className="shopping-marquee-track"
          style={{
            ...baseText,
            display: "inline-block",
            whiteSpace: "nowrap",
            willChange: "transform",
            ["--marquee-distance" as string]: `${distance}px`,
            animation: "shopping-marquee 10s ease-in-out infinite",
          } as React.CSSProperties}
        >
          {name}
        </span>
      ) : (
        <span
          ref={textRef}
          style={{
            ...baseText,
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
            overflowWrap: "anywhere",
          }}
        >
          {name}
        </span>
      )}
    </div>
  );
}

// Full single-line width of the text, measured off-screen so it never affects
// layout or the row's scroll. Clones the element (inheriting its inline font
// styles) with wrapping/clamp removed.
function measureSingleLineWidth(el: HTMLElement): number {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.position = "absolute";
  clone.style.visibility = "hidden";
  clone.style.pointerEvents = "none";
  clone.style.whiteSpace = "nowrap";
  clone.style.display = "inline-block";
  clone.style.width = "auto";
  clone.style.maxWidth = "none";
  clone.style.setProperty("-webkit-line-clamp", "unset");
  el.parentElement?.appendChild(clone);
  const width = clone.scrollWidth;
  clone.remove();
  return width;
}
