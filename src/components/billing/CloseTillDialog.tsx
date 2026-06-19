import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useCloseTillSession, type TillSession, type TillXReport } from "@/hooks/useTillSessions";
import { useAuth } from "@/hooks/useAuth";
import { generateTillReportPdf } from "@/lib/tillReportPdf";

const DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  session: TillSession;
  xReport: TillXReport | null;
}

export const CloseTillDialog = ({ open, onOpenChange, session, xReport }: Props) => {
  const { t, language } = useLanguage();
  const { currentBusiness } = useAuth();
  const { toast } = useToast();
  const closeMut = useCloseTillSession();

  const [counts, setCounts] = useState<Record<number, number>>({});
  const [manualCounted, setManualCounted] = useState("");
  const [notes, setNotes] = useState("");

  const denomTotal = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + d * (counts[d] || 0), 0),
    [counts]
  );
  const counted = manualCounted !== "" ? parseFloat(manualCounted) || 0 : denomTotal;
  const expected = xReport?.expected_cash ?? session.opening_float;
  const difference = counted - expected;

  const update = (d: number, delta: number) =>
    setCounts((p) => ({ ...p, [d]: Math.max(0, (p[d] || 0) + delta) }));
  const reset = () => { setCounts({}); setManualCounted(""); };

  const confirm = async () => {
    try {
      const denoms = Object.fromEntries(
        Object.entries(counts).filter(([, v]) => v > 0)
      );
      const closed = await closeMut.mutateAsync({
        session_id: session.id,
        counted,
        denominations: Object.keys(denoms).length ? (denoms as any) : undefined,
        notes: notes || undefined,
      });
      try {
        generateTillReportPdf({
          kind: "Z",
          session: closed,
          report: (closed as any).z_report ?? xReport,
          businessName: currentBusiness?.name,
          lang: language,
          t,
        });
      } catch (pdfErr) {
        console.error("Z PDF generation failed", pdfErr);
      }
      toast({ title: t("till.sessionClosed") });
      onOpenChange(false);
      reset();
      setNotes("");
    } catch (e: any) {
      toast({ title: t("till.errorClosing"), description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto" data-vaul-no-drag>
        <DialogHeader>
          <DialogTitle>{t("till.closeTitle")}</DialogTitle>
          <DialogDescription>{t("till.closeDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {DENOMINATIONS.map((d) => {
              const qty = counts[d] || 0;
              return (
                <div key={d} className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => update(d, -1)} disabled={qty === 0}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <div className="flex-1 text-center text-sm font-medium">
                    {qty > 0 && <span className="mr-1 text-xs text-muted-foreground">×{qty}</span>}
                    ${d.toLocaleString()}
                  </div>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => update(d, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>

          <Button variant="ghost" size="sm" className="gap-1" onClick={reset}>
            <RotateCcw className="h-3 w-3" /> {t("billing.cashCountReset")}
          </Button>

          <Separator />

          <div className="space-y-2">
            <Label>{t("till.countedCash")}</Label>
            <Input
              type="number" inputMode="decimal" min="0"
              placeholder={denomTotal ? `$${denomTotal}` : "$0"}
              value={manualCounted}
              onChange={(e) => setManualCounted(e.target.value)}
            />
          </div>

          <div className="rounded-md border p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("till.expectedCash")}</span>
              <span className="font-semibold">${expected.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("till.countedCash")}</span>
              <span className="font-semibold">${counted.toFixed(0)}</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span className="text-muted-foreground">{t("till.difference")}</span>
              <span className={`font-bold ${difference === 0 ? "text-emerald-600" : difference > 0 ? "text-blue-600" : "text-destructive"}`}>
                {difference > 0 ? "+" : ""}{difference.toFixed(0)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("till.closingNotes")}</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("till.cancel")}</Button>
          <Button variant="destructive" onClick={confirm} disabled={closeMut.isPending}>
            {t("till.confirmClose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
