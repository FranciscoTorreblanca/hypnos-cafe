import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type TableNamesMap = Record<string, string>; // { "1": "Terraza", "2": "Barra", ... }

export const useTableNames = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["table_names"],
    queryFn: async (): Promise<TableNamesMap> => {
      const { data, error } = await supabase
        .from("restaurant_settings")
        .select("value")
        .eq("key", "table_names")
        .maybeSingle();
      if (error) {
        console.error("Failed to load table names:", error);
        throw error;
      }
      if (data?.value) {
        try {
          return JSON.parse(data.value);
        } catch {
          return {};
        }
      }
      return {};
    },
  });

  const updateNames = useMutation({
    mutationFn: async (names: TableNamesMap) => {
      const value = JSON.stringify(names);
      const { data: existing } = await supabase
        .from("restaurant_settings")
        .select("id")
        .eq("key", "table_names")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("restaurant_settings")
          .update({ value })
          .eq("key", "table_names");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("restaurant_settings")
          .insert({ key: "table_names", value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table_names"] });
    },
    onError: (error: any) => {
      console.error("Table names update failed:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo guardar la mesa. Verifica tus permisos.",
        variant: "destructive",
      });
    },
  });

  const getTableName = (num: number): string => {
    return query.data?.[String(num)] || "";
  };

  const getTableLabel = (num: number): string => {
    const custom = query.data?.[String(num)];
    return custom || String(num);
  };

  return {
    tableNames: query.data ?? {},
    isLoading: query.isLoading,
    getTableName,
    getTableLabel,
    updateNames,
  };
};
