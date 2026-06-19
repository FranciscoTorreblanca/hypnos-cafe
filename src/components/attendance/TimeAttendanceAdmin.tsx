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
import { useLanguage } from "@/i18n/LanguageContext";
import { Fingerprint, MonitorSmartphone, Plus, Trash2, Copy, Clock } from "lucide-react";
import { useBridgeStatus, setStoredDeviceToken } from "@/hooks/useAttendance";
import { captureFingerprint } from "@/lib/fingerprintBridge";

const WEEKDAY_KEYS = [
  "att.weekday.mon", "att.weekday.tue", "att.weekday.wed", "att.weekday.thu",
  "att.weekday.fri", "att.weekday.sat", "att.weekday.sun",
] as const;

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
  const { t } = useLanguage();
  const { status, refresh } = useBridgeStatus();

  const [devices, setDevices] = useState<any[]>([]);
  const [newDeviceLabel, setNewDeviceLabel] = useState("");
  const [tokenDialog, setTokenDialog] = useState<{ label: string; token: string } | null>(null);

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
    if (error) { toast({ title: t("att.error"), description: error.message, variant: "destructive" }); return; }
    setTokenDialog({ label: newDeviceLabel.trim(), token });
    setNewDeviceLabel("");
    await load();
  };

  const toggleTimeClock = async (id: string, value: boolean) => {
    await (supabase as any).from("attendance_devices").update({ is_time_clock: value }).eq("id", id);
    await load();
  };

  const deleteDevice = async (id: string) => {
    if (!confirm(t("att.removeDevice"))) return;
    await (supabase as any).from("attendance_devices").delete().eq("id", id);
    await load();
  };

  const assignAsThis = (token: string) => {
    setStoredDeviceToken(token);
    toast({ title: t("att.thisDevicePaired"), description: t("att.reloadHint") });
  };

  const enrollFingerprint = async () => {
    if (!enrollFor || !currentBusinessId) return;
    if (!status || status === "loading" || !status.reader_connected) {
      toast({ title: t("att.readerUnavailableShort"), description: t("att.connectReaderFirst"), variant: "destructive" });
      return;
    }
    try {
      const hash = await captureFingerprint("enroll");
      const { error } = await (supabase as any).from("user_fingerprints").insert({
        business_id: currentBusinessId, user_id: enrollFor.id, template_hash: hash,
      });
      if (error) throw error;
      toast({ title: t("att.fingerprintEnrolled") });
      setEnrollFor(null);
      await load();
    } catch (e: any) {
      toast({ title: t("att.enrollFailed"), description: e.message ?? String(e), variant: "destructive" });
    }
  };

  const deleteFingerprint = async (id: string) => {
    if (!confirm(t("att.removeFingerprint"))) return;
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
    if (error) { toast({ title: t("att.error"), description: error.message, variant: "destructive" }); return; }
    toast({ title: t("att.scheduleSaved") });
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Fingerprint className="h-4 w-4" /> {t("att.reader")}
          </CardTitle>
          <CardDescription>{t("att.readerDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm">
          {status === "loading" && <span className="text-muted-foreground">{t("att.checking")}</span>}
          {status && status !== "loading" && status.reader_connected && (
            <Badge className="bg-emerald-600">{t("att.connected")}{status.version ? ` · v${status.version}` : ""}</Badge>
          )}
          {status === null && <Badge variant="destructive">{t("att.bridgeNotRunning")}</Badge>}
          {status && status !== "loading" && !status.reader_connected && (
            <Badge variant="destructive">{t("att.readerUnplugged")}</Badge>
          )}
          <Button size="sm" variant="outline" onClick={refresh}>{t("att.recheck")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4" /> {t("att.devices")}
          </CardTitle>
          <CardDescription>{t("att.devicesDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder={t("att.deviceLabel")} value={newDeviceLabel}
              onChange={(e) => setNewDeviceLabel(e.target.value)} />
            <Button onClick={createDevice} className="gap-1"><Plus className="h-4 w-4" /> {t("att.add")}</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("att.label")}</TableHead>
                <TableHead>{t("att.timeClockCol")}</TableHead>
                <TableHead>{t("att.lastSeen")}</TableHead>
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
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">{t("att.noDevices")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> {t("att.usersTitle")}
          </CardTitle>
          <CardDescription>{t("att.usersDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("att.user")}</TableHead>
                <TableHead>{t("att.fingerprints")}</TableHead>
                <TableHead>{t("att.defaultShift")}</TableHead>
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
                      <Button size="sm" variant="outline" onClick={() => setEnrollFor(u)}>{t("att.enroll")}</Button>
                      <Button size="sm" variant="outline" onClick={() => openSchedule(u)}>{t("att.shift")}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {members.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">{t("att.noUsers")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!tokenDialog} onOpenChange={(o) => !o && setTokenDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("att.devicePaired")} {tokenDialog?.label}</DialogTitle>
            <DialogDescription>{t("att.devicePairedDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("att.token")}</Label>
              <div className="flex gap-2">
                <Input readOnly value={tokenDialog?.token ?? ""} />
                <Button variant="outline" onClick={() => tokenDialog && navigator.clipboard.writeText(tokenDialog.token)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("att.kioskUrl")}</Label>
              <Input readOnly value={`${window.location.origin}/time-clock?device=${tokenDialog?.token ?? ""}`} />
            </div>
            <Button variant="outline" className="w-full" onClick={() => tokenDialog && assignAsThis(tokenDialog.token)}>
              {t("att.useThisDevice")}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setTokenDialog(null)}>{t("att.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!enrollFor} onOpenChange={(o) => !o && setEnrollFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("att.enrollTitle")} {enrollFor?.full_name || enrollFor?.email}</DialogTitle>
            <DialogDescription>{t("att.enrollDesc")}</DialogDescription>
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
            <Button variant="outline" onClick={() => setEnrollFor(null)}>{t("att.close")}</Button>
            <Button onClick={enrollFingerprint} className="gap-2">
              <Fingerprint className="h-4 w-4" /> {t("att.captureSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!scheduleFor} onOpenChange={(o) => !o && setScheduleFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("att.scheduleTitle")} {scheduleFor?.full_name || scheduleFor?.email}</DialogTitle>
            <DialogDescription>{t("att.scheduleDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>{t("att.weekday")}</Label>
              <Select
                value={scheduleForm.weekday === null ? "default" : String(scheduleForm.weekday)}
                onValueChange={(v) => setScheduleForm({ ...scheduleForm, weekday: v === "default" ? null : Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t("att.defaultAllDays")}</SelectItem>
                  {WEEKDAY_KEYS.map((k, i) => <SelectItem key={i} value={String(i)}>{t(k)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("att.checkInTime")}</Label>
              <Input type="time" value={scheduleForm.check_in_time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, check_in_time: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{t("att.checkOutTime")}</Label>
              <Input type="time" value={scheduleForm.check_out_time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, check_out_time: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{t("att.earlyWindow")}</Label>
              <Input type="number" value={scheduleForm.early_window_minutes}
                onChange={(e) => setScheduleForm({ ...scheduleForm, early_window_minutes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>{t("att.lateWindow")}</Label>
              <Input type="number" value={scheduleForm.late_window_minutes}
                onChange={(e) => setScheduleForm({ ...scheduleForm, late_window_minutes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>{t("att.autoLogout")}</Label>
              <Input type="number" value={scheduleForm.auto_logout_offset_minutes}
                onChange={(e) => setScheduleForm({ ...scheduleForm, auto_logout_offset_minutes: Number(e.target.value) })} />
            </div>
            <div className="col-span-2 flex items-center justify-between">
              <Label>{t("att.active")}</Label>
              <Switch checked={scheduleForm.active}
                onCheckedChange={(v) => setScheduleForm({ ...scheduleForm, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleFor(null)}>{t("att.cancel")}</Button>
            <Button onClick={saveSchedule}>{t("att.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
