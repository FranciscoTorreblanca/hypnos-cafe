import { OrderItem } from "@/hooks/useOrders";

export interface ComboGroup {
  comboGroupId: string;
  comboName: string;
  comboNameEn: string;
  items: OrderItem[];
}

export interface GroupedOrderEntry {
  type: "single";
  item: OrderItem;
} | {
  type: "combo";
  group: ComboGroup;
}

export function groupOrderItems(items: OrderItem[]): GroupedOrderEntry[] {
  const result: GroupedOrderEntry[] = [];
  const comboGroups = new Map<string, ComboGroup>();
  const processedIds = new Set<string>();

  // First pass: collect combo groups
  for (const item of items) {
    if (item.combo_group_id) {
      if (!comboGroups.has(item.combo_group_id)) {
        comboGroups.set(item.combo_group_id, {
          comboGroupId: item.combo_group_id,
          comboName: item.combo?.name ?? "Combo",
          comboNameEn: item.combo?.name_en ?? "Combo",
          items: [],
        });
      }
      comboGroups.get(item.combo_group_id)!.items.push(item);
      processedIds.add(item.id);
    }
  }

  // Build result maintaining original order (first item of each group determines position)
  const usedGroups = new Set<string>();
  for (const item of items) {
    if (item.combo_group_id) {
      if (!usedGroups.has(item.combo_group_id)) {
        usedGroups.add(item.combo_group_id);
        result.push({ type: "combo", group: comboGroups.get(item.combo_group_id)! });
      }
    } else {
      result.push({ type: "single", item });
    }
  }

  return result;
}
