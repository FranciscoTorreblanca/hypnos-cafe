import { queue, log, type QueueEntry, type QueueEntryKind } from "./idbStorage";
import { runSync } from "./syncRunner";
import type { QueryClient } from "@tanstack/react-query";

let _qc: QueryClient | null = null;
export function bindQueryClient(qc: QueryClient) { _qc = qc; }

export async function enqueue(
  kind: QueueEntryKind,
  payload: any,
  opts: { id?: string; label?: string; dependsOn?: string[] } = {}
): Promise<string> {
  const id = opts.id ?? crypto.randomUUID();
  const entry: QueueEntry = {
    id, kind, payload,
    status: "pending",
    createdAt: Date.now(),
    attempts: 0,
    dependsOn: opts.dependsOn,
    label: opts.label ?? kind,
  };
  await queue.add(entry);
  window.dispatchEvent(new Event("hypnos:queue-changed"));
  // Try to drain immediately if online
  if (navigator.onLine && _qc) {
    runSync(_qc).then(() => window.dispatchEvent(new Event("hypnos:queue-changed")));
  }
  return id;
}

export { queue, log };
