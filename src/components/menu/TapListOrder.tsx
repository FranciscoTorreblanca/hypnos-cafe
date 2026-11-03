import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { itemDisplayName } from "@/hooks/useMenuItems";
import { useTvIntegration, useTvSync } from "@/hooks/useHypnosTv";

interface TapItem { id: string; name: string; beer_brewery: string | null; is_available: boolean; tap_position: number | null; beer_style: string | null }

const Row = ({ item, line, es, disabled }: { item: TapItem; line: number | null; es: boolean; disabled: boolean }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md border bg-card p-2 ${isDragging ? "shadow-lg z-10 relative" : ""} ${item.is_available ? "" : "opacity-50"}`}>
      <Button type="button" variant="ghost" size="icon" disabled={disabled} {...attributes} {...listeners} className="touch-none shrink-0 text-muted-foreground cursor-grab" aria-label={`${es ? "Reordenar" : "Reorder"} ${itemDisplayName(item)}`} title={es ? "Reordenar" : "Reorder"}>
        <GripVertical className="h-4 w-4" />
      </Button>
      <span className="w-6 text-center font-mono text-xs text-muted-foreground">{line ?? "—"}</span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium">{itemDisplayName(item)}</p>
        {item.beer_style && <p className="truncate text-xs text-muted-foreground">{item.beer_style}</p>}
      </div>
      {!item.is_available && <Badge variant="outline" className="text-[10px] shrink-0">{es ? "Oculto" : "Hidden"}</Badge>}
    </li>
  );
};

export const TapListOrder = ({ categoryId, es }: { categoryId: string; es: boolean }) => {
  const { currentBusinessId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: cfg } = useTvIntegration();
  const sync = useTvSync();
  const [saving, setSaving] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["tap-list-order", currentBusinessId, categoryId],
    enabled: !!currentBusinessId,
    queryFn: async () => {
      if (!currentBusinessId) return [];
      const { data, error } = await supabase.from("menu_items")
        .select("id,name,beer_brewery,is_available,tap_position,beer_style")
        .eq("business_id", currentBusinessId).eq("category_id", categoryId)
        .order("tap_position", { ascending: true, nullsFirst: false }).order("name");
      if (error) throw error;
      return data as TapItem[];
    },
  });
  const [items, setItems] = useState<TapItem[]>([]);
  useEffect(() => setItems(data), [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id || saving || !currentBusinessId) return;
    const overId = e.over.id;
    const from = items.findIndex((i) => i.id === e.active.id);
    const to = items.findIndex((i) => i.id === overId);
    if (from < 0 || to < 0) return;
    const prev = items;
    const next = arrayMove(items, from, to);
    setItems(next);
    setSaving(true);
    try {
      const results = await Promise.all(next.map((it, idx) =>
        supabase.from("menu_items").update({ tap_position: idx + 1 }).eq("business_id", currentBusinessId).eq("category_id", categoryId).eq("id", it.id)));
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
      // menu_items invalidation triggers the debounced TV auto-sync
      await qc.invalidateQueries({ queryKey: ["menu_items"] });
      await qc.invalidateQueries({ queryKey: ["tap-list-order"] });
      toast({ title: es ? "Orden guardado" : "Order saved" });
    } catch (err: any) {
      setItems(prev);
      toast({ title: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  let line = 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium">{es ? "Orden en la TV" : "TV order"}</p>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Button size="sm" variant="outline" disabled={saving || sync.isPending || !cfg?.enabled || !cfg.has_api_key}
          onClick={() => sync.mutate(undefined, {
            onSuccess: () => toast({ title: es ? "Lista enviada a la TV" : "Tap list sent to TV" }),
            onError: (error) => toast({ title: error.message, variant: "destructive" }),
          })}>
          {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {es ? "Sincronizar ahora" : "Sync now"}
        </Button>
      </div>
      {cfg?.last_synced_at && <p className="text-xs text-muted-foreground">{es ? "Última sincronización" : "Last synced"}: {new Date(cfg.last_synced_at).toLocaleString()}</p>}
      {cfg?.last_sync_error && <p className="text-xs text-destructive break-words">{cfg.last_sync_error}</p>}
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{es ? "No hay artículos en esta categoría." : "No items in this category."}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5">
              {items.map((it) => <Row key={it.id} item={it} line={it.is_available ? ++line : null} es={es} disabled={saving} />)}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};
