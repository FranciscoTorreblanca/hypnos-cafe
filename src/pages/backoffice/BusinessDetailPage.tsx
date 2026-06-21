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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, KeyRound, Trash2, UserPlus, Bell, Pencil } from "lucide-react";
import { extractEdgeError } from "@/lib/edgeError";

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
  "time_attendance","cash_closing",
] as const;

const OPT_IN_FEATURES = new Set(["time_attendance", "cash_closing"]);

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
  time_attendance: "Time & attendance (fingerprint check-in)",
  cash_closing: "Cash closing (X/Z till sessions)",
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
  const [memberForm, setMemberForm] = useState<{ email: string; full_name: string; roles: string[] }>({
    email: "", full_name: "", roles: ["business_admin"],
  });
  const [creatingMember, setCreatingMember] = useState(false);
  const [editMember, setEditMember] = useState<any | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);
  const [testType, setTestType] = useState<string>("test");
  const [testUserId, setTestUserId] = useState<string>("all");
  const [sendingTest, setSendingTest] = useState(false);

  const handleSendTestPush = async () => {
    setSendingTest(true);
    try {
      const now = new Date().toISOString();
      const data: Record<string, unknown> =
        testType === "order_paid"
          ? { amount: 250, tip: 30, payment_method: "cash", waiter_name: "Test", table_number: 1, order_id: "test", paid_at: now }
          : testType === "order_cancelled"
          ? { order_id: "test", table_number: 1, total: 250, reason: "Cliente canceló", waiter_name: "Test", cancelled_at: now }
          : testType === "low_stock"
          ? { item_name: "Producto de prueba", item_id: "test", inventory_count: 3, threshold: 5 }
          : testType === "out_of_stock"
          ? { item_name: "Producto de prueba", item_id: "test" }
          : { body: "Notificación de prueba desde Back-office" };
      const { data: res, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          type: testType,
          data,
          business_id: id,
          target_user_id: testUserId === "all" ? null : testUserId,
        },
      });
      if (error) throw error;
      toast({
        title: "Test sent",
        description: `Delivered to ${(res as any)?.sent ?? 0} of ${(res as any)?.total ?? 0} subscriptions. ${(res as any)?.message ?? ""}`,
      });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
    setSendingTest(false);
  };


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
      FEATURE_KEYS.forEach((k) => {
        const v = (f as any)[k];
        map[k] = OPT_IN_FEATURES.has(k) ? v === true : v !== false;
      });
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
    if (!memberForm.email || !memberForm.full_name || memberForm.roles.length === 0) return;
    setCreatingMember(true);
    try {
      const res = await supabase.functions.invoke("create-user", {
        body: { ...memberForm, business_id: id },
      });
      const errMsg = await extractEdgeError(res);
      if (errMsg) throw new Error(errMsg);
      toast({ title: "User invited" });
      setMemberDialog(false);
      setMemberForm({ email: "", full_name: "", roles: ["business_admin"] });
      await fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setCreatingMember(false); }
  };

  const openEditRoles = (userRow: any) => {
    setEditMember(userRow);
    setEditRoles([...userRow.roles]);
  };

  const handleSaveRoles = async () => {
    if (!editMember) return;
    setSavingRoles(true);
    try {
      const res = await supabase.functions.invoke("create-user", {
        body: { action: "update_roles", user_id: editMember.user_id, business_id: id, roles: editRoles },
      });
      const errMsg = await extractEdgeError(res);
      if (errMsg) throw new Error(errMsg);
      toast({ title: "Roles updated" });
      setEditMember(null);
      await fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSavingRoles(false); }
  };

  const removeMemberAllRoles = async (userId: string) => {
    if (!confirm("Remove this user from the business?")) return;
    const { error } = await supabase
      .from("business_members")
      .delete()
      .eq("business_id", id)
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await fetchAll();
  };


  const handleSendReset = async (email: string) => {
    if (!confirm(`Send password reset email to ${email}?`)) return;
    try {
      const res = await supabase.functions.invoke("create-user", {
        body: { action: "reset_password", email },
      });
      const errMsg = await extractEdgeError(res);
      if (errMsg) throw new Error(errMsg);
      toast({ title: "Success", description: "Password reset email sent" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (!business) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  type GroupedMember = { user_id: string; profiles: any; roles: string[] };
  const groupedMap = new Map<string, GroupedMember>();
  for (const m of members) {
    const existing = groupedMap.get(m.user_id);
    if (existing) existing.roles.push(m.role);
    else groupedMap.set(m.user_id, { user_id: m.user_id, profiles: m.profiles, roles: [m.role] });
  }
  const groupedMembers: GroupedMember[] = Array.from(groupedMap.values());





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
          <TabsTrigger value="members">Users ({groupedMembers.length})</TabsTrigger>
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
          <Card>
            <CardHeader>
              <div className="flex items-start gap-2">
                <Bell className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <CardTitle className="text-base">Test push notification</CardTitle>
                  <CardDescription>
                    Sends a notification to admins of this business who have subscribed on their device.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Event type</Label>
                <Select value={testType} onValueChange={setTestType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test (generic)</SelectItem>
                    <SelectItem value="order_paid">Order paid</SelectItem>
                    <SelectItem value="order_cancelled">Order cancelled</SelectItem>
                    <SelectItem value="low_stock">Low stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of stock</SelectItem>

                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Recipient</Label>
                <Select value={testUserId} onValueChange={setTestUserId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All admins</SelectItem>
                    {groupedMembers.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.profiles?.full_name || m.profiles?.email || m.user_id.slice(0, 8)} · {m.roles.join(", ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSendTestPush} disabled={sendingTest} className="gap-1">
                <Bell className="h-4 w-4" /> {sendingTest ? "Sending…" : "Send test notification"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Users</CardTitle>
                <CardDescription>Members and roles for this business. A user can hold multiple roles.</CardDescription>
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
                    <TableHead>Roles</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedMembers.map((m) => (
                    <TableRow key={m.user_id}>
                      <TableCell>{m.profiles?.full_name || "—"}</TableCell>
                      <TableCell>{m.profiles?.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {m.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditRoles(m)} title="Edit roles">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleSendReset(m.profiles?.email)} title="Send password reset email">
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeMemberAllRoles(m.user_id)} title="Remove from business">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {groupedMembers.length === 0 && (
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
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="space-y-2 rounded-md border border-border/60 p-3">
                {BUSINESS_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={memberForm.roles.includes(r)}
                      onCheckedChange={() =>
                        setMemberForm((p) => ({
                          ...p,
                          roles: p.roles.includes(r) ? p.roles.filter((x) => x !== r) : [...p.roles, r],
                        }))
                      }
                    />
                    <span className="text-sm">{r}</span>
                  </label>
                ))}
              </div>
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

      <Dialog open={!!editMember} onOpenChange={(o) => !o && setEditMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit roles — {editMember?.profiles?.full_name || editMember?.profiles?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 rounded-md border border-border/60 p-3">
            {BUSINESS_ROLES.map((r) => (
              <label key={r} className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={editRoles.includes(r)}
                  onCheckedChange={() =>
                    setEditRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r])
                  }
                />
                <span className="text-sm">{r}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>Cancel</Button>
            <Button onClick={handleSaveRoles} disabled={savingRoles || editRoles.length === 0}>
              {savingRoles ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default BusinessDetailPage;
