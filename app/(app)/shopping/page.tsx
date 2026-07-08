import { createClient } from "@/lib/supabase/server";
import type { ShoppingItem } from "@/lib/types";
import ShoppingClient from "@/components/ui/ShoppingClient";

export const dynamic = "force-dynamic";

export default async function ShoppingPage() {
  const supabase = await createClient();

  // Unchecked first, each group oldest-first (natural append order).
  const { data: items } = await supabase
    .from("shopping_items")
    .select("*, adder:family_members!shopping_items_added_by_fkey(*)")
    .order("is_checked", { ascending: true })
    .order("created_at", { ascending: true });

  return <ShoppingClient initialItems={(items as ShoppingItem[]) ?? []} />;
}
