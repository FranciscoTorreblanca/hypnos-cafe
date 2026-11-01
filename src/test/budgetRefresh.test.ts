import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { installBudgetRefresh } from "@/lib/budgetRefresh";

describe("confirmed financial summaries", () => {
  it("invalidates the Budget and Till summaries after payment source invalidation", async () => {
    const client = new QueryClient();
    const stop = installBudgetRefresh(client);
    client.setQueryData(["budget-summary", "hypnos", "admin"], { cash: 853 });
    client.setQueryData(["till-balance", "hypnos", "admin"], 853);
    client.setQueryData(["payments"], []);
    await client.invalidateQueries({ queryKey: ["payments"] });
    expect(client.getQueryState(["budget-summary", "hypnos", "admin"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["till-balance", "hypnos", "admin"])?.isInvalidated).toBe(true);
    expect(client.getQueryData(["budget-summary", "hypnos", "admin"])).toEqual({ cash: 853 });
    stop(); client.clear();
  });

  it("refreshes summaries on successful writes even without a cached source list", async () => {
    const client = new QueryClient();
    const stop = installBudgetRefresh(client);
    client.setQueryData(["budget-summary", "hypnos", "admin"], { cash: 853 });
    const mutation = client.getMutationCache().build(client, { mutationFn: vi.fn(async () => 1) });
    await mutation.execute(undefined);
    expect(client.getQueryState(["budget-summary", "hypnos", "admin"])?.isInvalidated).toBe(true);
    stop(); client.clear();
  });
});