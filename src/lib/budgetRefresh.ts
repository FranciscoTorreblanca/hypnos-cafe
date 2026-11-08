import type { QueryClient } from "@tanstack/react-query";

export const FINANCIAL_QUERY_ROOTS = new Set([
  "orders", "menu_items", "payments", "budget-payments", "till_transactions", "till_session",
  "till_sessions", "expense-entries", "balance-adjustments",
  "recurring-expenses", "budget-categories", "delivery_platforms", "businesses",
]);

export function installBudgetRefresh(client: QueryClient) {
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["budget-summary"] });
    void client.invalidateQueries({ queryKey: ["till-balance"] });
    for (const root of ["performance-report", "performance-orders", "performance-payments", "item_sales_history", "cooking_stats", "order-history", "dashboard-payments-today", "dashboard-recent-orders", "dashboard-recent-payments", "dashboard-heatmap-payments"]) {
      void client.invalidateQueries({ queryKey: [root] });
    }
  };
  const unsubscribeQueries = client.getQueryCache().subscribe((event) => {
    if (event.type === "updated" && event.action.type === "invalidate" &&
        FINANCIAL_QUERY_ROOTS.has(String(event.query.queryKey[0]))) refresh();
  });
  // Covers successful writes even when their source lists have never been cached.
  const unsubscribeMutations = client.getMutationCache().subscribe((event) => {
    if (event.type === "updated" && event.action.type === "success") refresh();
  });
  return () => { unsubscribeQueries(); unsubscribeMutations(); };
}