import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Copy } from "lucide-react";

interface BusinessRow {
  id: string; name: string; slug: string; status: string; currency: string; created_at: string;
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

const BusinessesPage = () => {
  const navigate = useNavigate();
  const { refreshBusiness } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [dialog, setDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", currency: "MXN" });
  const [slugTouched, setSlugTouched] = useState(false);

  const fetchRows = async () => {
    const { data } = await supabase
      .from("businesses")
      .select("id,name,slug,status,currency,created_at")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as BusinessRow[]);
  };

  useEffect(() => { void fetchRows(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const slug = form.slug.trim() || slugify(form.name);
      const { data, error } = await supabase
        .from("businesses")
        .insert({ name: form.name.trim(), slug, currency: form.currency })
        .select("id")
        .single();
      if (error) throw error;
      // Default feature flags
      await supabase.from("business_features").insert({ business_id: data.id });
      toast({ title: "Business created" });
      setDialog(false);
      setForm({ name: "", slug: "", currency: "MXN" });
      setSlugTouched(false);
      await fetchRows();
      await refreshBusiness();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Businesses</h1>
        <Button onClick={() => setDialog(true)} size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> New business
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All businesses ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/backoffice/businesses/${b.id}`)}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="font-mono text-xs">{b.slug}</TableCell>
                  <TableCell>{b.currency}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === "active" ? "default" : "secondary"}>{b.status}</Badge>
                  </TableCell>
                  <TableCell><Button variant="ghost" size="sm">Open</Button></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No businesses yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New business</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugTouched ? form.slug : slugify(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: slugify(e.target.value) }); }} />
              <p className="text-xs text-muted-foreground">Used in public URLs. Lowercase letters, numbers and dashes.</p>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.name.trim()}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessesPage;
