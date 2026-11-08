import { describe, expect, it } from "vitest";
import { fetchAllPages } from "@/lib/fetchAllPages";

describe("complete filtered datasets", () => {
  it("retrieves all 2501 records instead of the first 1000", async () => {
    const records = Array.from({ length: 2501 }, (_, id) => ({ id, amount: 2 }));
    const result = await fetchAllPages(async (from, to) => ({ data: records.slice(from, to + 1), error: null }));
    expect(result).toHaveLength(2501);
    expect(result.reduce((sum, r) => sum + r.amount, 0)).toBe(5002);
    expect(new Set(result.map(r => r.id)).size).toBe(2501);
  });
  it("does not truncate when the server uses a smaller cap", async () => {
    const records = Array.from({ length: 1201 }, (_, id) => id);
    expect(await fetchAllPages(async (from) => ({ data: records.slice(from, from + 500), error: null }))).toEqual(records);
  });
  it("rejects a failed later page instead of returning partial totals", async () => {
    await expect(fetchAllPages(async (from) => from === 0
      ? { data: [1], error: null } : { data: null, error: new Error("Unavailable") })).rejects.toThrow("Unavailable");
  });
  it("stops obsolete requests when their view is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await expect(fetchAllPages(async () => { calls++; return { data: [], error: null }; }, controller.signal)).rejects.toThrow();
    expect(calls).toBe(0);
  });
});