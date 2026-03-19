import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useLoyaltyMemberByCode, useMemberCoupons } from "@/hooks/useLoyalty";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Star, Gift } from "lucide-react";

const LoyaltyMemberPage = () => {
  const { memberCode } = useParams<{ memberCode: string }>();
  const { data: member, isLoading } = useLoyaltyMemberByCode(memberCode);
  const { data: coupons } = useMemberCoupons(member?.id);

  const qrUrl = memberCode ? `${window.location.origin}/loyalty/${memberCode}` : "";
  const activeCoupons = (coupons ?? []).filter((c) => !c.is_redeemed);

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
        </CardContent>
      </Card>
    </div>
  );
};

export default LoyaltyMemberPage;
