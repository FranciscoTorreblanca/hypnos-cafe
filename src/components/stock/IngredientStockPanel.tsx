import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIngredients, Ingredient } from "@/hooks/useIngredients";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { normalizeSearch } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, PackagePlus, Play, Search, Square, XCircle, SlidersHorizontal } from "lucide-react";

type StockIngredient = Ingredient & { stock_qty: number | null; low_stock_threshold: number | null };

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString();

export const IngredientStockPanel = () => {
  const { language } = useLanguage();
  const es = language !== "en";
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data = [] } = useIngredients();
  const items = data as StockIngredient[];

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "tracked" | "low" | "out">("all");
  const [restock, setRestock] = useState<StockIngredient | null>(null);
  const [packs, setPacks] = useState("");
  const [extra, setExtra] = useState("");
  const [note, setNote] = useState("");
  const [adjust, setAdjust] = useState<StockIngredient | null>(null);
  const [adjQty, setAdjQty] = useState("");
  const [adjThr, setAdjThr] = useState("");
  const [busy, setBusy] = useState(false);

  const thr = (i: StockIngredient) => Number(i.low_stock_threshold ?? i.presentation_qty ?? 0);
  const status = (i: StockIngredient) => {
    if (i.stock_qty === null) return "none";
    if (i.stock_qty <= 0) return "out";
    if (thr(i) > 0 && i.stock_qty <= thr(i)) return "low";
    return "ok";
  };

  const tracked = items.filter((i) => i.stock_qty !== null);
  const low = tracked.filter((i) => status(i) === "low");
  const out = tracked.filter((i) => status(i) === "out");

  const list = useMemo(() => {
    let l = filter === "tracked" ? tracked : filter === "low" ? low : filter === "out" ? out : items;
    if (search.trim()) {
      const q = normalizeSearch(search);
      l = l.filter((i) => normalizeSearch(i.name).includes(q));
    }
    return l;
  }, [items, filter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => qc.invalidateQueries({ queryKey: ["ingredients"] });

  const setTracking = async (i: StockIngredient, on: boolean) => {
    const { error } = await supabase.from("ingredients").update({ stock_qty: on ? 0 : null } as any).eq("id", i.id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    refresh();
  };

  const doRestock = async () => {
    if (!restock) return;
    const p = Number(packs) || 0;
    const q = Number(extra) || 0;
    if (p <= 0 && q <= 0) return;
    setBusy(true);
    const { error } = await supabase.rpc("restock_ingredient" as any, {
      _ingredient_id: restock.id, _packs: p, _qty: q, _note: note,
    });
    setBusy(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: es ? "Insumo reabastecido" : "Ingredient restocked" });
    setRestock(null);
    refresh();
  };

  const doAdjust = async () => {
    if (!adjust) return;
    const newQty = Number(adjQty);
    if (!Number.isFinite(newQty) || newQty < 0) return;
    setBusy(true);
    const delta = newQty - Number(adjust.stock_qty ?? 0);
    const { error } = await supabase
      .from("ingredients")
      .update({ stock_qty: newQty, low_stock_threshold: adjThr === "" ? null : Number(adjThr) } as any)
      .eq("id", adjust.id);
    if (!error && delta !== 0) {
      await supabase.from("ingredient_stock_movements" as any).insert({
        business_id: (adjust as any).business_id, ingredient_id: adjust.id, delta, kind: "adjust",
        note: es ? "Conteo físico" : "Physical count",
      });
    }
    setBusy(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setAdjust(null);
    refresh();
  };

  const badge = (i: StockIngredient) => {
    const s = status(i);
    if (s === "none") return <Badge variant="outline" className="text-xs">{es ? "Sin control" : "Not tracked"}</Badge>;
    if (s === "out") return <Badge variant="destructive" className="text-xs gap-1"><XCircle className="h-3 w-3" />{es ? "Agotado" : "Out"}</Badge>;
    if (s === "low") return <Badge className="bg-amber-500 text-white text-xs gap-1"><AlertTriangle className="h-3 w-3" />{es ? "Bajo" : "Low"}</Badge>;
    return <Badge variant="secondary" className="text-xs">OK</Badge>;
  };

  const packPreview = restock ? (Number(packs) || 0) * Number(restock.presentation_qty || 0) + (Number(extra) || 0) : 0;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {es
          ? "Cada venta descuenta los insumos de su receta + 5% de merma. Las cancelaciones los regresan."
          : "Each sale deducts its recipe ingredients + 5% waste. Cancellations give them back."}
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Card><CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs text-muted-foreground">{es ? "Controlados" : "Tracked"}</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3"><p className="text-2xl font-bold">{tracked.length}</p></CardContent></Card>
        <Card className={low.length ? "border-amber-400" : ""}><CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs text-amber-600">{es ? "Bajos" : "Low"}</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3"><p className="text-2xl font-bold text-amber-600">{low.length}</p></CardContent></Card>
        <Card className={out.length ? "border-destructive" : ""}><CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs text-destructive">{es ? "Agotados" : "Out"}</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3"><p className="text-2xl font-bold text-destructive">{out.length}</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={es ? "Buscar insumo..." : "Search ingredient..."} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">{es ? "Todos" : "All"} ({items.length})</TabsTrigger>
            <TabsTrigger value="tracked" className="text-xs">{es ? "Controlados" : "Tracked"} ({tracked.length})</TabsTrigger>
            <TabsTrigger value="low" className="text-xs">⚠ ({low.length})</TabsTrigger>
            <TabsTrigger value="out" className="text-xs">✕ ({out.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{es ? "Insumo" : "Ingredient"}</TableHead>
                <TableHead className="text-right">{es ? "Existencia" : "Stock"}</TableHead>
                <TableHead className="text-center">{es ? "Estado" : "Status"}</TableHead>
                {isAdmin && <TableHead className="text-right">{es ? "Acciones" : "Actions"}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{es ? "Sin insumos" : "No ingredients"}</TableCell></TableRow>
              )}
              {list.map((i) => {
                const pres = Number(i.presentation_qty || 0);
                return (
                  <TableRow key={i.id} className={status(i) === "out" ? "bg-destructive/5" : status(i) === "low" ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
                    <TableCell className="font-medium">
                      {i.name}
                      {pres > 0 && <div className="text-xs text-muted-foreground">{es ? "Presentación" : "Pack"}: {fmt(pres)} {i.unit}</div>}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {i.stock_qty === null ? "—" : `${fmt(Number(i.stock_qty))} ${i.unit}`}
                      {i.stock_qty !== null && pres > 0 && (
                        <div className="text-xs text-muted-foreground">≈ {fmt(Number(i.stock_qty) / pres)} {es ? "pzas" : "packs"}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{badge(i)}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {i.stock_qty === null ? (
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setTracking(i, true)}>
                              <Play className="h-3 w-3" />{es ? "Controlar" : "Track"}
                            </Button>
                          ) : (
                            <>
                              <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => { setRestock(i); setPacks(""); setExtra(""); setNote(""); }}>
                                <PackagePlus className="h-3 w-3" />{es ? "Reabastecer" : "Restock"}
                              </Button>
                              <Button size="icon" variant="outline" className="h-7 w-7" title={es ? "Ajustar" : "Adjust"}
                                onClick={() => { setAdjust(i); setAdjQty(String(Math.round(Number(i.stock_qty) * 100) / 100)); setAdjThr(i.low_stock_threshold === null ? "" : String(i.low_stock_threshold)); }}>
                                <SlidersHorizontal className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" title={es ? "Dejar de controlar" : "Stop tracking"} onClick={() => setTracking(i, false)}>
                                <Square className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!restock} onOpenChange={(o) => !o && setRestock(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{es ? "Reabastecer" : "Restock"} · {restock?.name}</DialogTitle></DialogHeader>
          {restock && (
            <div className="space-y-3">
              {Number(restock.presentation_qty) > 0 && (
                <div className="space-y-1">
                  <Label>{es ? `Presentaciones (${fmt(Number(restock.presentation_qty))} ${restock.unit} c/u)` : `Packs (${fmt(Number(restock.presentation_qty))} ${restock.unit} each)`}</Label>
                  <Input type="number" inputMode="decimal" min={0} value={packs} onChange={(e) => setPacks(e.target.value)} placeholder="12" />
                </div>
              )}
              <div className="space-y-1">
                <Label>{es ? `Cantidad suelta (${restock.unit})` : `Loose quantity (${restock.unit})`}</Label>
                <Input type="number" inputMode="decimal" min={0} value={extra} onChange={(e) => setExtra(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{es ? "Nota (opcional)" : "Note (optional)"}</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <p className="text-sm">
                {es ? "Se agregarán" : "Will add"} <b>{fmt(packPreview)} {restock.unit}</b> → {es ? "nuevo total" : "new total"}{" "}
                <b>{fmt(Number(restock.stock_qty ?? 0) + packPreview)} {restock.unit}</b>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={doRestock} disabled={busy || packPreview <= 0}>{es ? "Guardar" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjust} onOpenChange={(o) => !o && setAdjust(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{es ? "Ajustar" : "Adjust"} · {adjust?.name}</DialogTitle></DialogHeader>
          {adjust && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{es ? `Existencia real (${adjust.unit})` : `Actual stock (${adjust.unit})`}</Label>
                <Input type="number" inputMode="decimal" min={0} value={adjQty} onChange={(e) => setAdjQty(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{es ? `Avisar cuando quede menos de (${adjust.unit})` : `Alert below (${adjust.unit})`}</Label>
                <Input type="number" inputMode="decimal" min={0} value={adjThr} onChange={(e) => setAdjThr(e.target.value)}
                  placeholder={es ? `Por defecto: 1 presentación (${fmt(Number(adjust.presentation_qty || 0))})` : `Default: 1 pack (${fmt(Number(adjust.presentation_qty || 0))})`} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={doAdjust} disabled={busy}>{es ? "Guardar" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
