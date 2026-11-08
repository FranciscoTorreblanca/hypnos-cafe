import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import type { Persister, PersistedClient } from "@tanstack/react-query-persist-client";
import { idbKVStorage } from "./idbStorage";

const KEY = "hypnos-rq-cache";

export function createIdbPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await idbKVStorage.setItem(KEY, JSON.stringify(client));
    },
    restoreClient: async () => {
      const raw = await idbKVStorage.getItem(KEY);
      if (!raw) return undefined;
      try {
        const restored = JSON.parse(raw) as PersistedClient;
        // JSON cannot restore a dehydrated Promise. Older caches may contain
        // pending requests; retain only confirmed query data.
        restored.clientState.queries = restored.clientState.queries
          .filter(q => q.state.status === "success")
          .map(q => { const { promise, ...confirmed } = q; return confirmed; });
        return restored;
      } catch { return undefined; }
    },
    removeClient: async () => {
      await idbKVStorage.removeItem(KEY);
    },
  };
}

// Queries we want to KEEP cached for offline use
const OFFLINE_QUERY_KEYS = new Set([
  "menu_items",
  "menu_categories",
  "combos",
  "menu_item_addons",
  "tables",
  "orders",
  "payments",
  "budget-summary",
  "till-balance",
  "till_session",
  "till_sessions",
  "till_x_report",
  "till_transactions",
  "user_shift_schedules",
  "attendance",
  "business_features",
  "restaurant_settings",
]);

export function installPersistence(queryClient: QueryClient, version: string) {
  const persister = createIdbPersister();
  persistQueryClient({
    queryClient: queryClient as any,
    persister,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    buster: version,
    dehydrateOptions: {
      shouldDehydrateQuery: (q) => {
        const root = q.queryKey?.[0];
        return q.state.status === "success" && typeof root === "string" && OFFLINE_QUERY_KEYS.has(root);
      },
    },
  });
}
