import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useLoyaltyMemberByCode, useRegisterVisit, useMemberCoupons, useRedeemCoupon } from "@/hooks/useLoyalty";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, Search, Star, Gift, Check, UserPlus } from "lucide-react";

const LoyaltyScanPage = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [lookupCode, setLookupCode] = useState<string | undefined>();
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  const { data: member, isLoading } = useLoyaltyMemberByCode(lookupCode);
  const { data: coupons } = useMemberCoupons(member?.id);
  const registerVisit = useRegisterVisit();
  const redeemCoupon = useRedeemCoupon();

  const activeCoupons = (coupons ?? []).filter((c: any) => !c.is_redeemed);

  const extractCode = (text: string): string => {
    try {
      const url = new URL(text);
      const parts = url.pathname.split("/");
      const loyaltyIdx = parts.indexOf("loyalty");
      if (loyaltyIdx >= 0 && parts[loyaltyIdx + 1]) return parts[loyaltyIdx + 1];
    } catch {}
    return text.trim().toUpperCase();
  };

  const startScanner = async () => {
    if (!scannerContainerRef.current) return;
    try {
      const scanner = new Html5Qrcode("qr-scanner");
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const extracted = extractCode(decodedText);
          setLookupCode(extracted);
          setCode(extracted);
          scanner.stop().catch(() => {});
          setScanning(false);
        },
        () => {}
      );
    } catch {
      toast({ title: t("loyalty.cameraError"), variant: "destructive" });
      setScanning(false);
    }
  };

  const stopScanner = () => {
    scannerRef.current?.stop().catch(() => {});
    setScanning(false);
  };

  useEffect(() => () => { scannerRef.current?.stop().catch(() => {}); }, []);

  const handleManualSearch = () => {
    if (code.trim()) setLookupCode(code.trim().toUpperCase());
  };

  const handleRegisterVisit = async () => {
    if (!member || !user) return;
    try {
      const newCount = await registerVisit.mutateAsync({ memberId: member.id, registeredBy: user.id });
      toast({ title: t("loyalty.visitRegistered"), description: `${member.name} — ${newCount} ${t("loyalty.visits")}` });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleRedeem = async (memberCouponId: string) => {
    if (!user) return;
    try {
      await redeemCoupon.mutateAsync({ id: memberCouponId, redeemedBy: user.id });
      toast({ title: t("loyalty.couponRedeemed") });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const reset = () => {
    setLookupCode(undefined);
    setCode("");
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">{t("loyalty.scan")}</h1>

      {!lookupCode && (
        <>
          <div id="qr-scanner" ref={scannerContainerRef} className="rounded-lg overflow-hidden" />
          <div className="flex gap-2">
            {!scanning ? (
              <Button onClick={startScanner} className="flex-1"><Camera className="h-4 w-4 mr-1" />{t("loyalty.openCamera")}</Button>
            ) : (
              <Button onClick={stopScanner} variant="outline" className="flex-1">{t("loyalty.stopCamera")}</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Input placeholder={t("loyalty.enterCode")} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleManualSearch()} className="font-mono uppercase" maxLength={6} />
            <Button onClick={handleManualSearch} variant="outline"><Search className="h-4 w-4" /></Button>
          </div>
        </>
      )}

      {lookupCode && isLoading && <p className="text-muted-foreground text-center py-8">{t("common.loading")}</p>}

      {lookupCode && !isLoading && !member && (
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-muted-foreground">{t("loyalty.memberNotFound")}</p>
            <Button variant="outline" onClick={reset}>{t("loyalty.scanAnother")}</Button>
          </CardContent>
        </Card>
      )}

      {member && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span>{member.name}</span>
              <Badge variant="outline" className="font-mono">{member.member_code}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <span className="text-lg font-semibold">{member.total_visits} {t("loyalty.visits")}</span>
            </div>

            <Button onClick={handleRegisterVisit} disabled={registerVisit.isPending} className="w-full">
              <UserPlus className="h-4 w-4 mr-1" />
              {registerVisit.isPending ? "..." : t("loyalty.registerVisit")}
            </Button>

            {activeCoupons.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-1"><Gift className="h-4 w-4" /> {t("loyalty.availableCoupons")}</h3>
                {activeCoupons.map((mc: any) => (
                  <div key={mc.id} className="border rounded-md p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{mc.loyalty_coupons?.title}</p>
                      <Badge variant="secondary" className="mt-1">
                        {mc.loyalty_coupons?.discount_type === "percentage" ? `${mc.loyalty_coupons?.discount_value}%` : mc.loyalty_coupons?.discount_type === "fixed" ? `$${mc.loyalty_coupons?.discount_value}` : "🎁"}
                      </Badge>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleRedeem(mc.id)} disabled={redeemCoupon.isPending}>
                      <Check className="h-4 w-4 mr-1" />{t("loyalty.redeem")}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button variant="ghost" onClick={reset} className="w-full">{t("loyalty.scanAnother")}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LoyaltyScanPage;
