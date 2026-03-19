import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLoyaltyMembers, useLoyaltyCoupons, useCreateCoupon, useUpdateCoupon } from "@/hooks/useLoyalty";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Gift, Plus, Search, MoreHorizontal, KeyRound, Ban, CheckCircle } from "lucide-react";

const LoyaltyAdminPage = () => {
  const { t } = useLanguage();
  const { data: members = [], isLoading: membersLoading } = useLoyaltyMembers();
  const { data: coupons = [], isLoading: couponsLoading } = useLoyaltyCoupons();
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [couponOpen, setCouponOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: string; member: any } | null>(null);
  const [newCoupon, setNewCoupon] = useState({
    title: "", title_en: "", description: "", description_en: "",
    discount_type: "percentage", discount_value: 0, min_visits: 0,
  });

  const filteredMembers = members.filter(
    (m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateCoupon = async () => {
    if (!newCoupon.title.trim()) return;
    try {
      await createCoupon.mutateAsync(newCoupon);
      setCouponOpen(false);
      setNewCoupon({ title: "", title_en: "", description: "", description_en: "", discount_type: "percentage", discount_value: 0, min_visits: 0 });
      toast({ title: t("loyalty.couponCreated") });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const toggleCouponActive = async (id: string, isActive: boolean) => {
    await updateCoupon.mutateAsync({ id, is_active: !isActive });
  };

  const handleAdminAction = async (action: string, member: any) => {
    setActionLoading(member.id);
    try {
      const { data, error } = await supabase.functions.invoke("loyalty-admin-action", {
        body: { action, member_id: member.id, user_id: member.user_id, email: member.email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (action === "reset_password") {
        toast({ title: t("loyalty.resetPasswordSent") });
      } else if (action === "toggle_active") {
        queryClient.invalidateQueries({ queryKey: ["loyalty-members"] });
        toast({ title: data.is_active ? t("loyalty.memberActivated") : t("loyalty.memberDeactivated") });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("loyalty.admin")}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("loyalty.totalMembers")}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{members.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("loyalty.totalVisits")}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{members.reduce((s, m) => s + (m.total_visits ?? 0), 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("loyalty.activeCoupons")}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{coupons.filter((c) => c.is_active).length}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members"><Users className="h-4 w-4 mr-1" />{t("loyalty.members")}</TabsTrigger>
          <TabsTrigger value="coupons"><Gift className="h-4 w-4 mr-1" />{t("loyalty.coupons")}</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("loyalty.name")}</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>{t("loyalty.code")}</TableHead>
                  <TableHead>{t("loyalty.visits")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="w-10">{t("loyalty.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : filteredMembers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("loyalty.noMembers")}</TableCell></TableRow>
                ) : filteredMembers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell className="font-mono">{m.member_code}</TableCell>
                    <TableCell>{m.total_visits}</TableCell>
                    <TableCell><Badge variant={m.is_active ? "default" : "secondary"}>{m.is_active ? t("common.active") : t("common.inactive")}</Badge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={actionLoading === m.id}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleAdminAction("reset_password", m)}>
                            <KeyRound className="h-4 w-4 mr-2" />
                            {t("loyalty.resetPassword")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAdminAction("toggle_active", m)}>
                            {m.is_active ? (
                              <><Ban className="h-4 w-4 mr-2" />{t("loyalty.deactivate")}</>
                            ) : (
                              <><CheckCircle className="h-4 w-4 mr-2" />{t("loyalty.activate")}</>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="coupons" className="space-y-4">
          <Dialog open={couponOpen} onOpenChange={setCouponOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />{t("loyalty.newCoupon")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("loyalty.newCoupon")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Título (ES)</Label><Input value={newCoupon.title} onChange={(e) => setNewCoupon((p) => ({ ...p, title: e.target.value }))} maxLength={100} /></div>
                  <div><Label>Title (EN)</Label><Input value={newCoupon.title_en} onChange={(e) => setNewCoupon((p) => ({ ...p, title_en: e.target.value }))} maxLength={100} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Descripción (ES)</Label><Input value={newCoupon.description} onChange={(e) => setNewCoupon((p) => ({ ...p, description: e.target.value }))} maxLength={200} /></div>
                  <div><Label>Description (EN)</Label><Input value={newCoupon.description_en} onChange={(e) => setNewCoupon((p) => ({ ...p, description_en: e.target.value }))} maxLength={200} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>{t("loyalty.discountType")}</Label>
                    <Select value={newCoupon.discount_type} onValueChange={(v) => setNewCoupon((p) => ({ ...p, discount_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">%</SelectItem>
                        <SelectItem value="fixed">$ Fijo</SelectItem>
                        <SelectItem value="free_item">Gratis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>{t("loyalty.value")}</Label><Input type="number" value={newCoupon.discount_value} onChange={(e) => setNewCoupon((p) => ({ ...p, discount_value: Number(e.target.value) }))} min={0} /></div>
                  <div><Label>{t("loyalty.minVisits")}</Label><Input type="number" value={newCoupon.min_visits} onChange={(e) => setNewCoupon((p) => ({ ...p, min_visits: Number(e.target.value) }))} min={0} /></div>
                </div>
                <Button onClick={handleCreateCoupon} disabled={createCoupon.isPending} className="w-full">{t("common.save")}</Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("loyalty.couponTitle")}</TableHead>
                  <TableHead>{t("loyalty.discountType")}</TableHead>
                  <TableHead>{t("loyalty.value")}</TableHead>
                  <TableHead>{t("loyalty.minVisits")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {couponsLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : coupons.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("loyalty.noCoupons")}</TableCell></TableRow>
                ) : coupons.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>{c.discount_type === "percentage" ? "%" : c.discount_type === "fixed" ? "$" : "🎁"}</TableCell>
                    <TableCell>{c.discount_value}</TableCell>
                    <TableCell>{c.min_visits || "—"}</TableCell>
                    <TableCell>
                      <Switch checked={c.is_active} onCheckedChange={() => toggleCouponActive(c.id, c.is_active)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LoyaltyAdminPage;
