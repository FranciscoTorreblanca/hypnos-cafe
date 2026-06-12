import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

const SuperAdminsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [admins, setAdmins] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAdmins = async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, profiles:user_id(email, full_name)")
      .eq("role", "super_admin" as any);
    setAdmins(roles ?? []);
  };

  useEffect(() => { void fetchAdmins(); }, []);

  const handlePromote = async () => {
    if (!email.trim()) return;
    setSaving(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      if (!profile) throw new Error("User not found. They must sign up first.");
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: profile.id, role: "super_admin" as any });
      if (error && !error.message.includes("duplicate")) throw error;
      toast({ title: "Super admin added" });
      setEmail("");
      await fetchAdmins();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleRevoke = async (userId: string) => {
    if (userId === user?.id) {
      toast({ title: "Cannot revoke yourself", variant: "destructive" });
      return;
    }
    if (!confirm("Revoke super admin?")) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "super_admin" as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await fetchAdmins();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Super Admins</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add super admin</CardTitle>
          <CardDescription>User must have an existing account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <Button onClick={handlePromote} disabled={saving || !email.trim()} className="self-end">
              {saving ? "Adding…" : "Promote"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Current super admins ({admins.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((a) => (
                <TableRow key={a.user_id}>
                  <TableCell>{a.profiles?.full_name || "—"}</TableCell>
                  <TableCell>{a.profiles?.email}</TableCell>
                  <TableCell>
                    {a.user_id !== user?.id && (
                      <Button variant="ghost" size="icon" onClick={() => handleRevoke(a.user_id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminsPage;
