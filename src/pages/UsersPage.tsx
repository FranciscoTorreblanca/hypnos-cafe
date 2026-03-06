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
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
}

const ROLES = ["admin", "waiter", "billing", "kitchen"] as const;

const UsersPage = () => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", role: "" });

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");
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
  }, [isAdmin]);

  const handleCreate = async () => {
    if (!form.email || !form.full_name || !form.role) return;
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("create-user", {
        body: form,
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: t("common.success"), description: t("users.created") });
      setDialogOpen(false);
      setForm({ email: "", password: "", full_name: "", role: "" });
      fetchUsers();
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (!isAdmin) {
    return <p className="text-muted-foreground">{t("common.error")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("users.title")}</h1>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t("users.addUser")}
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("users.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("auth.fullName")}</TableHead>
                <TableHead>{t("auth.email")}</TableHead>
                <TableHead>{t("users.role")}</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
              <Label>{t("auth.password")}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>{t("users.role")}</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("users.selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`role.${r}` as any)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    </div>
  );
};

export default UsersPage;
