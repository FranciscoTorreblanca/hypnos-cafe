import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queue, log, type QueueEntry } from "./idbStorage";

// Classify Supabase errors into terminal (discard) vs retryable (keep)
function classifyError(err: any): "terminal" | "retry" {
  const msg = String(err?.message || err || "").toLowerCase();
  const code = String(err?.code || "");
  if (
    msg.includes("forbidden") ||
    msg.includes("session_already_open") ||
    msg.includes("session_not_open") ||
    msg.includes("fingerprint_mismatch") ||
    msg.includes("already_checked_in") ||
    msg.includes("no_open_session") ||
    msg.includes("no_schedule") ||
    msg.includes("too_early") ||
    msg.includes("shift_ended") ||
    msg.includes("row-level security") ||
    msg.includes("duplicate key") ||
    code === "23505" || // unique violation
    code === "23503" || // FK violation
    code === "42501"    // RLS denied
  ) return "terminal";
  // Network / 5xx / aborted -> retry
  if (!navigator.onLine) return "retry";
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout")) return "retry";
  // Default keep for manual decision
  return "retry";
}

async function execEntry(e: QueueEntry, _qc: QueryClient): Promise<void> {
  // For insert ops with client-generated PKs, a duplicate-key error means the row
  // was successfully persisted on a previous attempt whose ack we missed — treat as success.
  const ignoreDup = (error: any) => {
    if (!error) return false;
    return error.code === "23505" || String(error.message || "").toLowerCase().includes("duplicate key");
  };
  const _exec = async (): Promise<void> => {
  const p = e.payload;
  switch (e.kind) {
    case "order.create": {
      const { error } = await supabase.from("orders").insert({
        id: p.id, table_number: p.table_number, created_by: p.created_by,
      } as any);
      if (error) throw error;
      return;
    }
    case "order.updateStatus": {
      const { error } = await supabase.from("orders").update({ status: p.status }).eq("id", p.id);
      if (error) throw error;
      return;
    }
    case "order.updateGeneralDiscount": {
      const { error } = await supabase.from("orders").update({ general_discount: p.discount } as any).eq("id", p.id);
      if (error) throw error;
      return;
    }
    case "order.updateGeneralDiscountAmount": {
      const { error } = await supabase.from("orders").update({ general_discount_amount: Math.max(0, p.discount_amount) } as any).eq("id", p.id);
      if (error) throw error;
      return;
    }
    case "order.cancel": {
      await supabase.from("order_items").delete().eq("order_id", p.id);
      const { error } = await supabase.from("orders").update({ status: "cancelled" as any }).eq("id", p.id);
      if (error) throw error;
      return;
    }
    case "order_item.insert": {
      const { error } = await supabase.from("order_items").insert({
        id: p.id, order_id: p.order_id, menu_item_id: p.menu_item_id, quantity: p.quantity,
        unit_price: p.unit_price, notes: p.notes ?? "", discount: p.discount ?? 0,
        discount_amount: p.discount_amount ?? 0, combo_id: p.combo_id ?? null,
        combo_group_id: p.combo_group_id ?? null,
      } as any);
      if (error) throw error;
      return;
    }
    case "order_item.insertBulk": {
      const { error } = await supabase.from("order_items").insert(p.rows as any);
      if (error) throw error;
      return;
    }
    case "order_item.updateStatus": {
      const { error } = await supabase.from("order_items").update({ status: p.status } as any).eq("id", p.id);
      if (error) throw error;
      return;
    }
    case "order_item.remove": {
      const { error } = await supabase.from("order_items").delete().eq("id", p.id);
      if (error) throw error;
      return;
    }
    case "order_item.updateDiscount": {
      const { error } = await supabase.from("order_items").update({ discount: p.discount } as any).eq("id", p.id);
      if (error) throw error;
      return;
    }
    case "order_item.updateDiscountAmount": {
      const { error } = await supabase.from("order_items").update({ discount_amount: Math.max(0, p.discount_amount) } as any).eq("id", p.id);
      if (error) throw error;
      return;
    }
    case "payment.create": {
      const rows = (p.parts as any[]).map((part, i) => ({
        id: p.ids[i],
        order_id: p.order_id,
        amount: part.amount,
        tip: part.tip,
        payment_method: part.payment_method,
        created_by: p.created_by,
      }));
      const { error } = await supabase.from("payments").insert(rows);
      if (error) throw error;
      const { error: upErr } = await supabase.from("orders").update({ status: "paid" as any } as any).eq("id", p.order_id);
      if (upErr) throw upErr;
      return;
    }
    case "till.open": {
      const { error } = await (supabase.rpc as any)("open_till_session", {
        _opening_float: p.opening_float, _notes: p.notes ?? null,
        ...(p.id ? { _id: p.id } : {}),
      });
      if (error) throw error;
      return;
    }
    case "till.close": {
      const { error } = await (supabase.rpc as any)("close_till_session", {
        _session_id: p.session_id, _counted: p.counted,
        _denominations: p.denominations ?? null, _notes: p.notes ?? null,
      });
      if (error) throw error;
      return;
    }
    case "attendance.check_in": {
      const { error } = await (supabase.rpc as any)("attempt_check_in", {
        _user_id: p.user_id, _device_id: p.device_id,
        _fingerprint_hash: p.fingerprint_hash, _method: p.method,
        ...(p.id ? { _id: p.id } : {}),
      });
      if (error) throw error;
      return;
    }
    case "attendance.check_out": {
      const { error } = await (supabase.rpc as any)("attempt_check_out", {
        _user_id: p.user_id, _device_id: p.device_id,
        _fingerprint_hash: p.fingerprint_hash, _method: p.method,
      });
      if (error) throw error;
      return;
    }
  }
}

const INVALIDATIONS: Partial<Record<QueueEntry["kind"], string[]>> = {
  "order.create": ["orders"],
  "order.updateStatus": ["orders"],
  "order.updateGeneralDiscount": ["orders"],
  "order.updateGeneralDiscountAmount": ["orders"],
  "order.cancel": ["orders"],
  "order_item.insert": ["orders"],
  "order_item.insertBulk": ["orders"],
  "order_item.updateStatus": ["orders"],
  "order_item.remove": ["orders"],
  "order_item.updateDiscount": ["orders"],
  "order_item.updateDiscountAmount": ["orders"],
  "payment.create": ["orders", "payments", "till_transactions", "till_x_report"],
  "till.open": ["till_session", "till_sessions", "till_x_report"],
  "till.close": ["till_session", "till_sessions", "till_x_report", "till_transactions"],
  "attendance.check_in": ["attendance"],
  "attendance.check_out": ["attendance"],
};

export async function runSync(qc: QueryClient): Promise<void> {
  const all = await queue.list();
  const pending = all.filter((e) => e.status === "pending");
  if (!pending.length) return;

  const syncedIds = new Set<string>();
  for (const entry of pending) {
    // Wait for deps
    if (entry.dependsOn?.length) {
      const unresolved = entry.dependsOn.some((depId) => {
        const dep = all.find((x) => x.id === depId);
        return dep && dep.status !== "synced" && !syncedIds.has(depId);
      });
      if (unresolved) continue;
    }
    await queue.update(entry.id, { status: "syncing" });
    try {
      await execEntry(entry, qc);
      await log.push({ ...entry, status: "synced" });
      await queue.remove(entry.id);
      syncedIds.add(entry.id);
      const keysToInvalidate = INVALIDATIONS[entry.kind] ?? [];
      for (const k of keysToInvalidate) qc.invalidateQueries({ queryKey: [k] });
    } catch (err: any) {
      const klass = classifyError(err);
      const errMsg = err?.message || String(err);
      if (klass === "terminal") {
        await log.push({ ...entry, status: "discarded", error: errMsg });
        await queue.remove(entry.id);
        const keysToInvalidate = INVALIDATIONS[entry.kind] ?? [];
        for (const k of keysToInvalidate) qc.invalidateQueries({ queryKey: [k] });
      } else {
        await queue.update(entry.id, {
          status: "failed",
          attempts: (entry.attempts ?? 0) + 1,
          error: errMsg,
        });
      }
    }
  }
}
