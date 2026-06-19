import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import {
  useCurrentTillSession, useTillXReport, useOpenTillSession, useCloseTillSession,
  useTillSessionsHistory,
} from "@/hooks/useTillSessions";
import { CloseTillDialog } from "./CloseTillDialog";
import { Vault, PlayCircle, FileText, StopCircle, Clock, Download } from "lucide-react";
import { generateTillReportPdf } from "@/lib/tillReportPdf";

export const TillSessionCard = () => {
  const { t, language } = useLanguage();
  const { isAdmin, hasRole, currentBusiness } = useAuth();
  const { toast } = useToast();
  const canManage = isAdmin || hasRole("billing");

  const { data: session, isLoading } = useCurrentTillSession();
  const { data: xReport } = useTillXReport(session?.id);
  const { data: history = [] } = useTillSessionsHistory(10);
  const openMut = useOpenTillSession();

  const downloadX = () => {
    if (!session || !xReport) return;
    generateTillReportPdf({
      kind: "X", session, report: xReport,
      businessName: currentBusiness?.name, lang: language, t,
    });
  };
  const downloadZ = (s: typeof history[number]) => {
    if (!s.z_report) return;
    generateTillReportPdf({
      kind: "Z", session: s, report: s.z_report,
      businessName: currentBusiness?.name, lang: language, t,
    });
  };

  const [openingFloat, setOpeningFloat] = useState("");
  const [openingNotes, setOpeningNotes] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [xOpen, setXOpen] = useState(false);

  const handleOpen = async () => {
    const amount = parseFloat(openingFloat || "0");
    if (Number.isNaN(amount) || amount < 0) {
      toast({ title: t("till.invalidAmount"), variant: "destructive" });
      return;
    }
    try {
      await openMut.mutateAsync({ opening_float: amount, notes: openingNotes || undefined });
      setOpeningFloat("");
      setOpeningNotes("");
      toast({ title: t("till.sessionOpened") });
    } catch (e: any) {
      toast({ title: t("till.errorOpening"), description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) return null;

  if (!session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Vault className="h-4 w-4" /> {t("till.noSession")}</CardTitle>
          <CardDescription>{t("till.noSessionDesc")}</CardDescription>
        </CardHeader>
        {canManage && (
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>{t("till.openingFloat")}</Label>
              <Input
                type="number" inputMode="decimal" min="0" placeholder="$0"
                value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("till.notesOptional")}</Label>
              <Textarea rows={2} value={openingNotes} onChange={(e) => setOpeningNotes(e.target.value)} />
            </div>
            <Button onClick={handleOpen} disabled={openMut.isPending} className="w-full gap-2">
              <PlayCircle className="h-4 w-4" /> {t("till.openSession")}
            </Button>
          </CardContent>
        )}
      </Card>
    );
  }

  const openedAt = new Date(session.opened_at);
  const expected = xReport?.expected_cash ?? session.opening_float;
  const breakdown = xReport?.payments_breakdown ?? {};

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Vault className="h-4 w-4" /> {t("till.openSessionTitle")}
                <Badge variant="default" className="ml-1">{t("till.statusOpen")}</Badge>
              </CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" /> {openedAt.toLocaleString()}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border p-2">
              <p className="text-xs text-muted-foreground">{t("till.openingFloat")}</p>
              <p className="font-semibold">${Number(session.opening_float).toFixed(0)}</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-xs text-muted-foreground">{t("till.expectedCash")}</p>
              <p className="font-semibold">${Number(expected).toFixed(0)}</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-xs text-muted-foreground">{t("till.cashPayments")}</p>
              <p className="font-semibold">${Number(xReport?.cash_payments_total ?? 0).toFixed(0)}</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-xs text-muted-foreground">{t("till.adjustments")}</p>
              <p className="font-semibold">
                +${Number(xReport?.cash_in_total ?? 0).toFixed(0)} / −${Number(xReport?.cash_out_total ?? 0).toFixed(0)}
              </p>
            </div>
          </div>

          {xOpen && xReport && (
            <>
              <Separator />
              <div className="space-y-1 text-xs">
                <p className="text-sm font-medium">{t("till.paymentsBreakdown")}</p>
                {Object.keys(breakdown).length === 0 ? (
                  <p className="text-muted-foreground">{t("till.noPaymentsYet")}</p>
                ) : (
                  Object.entries(breakdown).map(([method, v]) => (
                    <div key={method} className="flex justify-between">
                      <span className="capitalize">{method}</span>
                      <span>
                        ${Number(v.amount).toFixed(0)} ({v.count}){v.tip ? ` · tip $${Number(v.tip).toFixed(0)}` : ""}
                      </span>
                    </div>
                  ))
                )}
                <p className="text-[10px] text-muted-foreground pt-1">
                  {t("till.generatedAt")}: {new Date(xReport.generated_at).toLocaleTimeString()}
                </p>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setXOpen((v) => !v)}>
              <FileText className="h-4 w-4" /> {xOpen ? t("till.hideX") : t("till.showX")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={downloadX} disabled={!xReport}>
              <Download className="h-4 w-4" /> {t("till.downloadX")}
            </Button>
            {canManage && (
              <Button variant="destructive" size="sm" className="gap-1 ml-auto" onClick={() => setCloseOpen(true)}>
                <StopCircle className="h-4 w-4" /> {t("till.closeSession")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {history.filter((s) => s.status === "closed").length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("till.recentClosures")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {history
              .filter((s) => s.status === "closed")
              .slice(0, 5)
              .map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-xs border-b last:border-0 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate">{new Date(s.closed_at ?? s.opened_at).toLocaleString()}</p>
                    <p className="text-muted-foreground">
                      {t("till.difference")}: {Number(s.closing_difference ?? 0) > 0 ? "+" : ""}
                      ${Number(s.closing_difference ?? 0).toFixed(0)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1 shrink-0" onClick={() => downloadZ(s)}>
                    <Download className="h-3 w-3" /> Z
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {canManage && (
        <CloseTillDialog
          open={closeOpen}
          onOpenChange={setCloseOpen}
          session={session}
          xReport={xReport ?? null}
        />
      )}
    </>
  );
};
