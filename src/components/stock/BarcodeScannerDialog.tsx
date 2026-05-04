import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMenuItems, MenuItem } from "@/hooks/useMenuItems";
import { useMenuItemSkus, lookupSkuByCode } from "@/hooks/useMenuItemSkus";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, X, Search as SearchIcon, Plus, Package, Check } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called when a scan resolves to a known menu item (after link or already-linked). */
  onResolved?: (item: MenuItem) => void;
}

type Phase = "scanning" | "found" | "unknown";

type NativeBarcodeDetector = {
  new (options?: { formats?: string[] }): {
    detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
  };
  getSupportedFormats?: () => Promise<string[]>;
};

const PREFERRED_NATIVE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "codabar",
  "itf",
] as const;

const PREFERRED_ZXING_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODABAR,
  BarcodeFormat.ITF,
];

export const BarcodeScannerDialog = ({ open, onOpenChange, onResolved }: Props) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: items = [] } = useMenuItems();
  const { add: addSku } = useMenuItemSkus();

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const handlingCodeRef = useRef(false);
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("scanning");
  const [matched, setMatched] = useState<MenuItem | null>(null);
  const [linkItemId, setLinkItemId] = useState<string>("");
  const [skuLabel, setSkuLabel] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");

  const startNativeDetection = async (videoEl: HTMLVideoElement) => {
    const NativeDetector = (window as Window & { BarcodeDetector?: NativeBarcodeDetector }).BarcodeDetector;
    if (!NativeDetector) return false;

    const supported = typeof NativeDetector.getSupportedFormats === "function"
      ? await NativeDetector.getSupportedFormats()
      : [];
    const formats = PREFERRED_NATIVE_FORMATS.filter((format) => supported.length === 0 || supported.includes(format));
    const detector = new NativeDetector(formats.length > 0 ? { formats } : undefined);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;

    const loop = async () => {
      if (!open || phase !== "scanning" || handlingCodeRef.current) return;

      const width = videoEl.videoWidth;
      const height = videoEl.videoHeight;
      if (!width || !height || videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        scanFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const cropWidth = Math.floor(width * 0.88);
      const cropHeight = Math.floor(height * 0.34);
      const cropX = Math.floor((width - cropWidth) / 2);
      const cropY = Math.floor((height - cropHeight) / 2);

      canvas.width = cropWidth;
      canvas.height = cropHeight;
      context.drawImage(videoEl, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      try {
        const matches = await detector.detect(canvas);
        const value = matches.find((match) => match.rawValue?.trim())?.rawValue?.trim();
        if (value) {
          await handleCode(value);
          return;
        }
      } catch {
        // Ignore transient frame decode failures.
      }

      scanFrameRef.current = requestAnimationFrame(loop);
    };

    scanFrameRef.current = requestAnimationFrame(loop);
    return true;
  };

  const stop = () => {
    try { controlsRef.current?.stop(); } catch { /* ignore */ }
    controlsRef.current = null;
    if (scanFrameRef.current != null) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch { /* ignore */ }
    }
  };

  const reset = () => {
    handlingCodeRef.current = false;
    setCode(""); setPhase("scanning"); setMatched(null);
    setLinkItemId(""); setSkuLabel(""); setNewName(""); setManual("");
  };

  const handleCode = async (raw: string) => {
    const c = raw.trim();
    if (!c || handlingCodeRef.current) return;
    handlingCodeRef.current = true;
    stop();
    setCode(c);
    try {
      const found = await lookupSkuByCode(c);
      if (found?.menu_items) {
        setMatched(found.menu_items as MenuItem);
        setPhase("found");
        onResolved?.(found.menu_items as MenuItem);
      } else {
        setPhase("unknown");
      }
    } catch (e: any) {
      handlingCodeRef.current = false;
      toast({ title: e.message || "Error", variant: "destructive" });
      setPhase("scanning");
    }
  };

  useEffect(() => {
    if (!open) { stop(); reset(); return; }
    if (phase !== "scanning") return;
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, PREFERRED_ZXING_FORMATS);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints);
    let cancelled = false;
    // Wait a tick so the <video> element is mounted before we attach a stream.
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const videoEl = videoRef.current;
      if (!videoEl) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        videoEl.srcObject = stream;
        videoEl.setAttribute("playsinline", "true");
        try { await videoEl.play(); } catch { /* ignore autoplay quirks */ }

        const usingNativeDetector = await startNativeDetection(videoEl);
        if (usingNativeDetector) return;

        const controls = await reader.decodeFromVideoElement(videoEl, (result) => {
          if (cancelled) return;
          if (result) handleCode(result.getText());
        });
        if (cancelled) { controls.stop(); return; }
        controlsRef.current = controls;
      } catch (e: any) {
        toast({
          title: t("stock.cameraError"),
          description: e?.message || String(e),
          variant: "destructive",
        });
      }
    }, 50);
    return () => { cancelled = true; clearTimeout(timer); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase]);

  const linkExisting = async () => {
    if (!linkItemId || !code) return;
    setBusy(true);
    try {
      await addSku.mutateAsync({ menu_item_id: linkItemId, code, label: skuLabel });
      const item = items.find(i => i.id === linkItemId);
      toast({ title: t("stock.skuLinked") });
      if (item) onResolved?.(item);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: e.message || "Error", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const createAndLink = async () => {
    if (!newName.trim() || !code) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("menu_items")
        .insert({ name: newName.trim(), inventory_count: 0 })
        .select()
        .single();
      if (error) throw error;
      await addSku.mutateAsync({ menu_item_id: data.id, code, label: skuLabel });
      queryClient.invalidateQueries({ queryKey: ["menu_items"] });
      toast({ title: t("stock.skuLinked") });
      onResolved?.(data as MenuItem);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: e.message || "Error", variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> {t("stock.scanTitle")}
          </DialogTitle>
          <DialogDescription>{t("stock.scanHint")}</DialogDescription>
        </DialogHeader>

        {phase === "scanning" && (
          <div className="space-y-3">
            <div className="relative bg-black rounded-md overflow-hidden aspect-[4/3]">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
              <div className="absolute inset-x-6 top-1/2 h-px bg-red-500/80" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("stock.scanManual")}</Label>
              <div className="flex gap-2">
                <Input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="0000000000000"
                  onKeyDown={(e) => e.key === "Enter" && handleCode(manual)}
                />
                <Button size="icon" onClick={() => handleCode(manual)}>
                  <SearchIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {phase === "found" && matched && (
          <div className="space-y-3">
            <Card className="p-3 flex items-center gap-3 border-green-500/50 bg-green-500/5">
              <Check className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="font-medium">{language === "es" ? matched.name : (matched.name_en || matched.name)}</p>
                <Badge variant="outline" className="text-[10px] mt-0.5">{code}</Badge>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <Package className="h-3 w-3 inline mr-1" />
                {matched.inventory_count ?? "—"}
              </div>
            </Card>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>{t("stock.scan")}</Button>
              <Button onClick={() => onOpenChange(false)}>{t("common.close" as any) || "OK"}</Button>
            </div>
          </div>
        )}

        {phase === "unknown" && (
          <div className="space-y-4">
            <Card className="p-3 flex items-center gap-3 border-amber-500/50 bg-amber-500/5">
              <X className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-sm">{t("stock.scanNotFound")}</p>
                <Badge variant="outline" className="text-[10px] mt-0.5">{code}</Badge>
              </div>
            </Card>

            <div className="space-y-1">
              <Label className="text-xs">{t("stock.skuLabel")}</Label>
              <Input value={skuLabel} onChange={(e) => setSkuLabel(e.target.value)} placeholder="355ml / Six-pack..." />
            </div>

            <div className="space-y-2 border rounded-md p-3">
              <Label className="text-xs font-medium">{t("stock.linkToItem")}</Label>
              <Select value={linkItemId} onValueChange={setLinkItemId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {language === "es" ? i.name : (i.name_en || i.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="w-full" disabled={!linkItemId || busy} onClick={linkExisting}>
                <Plus className="h-3 w-3 mr-1" /> {t("stock.linkToItem")}
              </Button>
            </div>

            {isAdmin && (
              <div className="space-y-2 border rounded-md p-3">
                <Label className="text-xs font-medium">{t("stock.createNewItem")}</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("menu.name")} />
                <Button size="sm" variant="secondary" className="w-full" disabled={!newName.trim() || busy} onClick={createAndLink}>
                  <Plus className="h-3 w-3 mr-1" /> {t("stock.createNewItem")}
                </Button>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" onClick={reset}>{t("stock.scan")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
