import { supabase } from "@/integrations/supabase/client";
import type { TicketSnapshot, TicketSnapshotItem } from "@/hooks/useTickets";

interface MinimalOrderItem {
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  discount_amount?: number;
  notes?: string;
  combo_id?: string | null;
  combo_group_id?: string | null;
  menu_item?: { name: string; name_en: string } | null;
  menu_items?: { name: string; name_en: string } | null;
  combo?: { name: string; name_en: string; price?: number } | null;
  combos?: { name: string; name_en: string; price?: number } | null;
}

interface BuildSnapshotInput {
  table_number: number;
  table_name?: string;
  waiter_name?: string;
  general_discount: number;
  general_discount_amount?: number;
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

  // Resolve combo metadata (name + price) for any combo_ids present.
  const comboIds = [...new Set(input.items.map((i) => i.combo_id).filter(Boolean) as string[])];
  let comboMap: Record<string, { name: string; name_en: string; price: number }> = {};
  if (comboIds.length > 0) {
    const { data } = await supabase
      .from("combos")
      .select("id, name, name_en, price")
      .in("id", comboIds);
    (data ?? []).forEach((c: any) => {
      comboMap[c.id] = { name: c.name, name_en: c.name_en, price: Number(c.price) };
    });
  }

  // Pre-compute how many "combo units" each group represents (max qty across its items).
  const groupQuantity: Record<string, number> = {};
  for (const oi of input.items) {
    if (oi.combo_group_id) {
      groupQuantity[oi.combo_group_id] = Math.max(groupQuantity[oi.combo_group_id] ?? 0, oi.quantity);
    }
  }

  const items: TicketSnapshotItem[] = input.items.map((oi) => {
    const mi = oi.menu_item ?? oi.menu_items ?? null;
    const co = oi.combo ?? oi.combos ?? null;
    const name =
      input.language === "es"
        ? mi?.name ?? co?.name ?? ""
        : mi?.name_en || mi?.name || co?.name_en || co?.name || "";
    const refPrices = priceMap[oi.menu_item_id];
    const original_price = refPrices?.price ?? oi.unit_price;
    const promo_price =
      refPrices?.promo_price != null && refPrices.promo_price < original_price
        ? refPrices.promo_price
        : null;

    const comboMeta = oi.combo_id ? comboMap[oi.combo_id] : null;
    const combo_name = comboMeta
      ? input.language === "es" ? comboMeta.name : (comboMeta.name_en || comboMeta.name)
      : (co ? (input.language === "es" ? co.name : (co.name_en || co.name)) : null);

    return {
      name,
      quantity: oi.quantity,
      unit_price: oi.unit_price,
      original_price,
      promo_price,
      discount: oi.discount ?? 0,
      notes: oi.notes ?? "",
      combo_group_id: oi.combo_group_id ?? null,
      combo_name: oi.combo_group_id ? combo_name ?? null : null,
      combo_unit_price: oi.combo_group_id && comboMeta ? comboMeta.price : null,
      combo_quantity: oi.combo_group_id ? groupQuantity[oi.combo_group_id] ?? 1 : null,
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
