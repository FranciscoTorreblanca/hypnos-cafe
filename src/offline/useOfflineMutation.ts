import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { enqueue } from "@/offline/enqueue";
import type { QueueEntryKind } from "@/offline/idbStorage";
import { useOffline } from "@/offline/OfflineProvider";

/**
 * Offline-capable mutation.
 * - Runs `optimistic(qc, vars)` immediately to update the cache.
 * - Always enqueues the mutation so it survives a refresh / offline session.
 * - The sync runner drains the queue when online.
 */
export interface OfflineMutationOpts<TVars> {
  kind: QueueEntryKind;
  buildPayload: (vars: TVars) => any;
  label: (vars: TVars) => string;
  optimistic?: (qc: ReturnType<typeof useQueryClient>, vars: TVars) => void | Promise<void>;
  dependsOn?: (vars: TVars) => string[] | undefined;
  /** Optional client-side id, returned from build, used as queue entry id */
  entryId?: (vars: TVars) => string | undefined;
  /** Optional toast on enqueue */
  onEnqueued?: (vars: TVars) => void;
}

export function useOfflineMutation<TVars>(opts: OfflineMutationOpts<TVars>) {
  const qc = useQueryClient();
  const { online } = useOffline();

  const m = useMutation({
    mutationFn: async (vars: TVars) => {
      if (opts.optimistic) await opts.optimistic(qc, vars);
      const id = await enqueue(opts.kind, opts.buildPayload(vars), {
        id: opts.entryId?.(vars),
        label: opts.label(vars),
        dependsOn: opts.dependsOn?.(vars),
      });
      opts.onEnqueued?.(vars);
      return { queued_id: id, online };
    },
  });
  return m;
}
