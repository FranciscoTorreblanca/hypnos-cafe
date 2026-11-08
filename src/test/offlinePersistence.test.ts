import { describe, expect, it, vi } from "vitest";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

const storage = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }));
vi.mock("@/offline/idbStorage", () => ({ idbKVStorage: storage }));
import { createIdbPersister } from "@/offline/persister";

describe("confirmed offline report cache", () => {
  it("preserves confirmed data and excludes serialized pending promises", async () => {
    storage.getItem.mockResolvedValue(JSON.stringify({
      timestamp: 1, buster: "test", clientState: { mutations: [], queries: [
        { queryKey: ["payments"], state: { status: "pending" }, promise: {} },
        { queryKey: ["till-balance"], state: { status: "success", data: 853 }, promise: {} },
      ] },
    }));
    const result = await createIdbPersister().restoreClient() as PersistedClient;
    expect(result.clientState.queries).toHaveLength(1);
    expect(result.clientState.queries[0].state.data).toBe(853);
    expect(result.clientState.queries[0]).not.toHaveProperty("promise");
  });
});