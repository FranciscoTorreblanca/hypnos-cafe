import { useParams, Navigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useLoyaltyMemberByCode, useMemberCoupons, useCouponItemsByCoupons } from "@/hooks/useLoyalty";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Star, Gift, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const LoyaltyMemberPage = () => {
  const { memberCode } = useParams<{ memberCode: string }>();
  const { user, loading: authLoading } = useAuth();
  const { data: member, isLoading } = useLoyaltyMemberByCode(memberCode);
  const { data: coupons } = useMemberCoupons(member?.id);

  const qrUrl = memberCode ? `${window.location.origin}/loyalty/${memberCode}` : "";
  const activeCoupons = (coupons ?? []).filter((c: any) => !c.is_redeemed);

  const freeItemCouponIds = activeCoupons
    .filter((c: any) => c.loyalty_coupons?.discount_type === "free_item")
    .map((c: any) => c.loyalty_coupons?.id)
    .filter(Boolean);
  const { data: couponItemsData = [] } = useCouponItemsByCoupons(freeItemCouponIds);
  const couponItemsMap: Record<string, string[]> = {};
  for (const ci of couponItemsData) {
    if (!couponItemsMap[ci.coupon_id]) couponItemsMap[ci.coupon_id] = [];
    couponItemsMap[ci.coupon_id].push((ci.menu_items as any)?.name ?? "");
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/loyalty-login" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Miembro no encontrado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Security: only allow the owner or staff to view
  const isOwner = member.user_id === user.id;
  const isStaff = user.app_metadata?.role !== "loyalty_member"; // staff users can view any member

  if (!isOwner && !isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No tienes permiso para ver esta tarjeta.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/loyalty-login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <Heart className="mx-auto h-8 w-8 text-primary mb-2" />
          <CardTitle>{member.name}</CardTitle>
          <CardDescription>Tarjeta de Lealtad</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white p-4 rounded-lg inline-block mx-auto">
            <QRCodeSVG value={qrUrl} size={160} />
          </div>
          <p className="font-mono text-xl font-bold tracking-widest">{member.member_code}</p>

          <div className="flex items-center justify-center gap-2 text-lg">
            <Star className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold">{member.total_visits} visitas</span>
          </div>

          {activeCoupons.length > 0 && (
            <div className="space-y-2 text-left">
              <h3 className="font-semibold flex items-center gap-1 text-sm">
                <Gift className="h-4 w-4" /> Cupones disponibles
              </h3>
              {activeCoupons.map((mc: any) => (
                <div key={mc.id} className="border rounded-md p-3">
                  <p className="font-medium text-sm">{mc.loyalty_coupons?.title}</p>
                  <p className="text-xs text-muted-foreground">{mc.loyalty_coupons?.description}</p>
                  <Badge variant="secondary" className="mt-1">
                    {mc.loyalty_coupons?.discount_type === "percentage"
                      ? `${mc.loyalty_coupons?.discount_value}% desc.`
                      : mc.loyalty_coupons?.discount_type === "fixed"
                      ? `$${mc.loyalty_coupons?.discount_value} desc.`
                      : "Artículo gratis"}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoyaltyMemberPage;
