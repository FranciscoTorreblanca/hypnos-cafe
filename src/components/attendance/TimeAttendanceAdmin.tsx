import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, MonitorSmartphone, Plus, Trash2, Copy, Clock } from "lucide-react";
import { useBridgeStatus, setStoredDeviceToken } from "@/hooks/useAttendance";
import { captureFingerprint } from "@/lib/fingerprintBridge";

const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function randomToken() {
  const b = new Uint8Array(24); crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2,"0")).join("");
}

export const TimeAttendanceAdmin = () => {
  const { currentBusinessId } = useAuth();
  const { toast } = useToast();
  const { status, refresh } = useBridgeStatus();

  // Devices
  const [devices, setDevices] = useState<any[]>([]);
  const [newDeviceLabel, setNewDeviceLabel] = useState("");
  const [tokenDialog, setTokenDialog] = useState<{ label: string; token: string } | null>(null);

  // Members + fingerprints + schedules
  const [members, setMembers] = useState<any[]>([]);
  const [fingerprints, setFingerprints] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [enrollFor, setEnrollFor] = useState<any | null>(null);
  const [scheduleFor, setScheduleFor] = useState<any | null>(null);
  const [scheduleForm, setScheduleForm] = useState<any>({
    weekday: null, check_in_time: "09:00", check_out_time: "18:00",
    early_window_minutes: 15, late_window_minutes: 30, auto_logout_offset_minutes: 60, active: true,
  });

  const load = async () => {
    if (!currentBusinessId) return;
    const [{ data: d }, { data: m }, { data: fp }, { data: sc }] = await Promise.all([
      (supabase as any).from("attendance_devices").select("*").eq("business_id", currentBusinessId).order("created_at"),
      supabase.from("business_members").select("user_id").eq("business_id", currentBusinessId),
      (supabase as any).from("user_fingerprints").select("*").eq("business_id", currentBusinessId),
      (supabase as any).from("user_shift_schedules").select("*").eq("business_id", currentBusinessId),
    ]);
    setDevices(d ?? []);
    setFingerprints(fp ?? []);
    setSchedules(sc ?? []);
    const ids = (m ?? []).map((x: any) => x.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,email,full_name").in("id", ids);
      setMembers(profs ?? []);
    } else setMembers([]);
  };

  useEffect(() => { void load(); }, [currentBusinessId]);

  const createDevice = async () => {
    if (!newDeviceLabel.trim() || !currentBusinessId) return;
    const token = randomToken();
    const hash = await sha256Hex(token);
    const { error } = await (supabase as any).from("attendance_devices").insert({
      business_id: currentBusinessId, label: newDeviceLabel.trim(), device_token_hash: hash,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setTokenDialog({ label: newDeviceLabel.trim(), token });
    setNewDeviceLabel("");
    await load();
  };

  const toggleTimeClock = async (id: string, value: boolean) => {
    await (supabase as any).from("attendance_devices").update({ is_time_clock: value }).eq("id", id);
    await load();
  };

  const deleteDevice = async (id: string) => {
    if (!confirm("Remove this device?")) return;
    await (supabase as any).from("attendance_devices").delete().eq("id", id);
    await load();
  };

  const assignAsThis = (token: string) => {
    setStoredDeviceToken(token);
    toast({ title: "This device paired", description: "Reload /check-in or /time-clock to apply." });
  };

  const enrollFingerprint = async () => {
    if (!enrollFor || !currentBusinessId) return;
    if (!status || status === "loading" || !status.reader_connected) {
      toast({ title: "Reader unavailable", description: "Connect the USB fingerprint reader first.", variant: "destructive" });
      return;
    }
    try {
      const hash = await captureFingerprint("enroll");
      const { error } = await (supabase as any).from("user_fingerprints").insert({
        business_id: currentBusinessId, user_id: enrollFor.id, template_hash: hash,
      });
      if (error) throw error;
      toast({ title: "Fingerprint enrolled" });
      setEnrollFor(null);
      await load();
    } catch (e: any) {
      toast({ title: "Enroll failed", description: e.message ?? String(e), variant: "destructive" });
    }
  };

  const deleteFingerprint = async (id: string) => {
    if (!confirm("Remove this fingerprint?")) return;
    await (supabase as any).from("user_fingerprints").delete().eq("id", id);
    await load();
  };

  const openSchedule = (userRow: any) => {
    setScheduleFor(userRow);
    const existing = schedules.find((s) => s.user_id === userRow.id && s.weekday === null);
    setScheduleForm(existing ?? {
      weekday: null, check_in_time: "09:00", check_out_time: "18:00",
      early_window_minutes: 15, late_window_minutes: 30, auto_logout_offset_minutes: 60, active: true,
    });
  };

  const saveSchedule = async () => {
    if (!scheduleFor || !currentBusinessId) return;
    const row = { ...scheduleForm, business_id: currentBusinessId, user_id: scheduleFor.id, weekday: scheduleForm.weekday };
    const { error } = await (supabase as any)
      .from("user_shift_schedules")
      .upsert(row, { onConflict: "business_id,user_id,weekday" });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Schedule saved" });
    setScheduleFor(null);
    await load();
  };

  const fpCount = (uid: string) => fingerprints.filter((f) => f.user_id === uid).length;
  const schedSummary = (uid: string) => {
    const s = schedules.find((x) => x.user_id === uid && x.weekday === null);
    return s ? `${s.check_in_time?.slice(0,5)}–${s.check_out_time?.slice(0,5)}` : "—";
  };

  return (
    <div className="space-y-6">
      {/* Bridge status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Fingerprint className="h-4 w-4" /> Fingerprint reader
          </CardTitle>
          <CardDescription>Status of the USB fingerprint bridge running on this device.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm">
          {status === "loading" && <span className="text-muted-foreground">Checking…</span>}
          {status && status !== "loading" && status.reader_connected && (
            <Badge className="bg-emerald-600">Connected{status.version ? ` · v${status.version}` : ""}</Badge>
          )}
          {status === null && <Badge variant="destructive">Bridge not running</Badge>}
          {status && status !== "loading" && !status.reader_connected && (
            <Badge variant="destructive">Reader unplugged</Badge>
          )}
          <Button size="sm" variant="outline" onClick={refresh}>Recheck</Button>
        </CardContent>
      </Card>

      {/* Devices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4" /> Time-clock devices
          </CardTitle>
          <CardDescription>
            Pair physical machines that act as kiosks. When "Time clock" is on, that device shows the
            full-screen kiosk at <code>/time-clock</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Device label (e.g. Front desk)" value={newDeviceLabel}
              onChange={(e) => setNewDeviceLabel(e.target.value)} />
            <Button onClick={createDevice} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Time clock</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.label}</TableCell>
                  <TableCell>
                    <Switch checked={d.is_time_clock} onCheckedChange={(v) => toggleTimeClock(d.id, v)} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteDevice(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {devices.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No devices yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Users: fingerprints & schedules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Users · fingerprints & schedules
          </CardTitle>
          <CardDescription>Enroll a fingerprint per user and define their daily shift window.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Fingerprints</TableHead>
                <TableHead>Default shift</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.full_name || u.email}</TableCell>
                  <TableCell>{fpCount(u.id)}</TableCell>
                  <TableCell>{schedSummary(u.id)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setEnrollFor(u)}>Enroll</Button>
                      <Button size="sm" variant="outline" onClick={() => openSchedule(u)}>Shift</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {members.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No users</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Token dialog */}
      <Dialog open={!!tokenDialog} onOpenChange={(o) => !o && setTokenDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Device paired: {tokenDialog?.label}</DialogTitle>
            <DialogDescription>
              Copy this token — it's shown only once. Open the kiosk URL on the target machine and the device will register itself.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Token</Label>
              <div className="flex gap-2">
                <Input readOnly value={tokenDialog?.token ?? ""} />
                <Button variant="outline" onClick={() => tokenDialog && navigator.clipboard.writeText(tokenDialog.token)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Kiosk URL</Label>
              <Input readOnly value={`${window.location.origin}/time-clock?device=${tokenDialog?.token ?? ""}`} />
            </div>
            <Button variant="outline" className="w-full" onClick={() => tokenDialog && assignAsThis(tokenDialog.token)}>
              Use THIS device as the time-clock
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setTokenDialog(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll fingerprint */}
      <Dialog open={!!enrollFor} onOpenChange={(o) => !o && setEnrollFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll fingerprint — {enrollFor?.full_name || enrollFor?.email}</DialogTitle>
            <DialogDescription>Place the finger on the reader, then save.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {fingerprints.filter((f) => f.user_id === enrollFor?.id).map((f) => (
              <div key={f.id} className="flex items-center justify-between text-xs border rounded px-2 py-1">
                <code className="truncate max-w-[14rem]">{f.template_hash}</code>
                <Button variant="ghost" size="icon" onClick={() => deleteFingerprint(f.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollFor(null)}>Close</Button>
            <Button onClick={enrollFingerprint} className="gap-2">
              <Fingerprint className="h-4 w-4" /> Capture & save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule editor */}
      <Dialog open={!!scheduleFor} onOpenChange={(o) => !o && setScheduleFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shift schedule — {scheduleFor?.full_name || scheduleFor?.email}</DialogTitle>
            <DialogDescription>Default applies every day. Use weekday rules for exceptions.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Weekday</Label>
              <Select
                value={scheduleForm.weekday === null ? "default" : String(scheduleForm.weekday)}
                onValueChange={(v) => setScheduleForm({ ...scheduleForm, weekday: v === "default" ? null : Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (all days)</SelectItem>
                  {WEEKDAYS.map((w, i) => <SelectItem key={i} value={String(i)}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Check-in time</Label>
              <Input type="time" value={scheduleForm.check_in_time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, check_in_time: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Check-out time</Label>
              <Input type="time" value={scheduleForm.check_out_time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, check_out_time: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Early window (min)</Label>
              <Input type="number" value={scheduleForm.early_window_minutes}
                onChange={(e) => setScheduleForm({ ...scheduleForm, early_window_minutes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Late grace (min)</Label>
              <Input type="number" value={scheduleForm.late_window_minutes}
                onChange={(e) => setScheduleForm({ ...scheduleForm, late_window_minutes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Auto-logout after check-out (min)</Label>
              <Input type="number" value={scheduleForm.auto_logout_offset_minutes}
                onChange={(e) => setScheduleForm({ ...scheduleForm, auto_logout_offset_minutes: Number(e.target.value) })} />
            </div>
            <div className="col-span-2 flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={scheduleForm.active}
                onCheckedChange={(v) => setScheduleForm({ ...scheduleForm, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleFor(null)}>Cancel</Button>
            <Button onClick={saveSchedule}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
