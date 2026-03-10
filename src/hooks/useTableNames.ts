import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TableNamesMap = Record<string, string>; // { "1": "Terraza", "2": "Barra", ... }

export const useTableNames = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["table_names"],
    queryFn: async (): Promise<TableNamesMap> => {
      const { data } = await supabase
        .from("restaurant_settings")
        .select("value")
        .eq("key", "table_names")
        .maybeSingle();
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
      // Upsert: try update first, insert if not exists
      const { data: existing } = await supabase
        .from("restaurant_settings")
        .select("id")
        .eq("key", "table_names")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("restaurant_settings")
          .update({ value })
          .eq("key", "table_names");
      } else {
        await supabase
          .from("restaurant_settings")
          .insert({ key: "table_names", value });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table_names"] });
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
