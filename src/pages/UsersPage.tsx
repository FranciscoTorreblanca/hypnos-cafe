import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, KeyRound } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
}

const INTERNAL_ROLES = ["admin", "waiter", "billing", "kitchen"] as const;

const UsersPage = () => {
  const { t } = useLanguage();
  const { isAdmin, user, currentBusinessId } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ email: string; full_name: string; roles: string[] }>({ email: "", full_name: "", roles: [] });

  // Role editing state
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    if (!currentBusinessId) {
      setUsers([]);
      return;
    }
    // Internal staff: business_members for this business
    const { data: members } = await supabase
      .from("business_members")
      .select("user_id")
      .eq("business_id", currentBusinessId);
    // External loyalty members for this business (RLS already scopes, but be explicit)
    const { data: loyalty } = await supabase
      .from("loyalty_members")
      .select("user_id")
      .eq("business_id", currentBusinessId);

    const idSet = new Set<string>();
    (members ?? []).forEach((m: any) => m.user_id && idSet.add(m.user_id));
    (loyalty ?? []).forEach((l: any) => l.user_id && idSet.add(l.user_id));
    const ids = Array.from(idSet);
    if (ids.length === 0) {
      setUsers([]);
      return;
    }

    const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
    const { data: roles } = await supabase.from("user_roles").select("*").in("user_id", ids);
    if (profiles) {
      setUsers(
        profiles.map((p) => ({
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          is_active: p.is_active,
          roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
        }))
      );
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsers();
  }, [isAdmin, currentBusinessId]);

  const handleCreate = async () => {
    if (!form.email || !form.full_name || form.roles.length === 0) return;
    setCreating(true);
    try {
      const res = await supabase.functions.invoke("create-user", {
        body: { email: form.email, full_name: form.full_name, roles: form.roles, business_id: currentBusinessId },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: t("common.success"), description: t("users.created") });
      setDialogOpen(false);
      setForm({ email: "", full_name: "", roles: [] });
      fetchUsers();
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const openEditRoles = (u: UserProfile) => {
    if (u.id === user?.id) {
      toast({ title: t("common.error"), description: t("users.cannotEditSelf"), variant: "destructive" });
      return;
    }
    setEditUser(u);
    setEditRoles(u.roles.filter((r) => r !== "loyalty_member"));
    setEditDialogOpen(true);
  };

  const handleSaveRoles = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      // Delete existing internal roles
      const { error: delError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", editUser.id)
        .in("role", ["admin", "waiter", "billing", "kitchen"] as const);
      if (delError) throw delError;

      // Insert new roles
      if (editRoles.length > 0) {
        const rows = editRoles.map((role) => ({ user_id: editUser.id, role: role as any }));
        const { error: insError } = await supabase.from("user_roles").insert(rows);
        if (insError) throw insError;
      }

      toast({ title: t("common.success"), description: t("users.rolesUpdated") });
      setEditDialogOpen(false);
      setEditUser(null);
      fetchUsers();
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSendReset = async (u: UserProfile) => {
    if (!confirm(`Send password reset email to ${u.email}?`)) return;
    try {
      const res = await supabase.functions.invoke("create-user", {
        body: { action: "reset_password", email: u.email },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: t("common.success"), description: "Password reset email sent" });
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    }
  };

  const toggleRole = (role: string) => {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  if (!isAdmin) {
    return <p className="text-muted-foreground">{t("common.error")}</p>;
  }

  const internalUsers = users.filter((u) => !u.roles.includes("loyalty_member") || u.roles.some((r) => INTERNAL_ROLES.includes(r as any)));
  const externalUsers = users.filter((u) => u.roles.includes("loyalty_member") && !u.roles.some((r) => INTERNAL_ROLES.includes(r as any)));

  const renderUserTable = (list: UserProfile[], showEditButton: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("auth.fullName")}</TableHead>
          <TableHead>{t("auth.email")}</TableHead>
          <TableHead>{t("users.role")}</TableHead>
          <TableHead>Status</TableHead>
          {showEditButton && <TableHead className="w-10" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((u) => (
          <TableRow key={u.id}>
            <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
            <TableCell>{u.email}</TableCell>
            <TableCell>
              <div className="flex gap-1 flex-wrap">
                {u.roles.length > 0
                  ? u.roles.map((r) => (
                      <Badge key={r} variant="secondary">
                        {t(`role.${r}` as any)}
                      </Badge>
                    ))
                  : "—"}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={u.is_active ? "default" : "destructive"}>
                {u.is_active ? t("users.active") : t("users.inactive")}
              </Badge>
            </TableCell>
            {showEditButton && (
              <TableCell>
                {u.id !== user?.id && (
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => handleSendReset(u)} title="Send password reset email">
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditRoles(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
        {list.length === 0 && (
          <TableRow>
            <TableCell colSpan={showEditButton ? 5 : 4} className="text-center text-muted-foreground py-8">
              —
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("users.title")}</h1>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t("users.addUser")}
        </Button>
      </div>

      <Tabs defaultValue="internal">
        <TabsList>
          <TabsTrigger value="internal">{t("users.internalUsers")} ({internalUsers.length})</TabsTrigger>
          <TabsTrigger value="external">{t("users.externalUsers")} ({externalUsers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="internal">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("users.internalUsers")}</CardTitle>
            </CardHeader>
            <CardContent>{renderUserTable(internalUsers, true)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="external">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("users.externalUsers")}</CardTitle>
            </CardHeader>
            <CardContent>{renderUserTable(externalUsers, false)}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create user dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.addUser")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("auth.fullName")}</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("auth.email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("users.role")}</Label>
              <div className="space-y-2 rounded-md border border-border/60 p-3">
                {INTERNAL_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={form.roles.includes(r)}
                      onCheckedChange={() =>
                        setForm((p) => ({
                          ...p,
                          roles: p.roles.includes(r) ? p.roles.filter((x) => x !== r) : [...p.roles, r],
                        }))
                      }
                    />
                    <span className="text-sm">{t(`role.${r}` as any)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit roles dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.editRoles")} — {editUser?.full_name || editUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {INTERNAL_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={editRoles.includes(role)}
                  onCheckedChange={() => toggleRole(role)}
                />
                <span className="text-sm">{t(`role.${role}` as any)}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSaveRoles} disabled={saving}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
