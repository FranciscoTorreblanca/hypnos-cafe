import { fetchAllPages } from "@/lib/fetchAllPages";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type EventType = Database["public"]["Enums"]["event_type"];
export type EventStatus = Database["public"]["Enums"]["event_status"];

export interface CalendarEvent {
  id: string;
  name: string;
  description: string;
  event_type: EventType;
  status: EventStatus;
  color: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string;
  instagram_url: string;
  cover_image_url: string | null;
  capacity: number | null;
  cover_charge: number;
  notes: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventCostItem {
  id: string;
  event_id: string;
  category_key: string | null;
  name: string;
  amount: number;
  notes: string;
  display_order: number;
  created_at: string;
}

export interface EventCostCategory {
  id: string;
  key: string;
  label: string;
  label_en: string;
  display_order: number;
}

export const useEvents = () => {
  const qc = useQueryClient();

  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const data = await fetchAllPages((from, to) => supabase
        .from("events")
        .select("*")
        .order("starts_at", { ascending: true }).order("id").range(from, to));
      return (data ?? []) as CalendarEvent[];
    },
  });

  const createEvent = useMutation({
    mutationFn: async (payload: Partial<CalendarEvent> & { name: string; starts_at: string; ends_at: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("events")
        .insert({ ...payload, created_by: auth.user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CalendarEvent> & { id: string }) => {
      const { data, error } = await supabase
        .from("events")
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
    },
  });

  return { ...events, createEvent, updateEvent, deleteEvent };
};

export const useEventCostCategories = () =>
  useQuery({
    queryKey: ["event_cost_categories"],
    queryFn: async () => {
      const data = await fetchAllPages((from, to) => supabase
        .from("event_cost_categories")
        .select("*")
        .order("display_order").order("id").range(from, to));
      return (data ?? []) as EventCostCategory[];
    },
  });

export const useEventCostItems = (eventId: string | null) => {
  const qc = useQueryClient();

  const items = useQuery({
    queryKey: ["event_cost_items", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const data = await fetchAllPages((from, to) => supabase
        .from("event_cost_items")
        .select("*")
        .eq("event_id", eventId)
        .order("display_order").order("id").range(from, to));
      return (data ?? []) as EventCostItem[];
    },
    enabled: !!eventId,
  });

  const addItem = useMutation({
    mutationFn: async (payload: Omit<EventCostItem, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("event_cost_items")
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data as EventCostItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_cost_items", eventId] }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<EventCostItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("event_cost_items")
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as EventCostItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_cost_items", eventId] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_cost_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_cost_items", eventId] }),
  });

  return { ...items, addItem, updateItem, deleteItem };
};
