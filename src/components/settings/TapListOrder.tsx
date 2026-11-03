import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface TapItem { id: string; name: string; is_available: boolean; tap_position: number | null; beer_style: string | null }

const Row = ({ item, line }: { item: TapItem; line: number | null }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md border bg-card p-2 ${isDragging ? "shadow-lg z-10 relative" : ""} ${item.is_available ? "" : "opacity-50"}`}>
      <button type="button" {...attributes} {...listeners} className="touch-none p-1 text-muted-foreground cursor-grab" aria-label="Reordenar">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-6 text-center font-mono text-xs text-muted-foreground">{line ?? "—"}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        {item.beer_style && <p className="truncate text-xs text-muted-foreground">{item.beer_style}</p>}
      </div>
      {!item.is_available && <Badge variant="outline" className="text-[10px]">Oculto</Badge>}
    </li>
  );
};

export const TapListOrder = ({ categoryId, es }: { categoryId: string; es: boolean }) => {
  const { currentBusinessId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["tap-list-order", currentBusinessId, categoryId],
    enabled: !!currentBusinessId,
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items")
        .select("id,name,is_available,tap_position,beer_style")
        .eq("business_id", currentBusinessId!).eq("category_id", categoryId)
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
    if (!e.over || e.active.id === e.over.id) return;
    const prev = items;
    const next = arrayMove(items, items.findIndex((i) => i.id === e.active.id), items.findIndex((i) => i.id === e.over!.id));
    setItems(next);
    setSaving(true);
    try {
      const results = await Promise.all(next.map((it, idx) =>
        supabase.from("menu_items").update({ tap_position: idx + 1 }).eq("id", it.id)));
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
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{es ? "Orden en la TV" : "TV order"}</p>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground">{es ? "Arrastra para cambiar el número de línea." : "Drag to change the line number."}</p>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{es ? "No hay artículos en esta categoría." : "No items in this category."}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5">
              {items.map((it) => <Row key={it.id} item={it} line={it.is_available ? ++line : null} />)}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};
