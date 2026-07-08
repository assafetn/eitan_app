"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ShoppingItem } from "@/lib/types";
import { getShoppingEmoji } from "@/lib/shoppingEmoji";
import { Check, Plus, Trash2 } from "lucide-react";

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
    }
    setAdding(false);
  }

  async function toggleItem(item: ShoppingItem) {
    const next = !item.is_checked;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_checked: next } : i)));
    const supabase = createClient();
    await supabase.from("shopping_items").update({ is_checked: next }).eq("id", item.id);
  }

  async function deleteItem(item: ShoppingItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const supabase = createClient();
    await supabase.from("shopping_items").delete().eq("id", item.id);
  }

  async function clearChecked() {
    const ids = items.filter((i) => i.is_checked).map((i) => i.id);
    if (ids.length === 0) return;
    setItems((prev) => prev.filter((i) => !i.is_checked));
    const supabase = createClient();
    await supabase.from("shopping_items").delete().in("id", ids);
  }

  return (
    <div
      style={{
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
      {/* Toggle (rightmost in RTL) */}
      <button
        onClick={onToggle}
        aria-label={checked ? "בטל סימון" : "סמן כנקנה"}
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: `2px solid ${checked ? "var(--jmh-sage)" : "var(--border-strong)"}`,
          background: checked ? "var(--jmh-sage)" : "transparent",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "white",
          padding: 0,
          transition: `background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)`,
        }}
      >
        {checked && <Check size={10} strokeWidth={2.5} />}
      </button>

      {/* Leading item emoji (shopping-list-only design exception). Inferred live
          from the name; dims with the row via the row's opacity. Decorative —
          the name follows, so it's hidden from assistive tech. */}
      <span
        aria-hidden="true"
        style={{ fontSize: "var(--text-lg)", lineHeight: 1, flexShrink: 0 }}
      >
        {getShoppingEmoji(item.name)}
      </span>

      {/* Name + quantity */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: "var(--sp-2)" }}>
        <span
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-base)",
            fontWeight: 500,
            color: checked ? "var(--text-muted)" : "var(--text-primary)",
            textDecoration: checked ? "line-through" : "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.name}
        </span>
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
        }}
      />

      {/* Delete */}
      <button
        onClick={onDelete}
        aria-label="מחק פריט"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "var(--r-sm)",
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          flexShrink: 0,
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
