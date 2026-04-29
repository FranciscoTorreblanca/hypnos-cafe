import { supabase } from "@/integrations/supabase/client";
import type { TicketSnapshot, TicketSnapshotItem } from "@/hooks/useTickets";

interface MinimalOrderItem {
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  notes?: string;
  menu_item?: { name: string; name_en: string } | null;
  menu_items?: { name: string; name_en: string } | null;
  combo?: { name: string; name_en: string } | null;
  combos?: { name: string; name_en: string } | null;
}

interface BuildSnapshotInput {
  table_number: number;
  table_name?: string;
  waiter_name?: string;
  general_discount: number;
  language: "es" | "en";
  items: MinimalOrderItem[];
}

/** Build a ticket snapshot, enriching with each item's list price + promo for receipt breakdown. */
export async function buildTicketSnapshot(input: BuildSnapshotInput): Promise<TicketSnapshot> {
  const ids = [...new Set(input.items.map((i) => i.menu_item_id).filter(Boolean))];
  let priceMap: Record<string, { price: number; promo_price: number | null }> = {};
  if (ids.length > 0) {
    const { data } = await supabase
      .from("menu_items")
      .select("id, price, promo_price")
      .in("id", ids);
    (data ?? []).forEach((r: any) => {
      priceMap[r.id] = { price: Number(r.price), promo_price: r.promo_price != null ? Number(r.promo_price) : null };
    });
  }

  // Resolve current tax rate
  let taxRate = 16;
  const { data: setting } = await supabase
    .from("restaurant_settings")
    .select("value")
    .eq("key", "tax_rate")
    .maybeSingle();
  if (setting?.value) {
    const parsed = parseFloat(setting.value);
    if (!Number.isNaN(parsed)) taxRate = parsed;
  }

  const items: TicketSnapshotItem[] = input.items.map((oi) => {
    const mi = oi.menu_item ?? oi.menu_items ?? null;
    const co = oi.combo ?? oi.combos ?? null;
    const name =
      input.language === "es"
        ? mi?.name ?? co?.name ?? ""
        : mi?.name_en || mi?.name || co?.name_en || co?.name || "";
    const refPrices = priceMap[oi.menu_item_id];
    // Original (list) price = current menu price; promo = current promo or null.
    // If the unit_price actually charged differs from the list price, treat list as the original.
    const original_price = refPrices?.price ?? oi.unit_price;
    const promo_price =
      refPrices?.promo_price != null && refPrices.promo_price < original_price
        ? refPrices.promo_price
        : null;
    return {
      name,
      quantity: oi.quantity,
      unit_price: oi.unit_price,
      original_price,
      promo_price,
      discount: oi.discount ?? 0,
      notes: oi.notes ?? "",
    };
  });

  return {
    table_number: input.table_number,
    table_name: input.table_name,
    waiter_name: input.waiter_name,
    general_discount: input.general_discount,
    tax_rate: taxRate,
    items,
  };
}
