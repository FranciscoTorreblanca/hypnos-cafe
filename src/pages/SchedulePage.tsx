import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Trash2, Sunrise, Sunset, Pencil } from "lucide-react";
import { DAY_NAMES } from "@/components/settings/OpeningHoursAdmin";
import {
  useScheduleData, shiftsForDate, weekdayOf, isoDate, hhmm,
  type ScheduleEmployee, type ResolvedShift,
} from "@/hooks/useSchedule";

const sb = supabase as any;
const COLORS = ["#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#6366f1"];

const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - weekdayOf(x)); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const SchedulePage = () => {
  const { user, isAdmin, currentBusinessId } = useAuth();
  const { language } = useLanguage();
  const es = language === "es";
  const L = (a: string, b: string) => (es ? a : b);
  const { toast } = useToast();
  const { data, isLoading, reload } = useScheduleData();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const employees = (data?.employees ?? []).filter((e) => e.is_active);
  const empById = Object.fromEntries((data?.employees ?? []).map((e) => [e.id, e]));
  const me = data?.employees.find((e) => e.user_id === user?.id);
  const todayStr = isoDate(new Date());
  const fmtDay = (d: Date) => d.toLocaleDateString(es ? "es-MX" : "en-US", { weekday: "short", day: "numeric", month: "short" });

  const err = (e: any) => toast({ title: "Error", description: e?.message ?? String(e), variant: "destructive" });

  const WeekNav = (
    <div className="flex items-center justify-between gap-2">
      <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
      <button className="text-sm font-medium" onClick={() => setWeekStart(startOfWeek(new Date()))}>
        {fmtDay(days[0])} – {fmtDay(days[6])}
      </button>
      <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );

  const ShiftChip = ({ s, showName = true }: { s: ResolvedShift; showName?: boolean }) => {
    const e = empById[s.employee_id];
    return (
      <div className="rounded-md border-l-4 bg-muted/50 px-2 py-1 text-xs" style={{ borderLeftColor: e?.color }}>
        <div className="flex items-center gap-1 flex-wrap">
          {showName && <span className="font-medium">{e?.name}</span>}
          <span className="tabular-nums text-muted-foreground">{s.start}–{s.end}</span>
          {s.opens && <Badge variant="secondary" className="h-4 px-1 text-[10px] gap-0.5"><Sunrise className="h-3 w-3" />{L("Abre", "Opens")}</Badge>}
          {s.closes && <Badge variant="secondary" className="h-4 px-1 text-[10px] gap-0.5"><Sunset className="h-3 w-3" />{L("Cierra", "Closes")}</Badge>}
          {s.exception && <Badge variant="outline" className="h-4 px-1 text-[10px]">{L("Especial", "Special")}</Badge>}
        </div>
        {s.notes && <div className="text-muted-foreground">{s.notes}</div>}
      </div>
    );
  };

  const hoursLabel = (d: Date) => {
    const h = data?.hours[String(weekdayOf(d))];
    return !h || h.closed ? L("Cerrado", "Closed") : `${h.open}–${h.close}`;
  };

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">{L("Cargando…", "Loading…")}</div>;

  const allIds = employees.map((e) => e.id);

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">{L("Horarios", "Schedule")}</h1>
      <Tabs defaultValue={me ? "mine" : "week"}>
        <TabsList>
          <TabsTrigger value="mine">{L("Mi horario", "My schedule")}</TabsTrigger>
          <TabsTrigger value="week">{L("General", "Everyone")}</TabsTrigger>
          {isAdmin && <TabsTrigger value="manage">{L("Gestionar", "Manage")}</TabsTrigger>}
        </TabsList>

        {/* My schedule */}
        <TabsContent value="mine" className="space-y-3">
          {WeekNav}
          {!me ? (
            <p className="text-sm text-muted-foreground">{L("Aún no tienes horario asignado.", "You don't have a schedule yet.")}</p>
          ) : (() => {
            const perDay = days.map((d) => ({ d, s: shiftsForDate(d, data, [me.id]) }));
            const opens = perDay.filter((x) => x.s.some((s) => s.opens)).length;
            const closes = perDay.filter((x) => x.s.some((s) => s.closes)).length;
            return (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Card><CardContent className="p-3 flex items-center gap-2"><Sunrise className="h-5 w-5 text-primary" /><div><div className="text-xl font-semibold">{opens}</div><div className="text-xs text-muted-foreground">{L("Días que abres", "Days you open")}</div></div></CardContent></Card>
                  <Card><CardContent className="p-3 flex items-center gap-2"><Sunset className="h-5 w-5 text-primary" /><div><div className="text-xl font-semibold">{closes}</div><div className="text-xs text-muted-foreground">{L("Días que cierras", "Days you close")}</div></div></CardContent></Card>
                </div>
                {perDay.map(({ d, s }) => (
                  <Card key={d.toISOString()} className={isoDate(d) === todayStr ? "border-primary" : ""}>
                    <CardContent className="p-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium capitalize">{fmtDay(d)}</div>
                        <div className="text-xs text-muted-foreground">{L("Restaurante", "Restaurant")}: {hoursLabel(d)}</div>
                      </div>
                      <div className="space-y-1 text-right">
                        {s.length ? s.map((x, i) => <ShiftChip key={i} s={x} showName={false} />) : <span className="text-sm text-muted-foreground">{L("Descanso", "Off")}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            );
          })()}
        </TabsContent>

        {/* General */}
        <TabsContent value="week" className="space-y-3">
          {WeekNav}
          <div className="grid gap-2 md:grid-cols-7">
            {days.map((d) => {
              const s = shiftsForDate(d, data, allIds);
              return (
                <Card key={d.toISOString()} className={isoDate(d) === todayStr ? "border-primary" : ""}>
                  <CardHeader className="p-2 pb-1">
                    <CardTitle className="text-sm capitalize">{fmtDay(d)}</CardTitle>
                    <div className="text-[11px] text-muted-foreground">{hoursLabel(d)}</div>
                  </CardHeader>
                  <CardContent className="p-2 pt-0 space-y-1">
                    {s.length ? s.map((x, i) => <ShiftChip key={i} s={x} />) : <span className="text-xs text-muted-foreground">—</span>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="manage">
            <ManageSchedule data={data} reload={reload} businessId={currentBusinessId!} L={L} language={language} err={err} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

type ManageProps = {
  data: NonNullable<ReturnType<typeof useScheduleData>["data"]>;
  reload: () => void; businessId: string; L: (a: string, b: string) => string;
  language: "es" | "en"; err: (e: any) => void;
};

const ManageSchedule = ({ data, reload, businessId, L, language, err }: ManageProps) => {
  const [members, setMembers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [empDialog, setEmpDialog] = useState<Partial<ScheduleEmployee> | null>(null);
  const [shiftDialog, setShiftDialog] = useState<{ employee_id: string; weekdays: number[]; start_time: string; end_time: string; notes: string } | null>(null);
  const [excDialog, setExcDialog] = useState<{ employee_id: string; date: string; kind: "off" | "shift"; start_time: string; end_time: string; notes: string } | null>(null);
  const days = DAY_NAMES[language];

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase.from("business_members").select("user_id").eq("business_id", businessId);
      const ids = (m ?? []).map((x: any) => x.user_id);
      if (!ids.length) return;
      const { data: p } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      setMembers((p ?? []) as any);
    })();
  }, [businessId]);

  const run = async (p: PromiseLike<{ error: any }>) => { const { error } = await p; if (error) { err(error); return false; } reload(); return true; };

  const saveEmp = async () => {
    if (!empDialog?.name?.trim()) return;
    const row = { name: empDialog.name.trim(), phone: empDialog.phone ?? "", color: empDialog.color ?? COLORS[0], user_id: empDialog.user_id ?? null, is_active: empDialog.is_active ?? true, business_id: businessId };
    const ok = await run(empDialog.id ? sb.from("schedule_employees").update(row).eq("id", empDialog.id) : sb.from("schedule_employees").insert(row));
    if (ok) setEmpDialog(null);
  };

  const saveShift = async () => {
    if (!shiftDialog || !shiftDialog.weekdays.length) return;
    if (shiftDialog.end_time <= shiftDialog.start_time) return err(L("La salida debe ser después de la entrada", "End must be after start"));
    const rows = shiftDialog.weekdays.map((w) => ({ business_id: businessId, employee_id: shiftDialog.employee_id, weekday: w, start_time: shiftDialog.start_time, end_time: shiftDialog.end_time, notes: shiftDialog.notes }));
    if (await run(sb.from("schedule_shifts").insert(rows))) setShiftDialog(null);
  };

  const saveExc = async () => {
    if (!excDialog?.date) return;
    const shift = excDialog.kind === "shift";
    if (shift && excDialog.end_time <= excDialog.start_time) return err(L("La salida debe ser después de la entrada", "End must be after start"));
    const row = { business_id: businessId, employee_id: excDialog.employee_id, date: excDialog.date, kind: excDialog.kind, start_time: shift ? excDialog.start_time : null, end_time: shift ? excDialog.end_time : null, notes: excDialog.notes };
    if (await run(sb.from("schedule_exceptions").insert(row))) setExcDialog(null);
  };

  const today = isoDate(new Date());
  const linked = new Set(data.employees.map((e) => e.user_id).filter(Boolean));

  return (
    <div className="space-y-3">
      <Button onClick={() => setEmpDialog({ color: COLORS[data.employees.length % COLORS.length], is_active: true })} className="gap-1">
        <Plus className="h-4 w-4" /> {L("Agregar empleado", "Add employee")}
      </Button>

      {data.employees.length === 0 && <p className="text-sm text-muted-foreground">{L("Agrega empleados para empezar.", "Add employees to get started.")}</p>}

      {data.employees.map((e) => {
        const shifts = data.shifts.filter((s) => s.employee_id === e.id).sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
        const exc = data.exceptions.filter((x) => x.employee_id === e.id && x.date >= today);
        return (
          <Card key={e.id} className={e.is_active ? "" : "opacity-60"}>
            <CardHeader className="p-3 pb-2 flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: e.color }} />
                <CardTitle className="text-base">{e.name}</CardTitle>
                <Badge variant="outline" className="text-[10px]">{e.user_id ? L("Usuario", "App user") : L("Solo horario", "Schedule only")}</Badge>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEmpDialog(e)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm(L("¿Eliminar empleado y sus turnos?", "Delete employee and their shifts?")) && run(sb.from("schedule_employees").delete().eq("id", e.id))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">{L("Turnos semanales", "Weekly shifts")}</span>
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setShiftDialog({ employee_id: e.id, weekdays: [], start_time: "09:00", end_time: "17:00", notes: "" })}><Plus className="h-3 w-3" /> {L("Turno", "Shift")}</Button>
                </div>
                {shifts.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                {shifts.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1">
                    <span className="w-24">{days[s.weekday]}</span>
                    <span className="tabular-nums flex-1">{hhmm(s.start_time)}–{hhmm(s.end_time)} {s.notes && <span className="text-muted-foreground text-xs">· {s.notes}</span>}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => run(sb.from("schedule_shifts").delete().eq("id", s.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">{L("Excepciones (próximas)", "Upcoming exceptions")}</span>
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setExcDialog({ employee_id: e.id, date: today, kind: "off", start_time: "09:00", end_time: "17:00", notes: "" })}><Plus className="h-3 w-3" /> {L("Excepción", "Exception")}</Button>
                </div>
                {exc.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                {exc.map((x) => (
                  <div key={x.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1">
                    <span className="w-24 tabular-nums">{x.date}</span>
                    <span className="flex-1">{x.kind === "off" ? L("Descanso", "Day off") : `${hhmm(x.start_time)}–${hhmm(x.end_time)}`} {x.notes && <span className="text-muted-foreground text-xs">· {x.notes}</span>}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => run(sb.from("schedule_exceptions").delete().eq("id", x.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Employee dialog */}
      <Dialog open={!!empDialog} onOpenChange={(o) => !o && setEmpDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{empDialog?.id ? L("Editar empleado", "Edit employee") : L("Nuevo empleado", "New employee")}</DialogTitle></DialogHeader>
          {empDialog && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{L("Usuario de la app (opcional)", "App user (optional)")}</Label>
                <Select value={empDialog.user_id ?? "none"} onValueChange={(v) => {
                  const m = members.find((x) => x.id === v);
                  setEmpDialog({ ...empDialog, user_id: v === "none" ? null : v, name: empDialog.name || m?.full_name || m?.email || "" });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{L("Ninguno (solo horario)", "None (schedule only)")}</SelectItem>
                    {members.filter((m) => !linked.has(m.id) || m.id === empDialog.user_id).map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>{L("Nombre", "Name")}</Label><Input value={empDialog.name ?? ""} onChange={(e) => setEmpDialog({ ...empDialog, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>{L("Teléfono", "Phone")}</Label><Input value={empDialog.phone ?? ""} onChange={(e) => setEmpDialog({ ...empDialog, phone: e.target.value })} /></div>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setEmpDialog({ ...empDialog, color: c })}
                    className={`h-7 w-7 rounded-full border-2 ${empDialog.color === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
                ))}
              </div>
              <div className="flex items-center justify-between"><Label>{L("Activo", "Active")}</Label><Switch checked={empDialog.is_active ?? true} onCheckedChange={(v) => setEmpDialog({ ...empDialog, is_active: v })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={saveEmp}>{L("Guardar", "Save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift dialog */}
      <Dialog open={!!shiftDialog} onOpenChange={(o) => !o && setShiftDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{L("Nuevo turno semanal", "New weekly shift")}</DialogTitle></DialogHeader>
          {shiftDialog && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {days.map((n, i) => {
                  const on = shiftDialog.weekdays.includes(i);
                  return (
                    <Button key={i} size="sm" type="button" variant={on ? "default" : "outline"}
                      onClick={() => setShiftDialog({ ...shiftDialog, weekdays: on ? shiftDialog.weekdays.filter((w) => w !== i) : [...shiftDialog.weekdays, i] })}>
                      {n.slice(0, 3)}
                    </Button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>{L("Entrada", "Start")}</Label><Input type="time" value={shiftDialog.start_time} onChange={(e) => setShiftDialog({ ...shiftDialog, start_time: e.target.value })} /></div>
                <div className="space-y-1"><Label>{L("Salida", "End")}</Label><Input type="time" value={shiftDialog.end_time} onChange={(e) => setShiftDialog({ ...shiftDialog, end_time: e.target.value })} /></div>
              </div>
              <div className="space-y-1"><Label>{L("Nota", "Note")}</Label><Input value={shiftDialog.notes} onChange={(e) => setShiftDialog({ ...shiftDialog, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={saveShift} disabled={!shiftDialog?.weekdays.length}>{L("Guardar", "Save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exception dialog */}
      <Dialog open={!!excDialog} onOpenChange={(o) => !o && setExcDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{L("Excepción por fecha", "Date exception")}</DialogTitle></DialogHeader>
          {excDialog && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{L("Reemplaza el turno semanal de ese día.", "Replaces the weekly shift for that day.")}</p>
              <div className="space-y-1"><Label>{L("Fecha", "Date")}</Label><Input type="date" value={excDialog.date} onChange={(e) => setExcDialog({ ...excDialog, date: e.target.value })} /></div>
              <Select value={excDialog.kind} onValueChange={(v: any) => setExcDialog({ ...excDialog, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">{L("Descanso", "Day off")}</SelectItem>
                  <SelectItem value="shift">{L("Turno especial", "Special shift")}</SelectItem>
                </SelectContent>
              </Select>
              {excDialog.kind === "shift" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>{L("Entrada", "Start")}</Label><Input type="time" value={excDialog.start_time} onChange={(e) => setExcDialog({ ...excDialog, start_time: e.target.value })} /></div>
                  <div className="space-y-1"><Label>{L("Salida", "End")}</Label><Input type="time" value={excDialog.end_time} onChange={(e) => setExcDialog({ ...excDialog, end_time: e.target.value })} /></div>
                </div>
              )}
              <div className="space-y-1"><Label>{L("Nota", "Note")}</Label><Input value={excDialog.notes} onChange={(e) => setExcDialog({ ...excDialog, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={saveExc}>{L("Guardar", "Save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchedulePage;
