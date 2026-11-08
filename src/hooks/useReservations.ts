import { fetchAllPages } from "@/lib/fetchAllPages";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ReservationStatus = Database["public"]["Enums"]["reservation_status"];

export interface Reservation {
  id: string;
  event_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_instagram: string;
  party_size: number;
  reserved_for: string;
  table_number: number | null;
  status: ReservationStatus;
  deposit_amount: number;
  deposit_paid: boolean;
  deposit_method: string;
  deposit_reference: string;
  special_requests: string;
  notes: string;
  reminder_sent: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const useReservations = (eventId?: string | null) => {
  const qc = useQueryClient();

  const reservations = useQuery({
    queryKey: ["reservations", eventId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("reservations").select("*").order("reserved_for", { ascending: true });
      if (eventId) q = q.eq("event_id", eventId);
      const data = await fetchAllPages((from, to) => q.order("id").range(from, to));
      return (data ?? []) as Reservation[];
    },
  });

  const createReservation = useMutation({
    mutationFn: async (
      payload: Partial<Reservation> & { customer_name: string; reserved_for: string; party_size: number },
    ) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("reservations")
        .insert({ ...payload, created_by: auth.user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as Reservation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });

  const updateReservation = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Reservation> & { id: string }) => {
      const { data, error } = await supabase
        .from("reservations")
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Reservation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });

  const deleteReservation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reservations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });

  return { ...reservations, createReservation, updateReservation, deleteReservation };
};
