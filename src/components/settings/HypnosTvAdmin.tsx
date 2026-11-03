import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useMenuCategories } from "@/hooks/useMenuItems";
import { callHypnosTv, useTvIntegration, useTvSync } from "@/hooks/useHypnosTv";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, KeyRound } from "lucide-react";

export const HypnosTvAdmin = () => {
  const { language } = useLanguage();
  const es = language === "es";
  const { currentBusinessId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: cfg, isLoading } = useTvIntegration();
  const { data: categories = [] } = useMenuCategories();
  const sync = useTvSync();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  const update = async (patch: Record<string, unknown>) => {
    const { error } = await (supabase as any).from("tv_integrations")
      .upsert({ business_id: currentBusinessId, ...patch, updated_at: new Date().toISOString() });
    if (error) toast({ title: error.message, variant: "destructive" });
    await qc.invalidateQueries({ queryKey: ["tv-integration"] });
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast({ title: ok }); }
    catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setBusy(false); qc.invalidateQueries({ queryKey: ["tv-integration"] }); }
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> API Key
          {cfg?.has_api_key ? <Badge variant="secondary">{es ? "Guardada" : "Saved"}</Badge> : <Badge variant="outline">{es ? "Sin clave" : "Not set"}</Badge>}
        </Label>
        <div className="flex gap-2">
          <Input type="password" autoComplete="off" placeholder={cfg?.has_api_key ? (es ? "Pegar nueva clave para cambiarla" : "Paste a new key to replace") : "hyp_live_..."} value={key} onChange={(e) => setKey(e.target.value)} />
          <Button disabled={busy || key.trim().length < 8} onClick={() => run(async () => {
            await callHypnosTv({ action: "save_key", business_id: currentBusinessId, api_key: key.trim() }); setKey("");
          }, es ? "Clave verificada y guardada" : "Key verified and saved")}>{es ? "Guardar" : "Save"}</Button>
        </div>
        {cfg?.has_api_key && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => callHypnosTv({ action: "test", business_id: currentBusinessId }), es ? "Conexión correcta" : "Connection OK")}>
              {es ? "Probar conexión" : "Test connection"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => callHypnosTv({ action: "clear_key", business_id: currentBusinessId }), es ? "Clave eliminada" : "Key removed")}>
              {es ? "Quitar clave" : "Remove key"}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>{es ? "Categoría del menú para la lista de barriles" : "Menu category for the tap list"}</Label>
        <Select value={cfg?.taplist_category_id ?? ""} onValueChange={(v) => update({ taplist_category_id: v })}>
          <SelectTrigger><SelectValue placeholder={es ? "Elegir categoría (ej. Barril)" : "Pick a category (e.g. Barril)"} /></SelectTrigger>
          <SelectContent>
            {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{es ? c.name : c.name_en || c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label>{es ? "Lista de barriles activa" : "Tap list enabled"}</Label>
        <Switch checked={!!cfg?.enabled} disabled={!cfg?.has_api_key} onCheckedChange={(v) => update({ enabled: v })} />
      </div>
      <div className="flex items-center justify-between">
        <Label>{es ? "Sincronizar automáticamente al editar el menú" : "Sync automatically on menu changes"}</Label>
        <Switch checked={cfg?.auto_sync ?? true} onCheckedChange={(v) => update({ auto_sync: v })} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {cfg?.last_synced_at
            ? `${es ? "Última sincronización" : "Last synced"}: ${new Date(cfg.last_synced_at).toLocaleString()}`
            : es ? "Nunca sincronizado" : "Never synced"}
        </p>
        <Button size="sm" className="gap-1.5" disabled={!cfg?.enabled || !cfg?.taplist_category_id || sync.isPending}
          onClick={() => sync.mutate(undefined, {
            onSuccess: () => toast({ title: es ? "Lista enviada a la TV" : "Tap list sent to TV" }),
            onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
          })}>
          {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {es ? "Sincronizar ahora" : "Sync now"}
        </Button>
      </div>
      {cfg?.last_sync_error && <p className="text-xs text-destructive break-words">{cfg.last_sync_error}</p>}
    </div>
  );
};
