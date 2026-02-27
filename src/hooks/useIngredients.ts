import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  unit_cost: number;
  presentation_qty: number;
  presentation_cost: number;
  provider_link: string;
  notes: string;
}

export const useIngredients = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ingredients").select("*").order("name");
      if (error) throw error;
      return data as Ingredient[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (item: Partial<Ingredient> & { name: string }) => {
      // Auto-calculate unit_cost from presentation
      const payload = { ...item };
      if (payload.presentation_qty && payload.presentation_cost) {
        payload.unit_cost = payload.presentation_cost / payload.presentation_qty;
      }
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("ingredients").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ingredients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ingredients"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ingredients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ingredients"] }),
  });

  return { ...query, upsert, remove };
};
