import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TicketKind = "pre_payment" | "receipt";

export interface TicketSnapshotItem {
  name: string;
  quantity: number;
  /** Price actually charged per unit (already promo if applicable). */
  unit_price: number;
  /** Original list price BEFORE promo. Same as unit_price when no promo. */
  original_price?: number;
  /** Promo price if the item had one at the time of sale. */
  promo_price?: number | null;
  discount: number;
  notes?: string;
  /** When set, this item belongs to a combo group and its individual price is hidden in the ticket. */
  combo_group_id?: string | null;
  /** Combo display name (Spanish/English already resolved by builder). */
  combo_name?: string | null;
  /** Combo unit price at time of sale. The combo line shows this price (× combo quantity). */
  combo_unit_price?: number | null;
  /** How many combos this group represents (computed by builder). */
  combo_quantity?: number | null;
}

export interface TicketSnapshot {
  table_number: number;
  table_name?: string;
  waiter_name?: string;
  general_discount: number;
  /** IVA percentage included in prices (e.g. 16 for 16%). */
  tax_rate?: number;
  items: TicketSnapshotItem[];
}

export interface Ticket {
  id: string;
  public_id: string;
  order_id: string;
  payment_id: string | null;
  kind: TicketKind;
  paid_at: string | null;
  subtotal: number;
  tip: number;
  total: number;
  payment_method: string | null;
  snapshot: TicketSnapshot;
  requested_invoice: boolean;
  customer_rfc: string;
  customer_email_for_invoice: string;
  notes: string;
  created_by: string;
  created_at: string;
}

export interface TicketPrint {
  id: string;
  ticket_id: string;
  printed_by: string;
  printed_at: string;
  printer?: { full_name: string; email: string };
}

export const useTickets = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
  });

  const createTicket = useMutation({
    mutationFn: async (input: {
      order_id: string;
      payment_id?: string | null;
      kind: TicketKind;
      paid_at?: string | null;
      subtotal: number;
      tip: number;
      total: number;
      payment_method?: string | null;
      snapshot: TicketSnapshot;
    }) => {
      const { data, error } = await supabase
        .from("tickets" as any)
        .insert({
          order_id: input.order_id,
          payment_id: input.payment_id ?? null,
          kind: input.kind,
          paid_at: input.paid_at ?? null,
          subtotal: input.subtotal,
          tip: input.tip,
          total: input.total,
          payment_method: input.payment_method ?? null,
          snapshot: input.snapshot as any,
          created_by: user!.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as Ticket;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
  });

  const logPrint = useMutation({
    mutationFn: async (ticket_id: string) => {
      const { error } = await supabase
        .from("ticket_prints" as any)
        .insert({ ticket_id, printed_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket_prints"] }),
  });

  /**
   * Refresh a ticket's snapshot + totals + payment metadata from the latest order state.
   * Used right before (re)printing to guarantee the ticket reflects current order data.
   */
  const refreshTicket = useMutation({
    mutationFn: async (input: {
      id: string;
      subtotal: number;
      total: number;
      tip: number;
      payment_id?: string | null;
      payment_method?: string | null;
      paid_at?: string | null;
      kind?: TicketKind;
      snapshot: TicketSnapshot;
    }) => {
      const patch: any = {
        subtotal: input.subtotal,
        total: input.total,
        tip: input.tip,
        snapshot: input.snapshot as any,
      };
      if (input.payment_id !== undefined) patch.payment_id = input.payment_id;
      if (input.payment_method !== undefined) patch.payment_method = input.payment_method;
      if (input.paid_at !== undefined) patch.paid_at = input.paid_at;
      if (input.kind !== undefined) patch.kind = input.kind;
      const { data, error } = await supabase
        .from("tickets" as any)
        .update(patch)
        .eq("id", input.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as Ticket;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
  });

  /**
   * Returns the most recent ticket for an order (any kind), or null when none exist.
   * Used by Order History so old orders can be re-printed without creating duplicates.
   */
  const getLatestTicketForOrder = async (order_id: string): Promise<Ticket | null> => {
    const { data, error } = await supabase
      .from("tickets" as any)
      .select("*")
      .eq("order_id", order_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as Ticket | null;
  };

  return { ...query, createTicket, logPrint, getLatestTicketForOrder, refreshTicket };
};

export const useTicketPrints = (ticket_id: string | undefined) => {
  return useQuery({
    queryKey: ["ticket_prints", ticket_id],
    enabled: !!ticket_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_prints" as any)
        .select("*")
        .eq("ticket_id", ticket_id!)
        .order("printed_at", { ascending: false });
      if (error) throw error;
      const prints = (data ?? []) as unknown as TicketPrint[];
      const ids = [...new Set(prints.map((p) => p.printed_by))];
      if (ids.length === 0) return prints;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      return prints.map((p) => ({
        ...p,
        printer: (profs ?? []).find((pr: any) => pr.id === p.printed_by) as any,
      }));
    },
  });
};
