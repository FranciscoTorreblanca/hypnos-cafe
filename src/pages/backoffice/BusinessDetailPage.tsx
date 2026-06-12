import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2, UserPlus } from "lucide-react";

interface Business {
  id: string; name: string; slug: string; legal_name: string | null; tax_id: string | null;
  address: string | null; phone: string | null; email: string | null;
  ticket_header: string | null; ticket_footer: string | null;
  currency: string; language: string; timezone: string;
  vat_rate: number; card_commission_rate: number;
  mp_access_token: string | null; mp_device_id: string | null;
  status: string; logo_url: string | null;
}

const FEATURE_KEYS = [
  "tickets","calendar","loyalty","kitchen","cost_calculator","stock",
  "budget","analytics","push_notifications","mercado_pago","menu_generator","wifi",
] as const;

const FEATURE_LABELS: Record<string, string> = {
  tickets: "Tickets / Receipts",
  calendar: "Calendar & Reservations",
  loyalty: "Loyalty program",
  kitchen: "Kitchen workflow",
  cost_calculator: "Cost calculator",
  stock: "Stock / inventory",
  budget: "Budget",
  analytics: "Usage analytics",
  push_notifications: "Push notifications",
  mercado_pago: "Mercado Pago",
  menu_generator: "Menu generator",
  wifi: "Wi-Fi info",
};

const BUSINESS_ROLES = ["business_admin", "admin", "waiter", "billing", "kitchen"] as const;

const BusinessDetailPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [business, setBusiness] = useState<Business | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [members, setMembers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [memberDialog, setMemberDialog] = useState(false);
  const [memberForm, setMemberForm] = useState({ email: "", full_name: "", role: "business_admin" });
  const [creatingMember, setCreatingMember] = useState(false);

  const fetchAll = async () => {
    const [{ data: b }, { data: f }, { data: m }] = await Promise.all([
      supabase.from("businesses").select("*").eq("id", id).maybeSingle(),
      supabase.from("business_features").select("*").eq("business_id", id).maybeSingle(),
      supabase
        .from("business_members")
        .select("id,user_id,role,is_default")
        .eq("business_id", id),
    ]);
    setBusiness(b as Business | null);
    if (f) {
      const map: Record<string, boolean> = {};
      FEATURE_KEYS.forEach((k) => { map[k] = (f as any)[k] !== false; });
      setFeatures(map);
    }
    const memberList = m ?? [];
    if (memberList.length > 0) {
      const ids = memberList.map((row) => row.user_id);
      const { data: profs } = await supabase.from("profiles").select("id,email,full_name").in("id", ids);
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      setMembers(memberList.map((row) => ({ ...row, profiles: profMap.get(row.user_id) })));
    } else {
      setMembers([]);
    }
  };

  useEffect(() => { if (id) void fetchAll(); }, [id]);

  const saveBusiness = async () => {
    if (!business) return;
    setSaving(true);
    try {
      const { id: _id, ...rest } = business;
      const { error } = await supabase.from("businesses").update(rest).eq("id", id);
      if (error) throw error;
      toast({ title: "Saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const toggleFeature = async (key: string, value: boolean) => {
    setFeatures((p) => ({ ...p, [key]: value }));
    const { error } = await supabase
      .from("business_features")
      .upsert({ business_id: id, [key]: value } as any, { onConflict: "business_id" });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setFeatures((p) => ({ ...p, [key]: !value }));
    }
  };

  const handleAddMember = async () => {
    if (!memberForm.email || !memberForm.full_name) return;
    setCreatingMember(true);
    try {
      const res = await supabase.functions.invoke("create-user", {
        body: { ...memberForm, business_id: id },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "User invited" });
      setMemberDialog(false);
      setMemberForm({ email: "", full_name: "", role: "business_admin" });
      await fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setCreatingMember(false); }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Remove this user from the business?")) return;
    const { error } = await supabase.from("business_members").delete().eq("id", memberId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await fetchAll();
  };

  if (!business) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/backoffice/businesses")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{business.name}</h1>
        <Badge variant={business.status === "active" ? "default" : "secondary"}>{business.status}</Badge>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="billing">Billing & Tickets</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="members">Users ({members.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Basic info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Name</Label>
                  <Input value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Slug</Label>
                  <Input value={business.slug} onChange={(e) => setBusiness({ ...business, slug: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Currency</Label>
                  <Input value={business.currency} onChange={(e) => setBusiness({ ...business, currency: e.target.value.toUpperCase() })} />
                </div>
                <div className="space-y-2"><Label>Default language</Label>
                  <Select value={business.language} onValueChange={(v) => setBusiness({ ...business, language: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Timezone</Label>
                  <Input value={business.timezone} onChange={(e) => setBusiness({ ...business, timezone: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Status</Label>
                  <Select value={business.status} onValueChange={(v) => setBusiness({ ...business, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Phone</Label>
                  <Input value={business.phone ?? ""} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Email</Label>
                  <Input value={business.email ?? ""} onChange={(e) => setBusiness({ ...business, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2"><Label>Logo URL</Label>
                <Input value={business.logo_url ?? ""} onChange={(e) => setBusiness({ ...business, logo_url: e.target.value })} />
              </div>
              <Button onClick={saveBusiness} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legal & ticket info</CardTitle>
              <CardDescription>Used for printed tickets and invoices.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Legal name</Label>
                  <Input value={business.legal_name ?? ""} onChange={(e) => setBusiness({ ...business, legal_name: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Tax ID (RFC)</Label>
                  <Input value={business.tax_id ?? ""} onChange={(e) => setBusiness({ ...business, tax_id: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>VAT %</Label>
                  <Input type="number" value={business.vat_rate} onChange={(e) => setBusiness({ ...business, vat_rate: Number(e.target.value) })} />
                </div>
                <div className="space-y-2"><Label>Card commission %</Label>
                  <Input type="number" value={business.card_commission_rate} onChange={(e) => setBusiness({ ...business, card_commission_rate: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-2"><Label>Address</Label>
                <Textarea rows={2} value={business.address ?? ""} onChange={(e) => setBusiness({ ...business, address: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Ticket header</Label>
                <Textarea rows={2} value={business.ticket_header ?? ""} onChange={(e) => setBusiness({ ...business, ticket_header: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Ticket footer</Label>
                <Textarea rows={2} value={business.ticket_footer ?? ""} onChange={(e) => setBusiness({ ...business, ticket_footer: e.target.value })} />
              </div>
              <Button onClick={saveBusiness} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mercado Pago</CardTitle>
              <CardDescription>Per-business credentials. Leave blank to disable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Access token</Label>
                <Input type="password" value={business.mp_access_token ?? ""} onChange={(e) => setBusiness({ ...business, mp_access_token: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Device ID (Point Mini)</Label>
                <Input value={business.mp_device_id ?? ""} onChange={(e) => setBusiness({ ...business, mp_device_id: e.target.value })} />
              </div>
              <Button onClick={saveBusiness} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feature flags</CardTitle>
              <CardDescription>Toggle modules on/off for this business.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {FEATURE_KEYS.map((k) => (
                <div key={k} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
                  <Label htmlFor={`feat-${k}`} className="cursor-pointer">{FEATURE_LABELS[k]}</Label>
                  <Switch id={`feat-${k}`} checked={features[k] ?? true} onCheckedChange={(v) => toggleFeature(k, v)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Users</CardTitle>
                <CardDescription>Members and roles for this business.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setMemberDialog(true)} className="gap-1">
                <UserPlus className="h-4 w-4" /> Invite user
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.profiles?.full_name || "—"}</TableCell>
                      <TableCell>{m.profiles?.email}</TableCell>
                      <TableCell><Badge variant="secondary">{m.role}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeMember(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {members.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No users yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={memberDialog} onOpenChange={setMemberDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite user to {business.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Full name</Label>
              <Input value={memberForm.full_name} onChange={(e) => setMemberForm({ ...memberForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Email</Label>
              <Input type="email" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Role</Label>
              <Select value={memberForm.role} onValueChange={(v) => setMemberForm({ ...memberForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDialog(false)}>Cancel</Button>
            <Button onClick={handleAddMember} disabled={creatingMember}>
              {creatingMember ? "Inviting…" : "Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessDetailPage;
