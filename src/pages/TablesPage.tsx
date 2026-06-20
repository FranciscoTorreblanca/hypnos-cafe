import { useState, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { applyLineDiscount, applyGeneralDiscount } from "@/lib/discounts";
import { useOrders, OrderItem } from "@/hooks/useOrders";
import { useTableNames } from "@/hooks/useTableNames";
import { groupOrderItems } from "@/utils/groupOrderItems";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrderDialog } from "@/components/orders/OrderDialog";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  CircleDollarSign,
  Trash2,
  Package,
  GripVertical,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Sortable Table Card ───
interface TableData {
  number: number;
  order: ReturnType<typeof useOrders>["data"] extends (infer T)[] ? T : never;
  subOrders?: ReturnType<typeof useOrders>["data"];
}

interface SortableTableCardProps {
  table: TableData;
  status: string;
  statusConfig: Record<string, { color: string; icon: React.ReactNode }>;
  label: string;
  isExpanded: boolean;
  language: string;
  t: (key: any) => string;
  onToggleExpand: (num: number) => void;
  onOpenTable: (num: number) => void;
  onOpenSubOrder: (orderId: string, tableNum: number) => void;
  onDeleteTable: (num: number) => void;
}

const SortableTableCard = ({
  table,
  status,
  statusConfig,
  label,
  isExpanded,
  language,
  t,
  onToggleExpand,
  onOpenTable,
  onOpenSubOrder,
  onDeleteTable,
}: SortableTableCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: table.number });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const config = statusConfig[status];
  const items = table.order?.order_items ?? [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden"
    >
      {/* Main row */}
      <div className="flex items-center gap-2 p-3">
        {/* Drag handle */}
        <button
          className="shrink-0 touch-none p-1 -m-1 text-muted-foreground/50 hover:text-muted-foreground active:text-foreground cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Status indicator dot */}
        <div
          className={`shrink-0 w-2.5 h-10 rounded-full ${
            status === "available"
              ? "bg-emerald-500"
              : status === "occupied"
              ? "bg-amber-500"
              : status === "ready"
              ? "bg-blue-500"
              : "bg-purple-500"
          }`}
        />

        {/* Info */}
        <div
          className="flex-1 min-w-0"
          onClick={() =>
            table.order
              ? onToggleExpand(table.number)
              : onOpenTable(table.number)
          }
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{label}</span>
            <Badge
              className={`${config.color} text-[10px] gap-1 px-1.5 py-0`}
              variant="outline"
            >
              {config.icon}
              {t(`tables.${status}` as any)}
            </Badge>
          </div>

          {table.order && (
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              <span>{items.length} items</span>
              {(() => {
                const gd = (table.order as any)?.general_discount ?? 0;
                const gda = (table.order as any)?.general_discount_amount ?? 0;
                const subtotal = table.order!.total;
                const finalTotal = applyGeneralDiscount(subtotal, gd, gda);
                const hasDisc = gd > 0 || gda > 0;
                return (
                  <span className="font-medium text-foreground">
                    {hasDisc && (
                      <span className="line-through text-muted-foreground mr-1">
                        ${subtotal.toFixed(0)}
                      </span>
                    )}
                    ${finalTotal.toFixed(0)}
                  </span>
                );
              })()}
              {((table.order as any)?.general_discount ?? 0) > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">
                  -{(table.order as any).general_discount}%
                </span>
              )}
              {((table.order as any)?.general_discount_amount ?? 0) > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">
                  -${((table.order as any).general_discount_amount).toFixed(0)}
                </span>
              )}
              {items.some((i) => (i.discount ?? 0) > 0 || ((i as any).discount_amount ?? 0) > 0) && (
                <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">
                  {t("tables.hasDiscount")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {table.order && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onToggleExpand(table.number)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant={table.order ? "outline" : "default"}
            className="h-8 text-xs px-3"
            onClick={() => onOpenTable(table.number)}
          >
            {table.order ? t("orders.viewOrder") : t("orders.newOrder")}
          </Button>
          {(!table.order || items.length === 0 || (table.order?.total ?? 0) === 0) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDeleteTable(table.number)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Expanded order details */}
      {isExpanded && table.order && (
        <div
          className="border-t bg-muted/30 px-3 py-2 space-y-1 animate-in slide-in-from-top-1 duration-150"
          data-vaul-no-drag
        >
          {(() => {
            const renderItem = (item: OrderItem) => {
              const discPct = item.discount ?? 0;
              const discAmt = (item as any).discount_amount ?? 0;
              const hasDiscount = discPct > 0 || discAmt > 0;
              const gross = item.quantity * item.unit_price;
              const itemTotal = applyLineDiscount(gross, discPct, discAmt);
              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between text-xs py-1"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">
                        {item.quantity}×
                      </span>
                      <span className="truncate">
                        {item.menu_item?.name || "—"}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 ${
                          item.status === "ready"
                            ? "border-blue-300 text-blue-700 dark:text-blue-300"
                            : item.status === "pending"
                            ? "border-amber-300 text-amber-700 dark:text-amber-300"
                            : "border-muted text-muted-foreground"
                        }`}
                      >
                        {item.status}
                      </Badge>
                    </div>
                    {item.notes && (
                      <p className="text-[10px] text-muted-foreground ml-5 italic">
                        {item.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    {hasDiscount ? (
                      <div>
                        <span className="line-through text-muted-foreground mr-1">
                          ${gross.toFixed(0)}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ${itemTotal.toFixed(0)}
                        </span>
                        {discPct > 0 && (
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 ml-0.5">
                            -{discPct}%
                          </span>
                        )}
                        {discAmt > 0 && (
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 ml-0.5">
                            -${discAmt.toFixed(0)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span>${itemTotal.toFixed(0)}</span>
                    )}
                  </div>
                </div>
              );
            };

            const grouped = groupOrderItems(items);
            return grouped.map((entry) => {
              if (entry.type === "combo") {
                const { group } = entry;
                const comboLabel =
                  language === "es" ? group.comboName : group.comboNameEn;
                return (
                  <div
                    key={group.comboGroupId}
                    className="border rounded p-1.5 bg-muted/20 space-y-0.5"
                  >
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3 text-primary" />
                      <span className="text-[10px] font-semibold text-primary">
                        {comboLabel}
                      </span>
                    </div>
                    {group.items.map((item) => renderItem(item))}
                  </div>
                );
              }
              return renderItem(entry.item);
            });
          })()}
          {/* Total row */}
          {(() => {
            const gd = (table.order as any)?.general_discount ?? 0;
            const gda = (table.order as any)?.general_discount_amount ?? 0;
            const subtotal = table.order!.total;
            const finalTotal = applyGeneralDiscount(subtotal, gd, gda);
            const hasDisc = gd > 0 || gda > 0;
            return (
              <div className="flex justify-between pt-1 border-t text-xs font-medium">
                <span>{t("billing.total")}</span>
                <span>
                  {hasDisc && (
                    <span className="line-through text-muted-foreground mr-1">
                      ${subtotal.toFixed(0)}
                    </span>
                  )}
                  ${finalTotal.toFixed(0)}
                  {gd > 0 && (
                    <span className="text-emerald-600 ml-0.5 text-[10px]">
                      -{gd}%
                    </span>
                  )}
                  {gda > 0 && (
                    <span className="text-emerald-600 ml-0.5 text-[10px]">
                      -${gda.toFixed(0)}
                    </span>
                  )}
                </span>
              </div>
            );
          })()}
        </div>
      )}
      {/* Sub-orders (splits) */}
      {table.subOrders && table.subOrders.length > 0 && (
        <div className="border-t bg-muted/20 px-3 py-2 space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            {t("orders.subOrder")}s
          </p>
          {table.subOrders.map((sub, idx) => {
            const subItems = sub?.order_items ?? [];
            const subTotal = sub?.total ?? 0;
            const isReady = sub?.status === "ready";
            const isServed = sub?.status === "served";
            return (
              <div
                key={sub!.id}
                className="flex items-center gap-2 rounded border bg-card px-2 py-1.5 cursor-pointer hover:bg-accent/50"
                onClick={() => onOpenSubOrder(sub!.id, table.number)}
              >
                <div
                  className={`shrink-0 w-1.5 h-6 rounded-full ${
                    isReady ? "bg-blue-500" : isServed ? "bg-purple-500" : "bg-amber-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium">
                    {t("orders.subOrder")} #{idx + 1}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {subItems.length} items · {t(`orders.${sub!.status as any}` as any) || sub!.status}
                  </div>
                </div>
                <div className="text-xs font-semibold">${subTotal.toFixed(0)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ───
const TablesPage = () => {
  const { t, language } = useLanguage();
  const { data: orders = [], cancelOrder } = useOrders();
  const { tableNames, tableOrder, getTableLabel, updateNames, updateOrder } =
    useTableNames();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<number>(1);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<number | null>(null);
  const [showNewTable, setShowNewTable] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [deleteTableNum, setDeleteTableNum] = useState<number | null>(null);

  // Build list of active tables
  const activeOrders = (orders ?? []).filter(
    (o) => !["paid", "cancelled"].includes(o.status)
  );

  const tableNumbersSet = new Set<number>();
  activeOrders.forEach((o) => tableNumbersSet.add(o.table_number));
  Object.keys(tableNames).forEach((k) => {
    if (tableNames[k]) tableNumbersSet.add(Number(k));
  });

  const allTableNums = Array.from(tableNumbersSet);

  // Sort by saved order, then any new ones at the end by number
  const sortedTableNumbers = (() => {
    const ordered: number[] = [];
    const remaining = new Set(allTableNums);

    for (const num of tableOrder) {
      if (remaining.has(num)) {
        ordered.push(num);
        remaining.delete(num);
      }
    }
    // Append any tables not in the saved order
    const rest = Array.from(remaining).sort((a, b) => a - b);
    return [...ordered, ...rest];
  })();

  const tables = sortedTableNumbers.map((num) => {
    const activeOrder = activeOrders.find((o) => o.table_number === num);
    return { number: num, order: activeOrder };
  });

  const getStatus = (table: (typeof tables)[0]) => {
    if (!table.order) return "available";
    if (table.order.status === "ready") return "ready";
    if (table.order.status === "served") return "served";
    return "occupied";
  };

  const statusConfig: Record<
    string,
    { color: string; icon: React.ReactNode }
  > = {
    available: {
      color:
        "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    occupied: {
      color:
        "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
      icon: <Clock className="h-3.5 w-3.5" />,
    },
    ready: {
      color:
        "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
      icon: <UtensilsCrossed className="h-3.5 w-3.5" />,
    },
    served: {
      color:
        "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700",
      icon: <CircleDollarSign className="h-3.5 w-3.5" />,
    },
  };

  const openTable = (num: number) => {
    setSelectedTable(num);
    setDialogOpen(true);
  };

  const toggleExpand = (num: number) => {
    setExpandedTable((prev) => (prev === num ? null : num));
  };

  const handleAddTable = () => {
    if (!newTableName.trim()) return;
    const allNums = [...allTableNums, 0];
    const nextNum = Math.max(...allNums) + 1;
    const updated = { ...tableNames, [String(nextNum)]: newTableName.trim() };
    updateNames.mutate(updated);
    // Add to end of order
    updateOrder.mutate([...sortedTableNumbers, nextNum]);
    setNewTableName("");
    setShowNewTable(false);
  };

  const handleDeleteTable = async (num: number) => {
    // If table has an empty/zero-total order, cancel it first so the table can be freed
    const lingering = activeOrders.find((o) => o.table_number === num);
    if (lingering) {
      try {
        await cancelOrder.mutateAsync({ id: lingering.id, reason: "Table deleted" });
      } catch (e) {
        console.error("Failed to cancel lingering order:", e);
      }
    }
    const updated = { ...tableNames };
    delete updated[String(num)];
    updateNames.mutate(updated);
    updateOrder.mutate(sortedTableNumbers.filter((n) => n !== num));
    setDeleteTableNum(null);
  };

  // DnD sensors — touch with activation delay to distinguish tap from drag
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedTableNumbers.indexOf(Number(active.id));
      const newIndex = sortedTableNumbers.indexOf(Number(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(sortedTableNumbers, oldIndex, newIndex);
      updateOrder.mutate(newOrder);
    },
    [sortedTableNumbers, updateOrder]
  );

  const activeOrder = (orders ?? []).find(
    (o) =>
      o.table_number === selectedTable &&
      !["paid", "cancelled"].includes(o.status)
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("tables.title")}
        </h1>
        <Button
          size="sm"
          onClick={() => setShowNewTable(!showNewTable)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span>{t("tables.addTable")}</span>
        </Button>
      </div>

      {/* New table input */}
      {showNewTable && (
        <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
          <Input
            autoFocus
            placeholder={t("tables.newTablePlaceholder")}
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTable()}
            className="h-9"
          />
          <Button
            size="sm"
            onClick={handleAddTable}
            disabled={!newTableName.trim()}
          >
            {t("common.add")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowNewTable(false);
              setNewTableName("");
            }}
          >
            {t("common.cancel")}
          </Button>
        </div>
      )}

      {/* Empty state */}
      {tables.length === 0 && !showNewTable && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <UtensilsCrossed className="h-10 w-10 opacity-40" />
          <p className="text-sm">{t("tables.empty")}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNewTable(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("tables.addFirst")}
          </Button>
        </div>
      )}

      {/* Draggable table list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedTableNumbers}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {tables.map((table) => (
              <SortableTableCard
                key={table.number}
                table={table as any}
                status={getStatus(table)}
                statusConfig={statusConfig}
                label={getTableLabel(table.number)}
                isExpanded={expandedTable === table.number}
                language={language}
                t={t}
                onToggleExpand={toggleExpand}
                onOpenTable={openTable}
                onDeleteTable={(num) => setDeleteTableNum(num)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Order Dialog */}
      <OrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tableNumber={selectedTable}
        tableName={getTableLabel(selectedTable)}
        order={activeOrder}
      />

      {/* Delete table confirmation */}
      <AlertDialog
        open={deleteTableNum !== null}
        onOpenChange={() => setDeleteTableNum(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tables.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTableNum !== null && getTableLabel(deleteTableNum)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTableNum !== null && handleDeleteTable(deleteTableNum)
              }
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TablesPage;
