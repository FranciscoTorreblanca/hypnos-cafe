import { get, set, del, keys, createStore, getMany } from "idb-keyval";

// idb-keyval's createStore opens a DB at version 1 with a single object store.
// Calling it multiple times against the same DB name only creates the FIRST store,
// later calls open the same v1 DB and the requested store is missing -> NotFoundError.
// Use a separate DB per logical store to avoid that.
export const rqStore = createStore("hypnos-offline-rq", "rq-cache");
export const queueStore = createStore("hypnos-offline-queue", "mutation-queue");
export const logStore = createStore("hypnos-offline-log", "sync-log");

export type QueueEntryKind =
  | "order.create"
  | "order.updateStatus"
  | "order.updateGeneralDiscount"
  | "order.updateGeneralDiscountAmount"
  | "order.cancel"
  | "order_item.insert"
  | "order_item.insertBulk"
  | "order_item.updateStatus"
  | "order_item.remove"
  | "order_item.updateDiscount"
  | "order_item.updateDiscountAmount"
  | "payment.create"
  | "till.open"
  | "till.close"
  | "attendance.check_in"
  | "attendance.check_out";

export type QueueStatus = "pending" | "syncing" | "failed" | "synced" | "discarded";

export interface QueueEntry {
  id: string;            // local uuid
  kind: QueueEntryKind;
  payload: any;
  status: QueueStatus;
  createdAt: number;
  attempts: number;
  error?: string | null;
  dependsOn?: string[];  // other queue.id that must succeed first
  label: string;         // human-readable target description
}

export const queue = {
  async list(): Promise<QueueEntry[]> {
    const ks = await keys(queueStore);
    if (!ks.length) return [];
    const values = await getMany(ks, queueStore);
    return (values.filter(Boolean) as QueueEntry[]).sort((a, b) => a.createdAt - b.createdAt);
  },
  async add(entry: QueueEntry) { await set(entry.id, entry, queueStore); },
  async update(id: string, patch: Partial<QueueEntry>) {
    const cur = (await get(id, queueStore)) as QueueEntry | undefined;
    if (!cur) return;
    await set(id, { ...cur, ...patch }, queueStore);
  },
  async remove(id: string) { await del(id, queueStore); },
  async clear() {
    const ks = await keys(queueStore);
    await Promise.all(ks.map((k) => del(k, queueStore)));
  },
};

export const log = {
  async list(): Promise<QueueEntry[]> {
    const ks = await keys(logStore);
    if (!ks.length) return [];
    const values = await getMany(ks, logStore);
    return (values.filter(Boolean) as QueueEntry[]).sort((a, b) => b.createdAt - a.createdAt).slice(0, 500);
  },
  async push(entry: QueueEntry) { await set(entry.id, entry, logStore); },
  async clearSynced() {
    const ks = await keys(logStore);
    const values = await getMany(ks, logStore);
    await Promise.all(
      (values as QueueEntry[]).map((e, i) =>
        e && e.status === "synced" ? del(ks[i], logStore) : Promise.resolve()
      )
    );
  },
};

// RQ persister-friendly storage (key -> string)
export const idbKVStorage = {
  getItem: async (key: string): Promise<string | null> => ((await get(key, rqStore)) as string | undefined) ?? null,
  setItem: async (key: string, value: string): Promise<void> => { await set(key, value, rqStore); },
  removeItem: async (key: string): Promise<void> => { await del(key, rqStore); },
};
