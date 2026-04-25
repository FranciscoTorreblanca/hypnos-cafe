import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEvents, useEventCostCategories, useEventCostItems, type CalendarEvent, type EventStatus, type EventType } from "@/hooks/useEvents";
import { useReservations } from "@/hooks/useReservations";
import { Trash2, Plus, Instagram, Share2, Download, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const EVENT_TYPES: EventType[] = ["live_music", "private", "promo", "workshop", "other"];
const EVENT_STATUSES: EventStatus[] = ["scheduled", "confirmed", "in_progress", "completed", "cancelled"];
const PRESET_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"];

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (val: string) => new Date(val).toISOString();

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  event: CalendarEvent | null;
  defaultStart?: Date | null;
  isAdmin: boolean;
}

export const EventDialog = ({ open, onOpenChange, event, defaultStart, isAdmin }: Props) => {
  const { t, language } = useLanguage();
  const { createEvent, updateEvent, deleteEvent } = useEvents();
  const { data: categories = [] } = useEventCostCategories();
  const { data: costItems = [], addItem, updateItem, deleteItem } = useEventCostItems(event?.id ?? null);
  const { data: reservations = [] } = useReservations(event?.id ?? null);

  const isNew = !event;

  const [form, setForm] = useState({
    name: "",
    description: "",
    event_type: "other" as EventType,
    status: "scheduled" as EventStatus,
    color: PRESET_COLORS[0],
    starts_at: "",
    ends_at: "",
    all_day: false,
    location: "",
    instagram_url: "",
    cover_image_url: "",
    capacity: "",
    cover_charge: "0",
    notes: "",
    is_public: false,
  });

  useEffect(() => {
    if (!open) return;
    if (event) {
      setForm({
        name: event.name,
        description: event.description,
        event_type: event.event_type,
        status: event.status,
        color: event.color,
        starts_at: toLocalInput(event.starts_at),
        ends_at: toLocalInput(event.ends_at),
        all_day: event.all_day,
        location: event.location,
        instagram_url: event.instagram_url,
        cover_image_url: event.cover_image_url ?? "",
        capacity: event.capacity?.toString() ?? "",
        cover_charge: event.cover_charge.toString(),
        notes: event.notes,
        is_public: event.is_public,
      });
    } else {
      const start = defaultStart ?? new Date();
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      setForm((f) => ({
        ...f,
        name: "",
        description: "",
        event_type: "other",
        status: "scheduled",
        color: PRESET_COLORS[0],
        starts_at: toLocalInput(start.toISOString()),
        ends_at: toLocalInput(end.toISOString()),
        all_day: false,
        location: "",
        instagram_url: "",
        cover_image_url: "",
        capacity: "",
        cover_charge: "0",
        notes: "",
        is_public: false,
      }));
    }
  }, [open, event, defaultStart]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.starts_at || !form.ends_at) {
      toast.error(language === "es" ? "Nombre y fechas son requeridos" : "Name and dates are required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description,
      event_type: form.event_type,
      status: form.status,
      color: form.color,
      starts_at: fromLocalInput(form.starts_at),
      ends_at: fromLocalInput(form.ends_at),
      all_day: form.all_day,
      location: form.location,
      instagram_url: form.instagram_url,
      cover_image_url: form.cover_image_url || null,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      cover_charge: parseFloat(form.cover_charge) || 0,
      notes: form.notes,
      is_public: form.is_public,
    };
    try {
      if (isNew) {
        await createEvent.mutateAsync(payload);
        toast.success(language === "es" ? "Evento creado" : "Event created");
      } else {
        await updateEvent.mutateAsync({ id: event!.id, ...payload });
        toast.success(language === "es" ? "Evento actualizado" : "Event updated");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    try {
      await deleteEvent.mutateAsync(event.id);
      toast.success(language === "es" ? "Evento eliminado" : "Event deleted");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const totalInvestment = costItems.reduce((s, i) => s + Number(i.amount || 0), 0);
  const depositsCollected = reservations
    .filter((r) => r.deposit_paid)
    .reduce((s, r) => s + Number(r.deposit_amount || 0), 0);
  const totalCovers = reservations
    .filter((r) => r.status !== "cancelled" && r.status !== "no_show")
    .reduce((s, r) => s + r.party_size, 0);
  const potentialCoverEarnings = totalCovers * Number(form.cover_charge || 0);
  const potentialNet = depositsCollected + potentialCoverEarnings - totalInvestment;

  const byCategory = categories.map((c) => ({
    ...c,
    total: costItems.filter((i) => i.category_key === c.key).reduce((s, i) => s + Number(i.amount), 0),
  }));
  const uncategorized = costItems
    .filter((i) => !i.category_key || !categories.find((c) => c.key === i.category_key))
    .reduce((s, i) => s + Number(i.amount), 0);

  const handleShare = () => {
    if (!event) return;
    const url = `${window.location.origin}/event/${event.id}`;
    navigator.clipboard.writeText(url);
    toast.success(t("event.linkCopied"));
  };

  const handleExportCsv = () => {
    if (!event) return;
    const rows = [
      ["Customer", "Phone", "Party size", "Reserved for", "Status", "Deposit", "Paid", "Notes"],
      ...reservations.map((r) => [
        r.customer_name, r.customer_phone, r.party_size,
        format(new Date(r.reserved_for), "yyyy-MM-dd HH:mm"),
        r.status, r.deposit_amount, r.deposit_paid ? "yes" : "no",
        r.notes.replace(/\n/g, " "),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reservations-${event.name}.csv`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: form.color }} />
            {isNew ? t("calendar.newEvent") : t("calendar.editEvent")}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">{t("calendar.eventDetails")}</TabsTrigger>
            <TabsTrigger value="cost" disabled={isNew}>{t("event.cost.title")}</TabsTrigger>
            <TabsTrigger value="reservations" disabled={isNew}>
              {t("calendar.reservations")} ({reservations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 pt-4">
            <div>
              <Label>{t("event.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!isAdmin} />
            </div>
            <div>
              <Label>{t("event.description")}</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!isAdmin} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("event.type")}</Label>
                <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v as EventType })} disabled={!isAdmin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((tp) => (
                      <SelectItem key={tp} value={tp}>{t(`event.type.${tp}` as any)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("event.status")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EventStatus })} disabled={!isAdmin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{t(`event.status.${s}` as any)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("event.startsAt")}</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} disabled={!isAdmin} />
              </div>
              <div>
                <Label>{t("event.endsAt")}</Label>
                <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} disabled={!isAdmin} />
              </div>
            </div>

            <div>
              <Label>{t("event.color")}</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => isAdmin && setForm({ ...form, color: c })}
                    className={`h-8 w-8 rounded-full border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("event.capacity")}</Label>
                <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} disabled={!isAdmin} />
              </div>
              <div>
                <Label>{t("event.coverCharge")}</Label>
                <Input type="number" step="0.01" value={form.cover_charge} onChange={(e) => setForm({ ...form, cover_charge: e.target.value })} disabled={!isAdmin} />
              </div>
            </div>

            <div>
              <Label>{t("event.location")}</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} disabled={!isAdmin} />
            </div>

            <div>
              <Label className="flex items-center gap-1"><Instagram className="h-4 w-4" />{t("event.instagram")}</Label>
              <Input value={form.instagram_url} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} disabled={!isAdmin} placeholder="https://instagram.com/p/..." />
            </div>

            <div>
              <Label>{t("event.coverImage")}</Label>
              <Input value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} disabled={!isAdmin} />
            </div>

            <div>
              <Label>{t("event.notes")}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={!isAdmin} />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label className="cursor-pointer">{t("event.public")}</Label>
              <Switch checked={form.is_public} onCheckedChange={(v) => setForm({ ...form, is_public: v })} disabled={!isAdmin} />
            </div>

            {!isNew && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />{t("event.copyLink")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleExportCsv}>
                  <Download className="h-4 w-4" />{t("event.exportCsv")}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="cost" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border p-3">
                <div className="text-muted-foreground text-xs">{t("event.cost.totalInvestment")}</div>
                <div className="text-lg font-semibold text-destructive">${totalInvestment.toFixed(2)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-muted-foreground text-xs">{t("event.cost.deposits")}</div>
                <div className="text-lg font-semibold">${depositsCollected.toFixed(2)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-muted-foreground text-xs">{t("event.cost.expectedCovers")}</div>
                <div className="text-lg font-semibold">{totalCovers} · ${potentialCoverEarnings.toFixed(2)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-muted-foreground text-xs">{t("event.cost.potentialEarnings")}</div>
                <div className={`text-lg font-semibold ${potentialNet >= 0 ? "text-primary" : "text-destructive"}`}>
                  ${potentialNet.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">{t("event.cost.byCategory")}</h4>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => addItem.mutate({
                    event_id: event!.id, category_key: categories[0]?.key ?? null,
                    name: "", amount: 0, notes: "", display_order: costItems.length,
                  })}>
                    <Plus className="h-4 w-4" />{t("event.cost.add")}
                  </Button>
                )}
              </div>

              {byCategory.filter((c) => c.total > 0).map((c) => (
                <div key={c.key} className="flex justify-between text-xs text-muted-foreground">
                  <span>{language === "es" ? c.label : (c.label_en || c.label)}</span>
                  <span>${c.total.toFixed(2)}</span>
                </div>
              ))}
              {uncategorized > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>—</span><span>${uncategorized.toFixed(2)}</span>
                </div>
              )}

              <div className="space-y-2 pt-2">
                {costItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-1 items-center border rounded-md p-2">
                    <Select
                      value={item.category_key ?? ""}
                      onValueChange={(v) => updateItem.mutate({ id: item.id, category_key: v || null })}
                      disabled={!isAdmin}
                    >
                      <SelectTrigger className="col-span-3 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.key} value={c.key}>{language === "es" ? c.label : (c.label_en || c.label)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input className="col-span-5 h-8 text-xs" placeholder={language === "es" ? "Concepto" : "Item"}
                      defaultValue={item.name}
                      onBlur={(e) => e.target.value !== item.name && updateItem.mutate({ id: item.id, name: e.target.value })}
                      disabled={!isAdmin} />
                    <Input className="col-span-3 h-8 text-xs" type="number" step="0.01"
                      defaultValue={item.amount}
                      onBlur={(e) => parseFloat(e.target.value) !== Number(item.amount) && updateItem.mutate({ id: item.id, amount: parseFloat(e.target.value) || 0 })}
                      disabled={!isAdmin} />
                    {isAdmin && (
                      <Button size="icon" variant="ghost" className="col-span-1 h-8 w-8" onClick={() => deleteItem.mutate(item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {costItems.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">—</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reservations" className="space-y-2 pt-4">
            {reservations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t("calendar.noReservations")}</p>
            )}
            {reservations.map((r) => (
              <div key={r.id} className="border rounded-md p-3 text-sm">
                <div className="flex justify-between">
                  <div className="font-medium">{r.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{t(`res.status.${r.status}` as any)}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(r.reserved_for), "PPp")} · {r.party_size} {language === "es" ? "personas" : "people"}
                </div>
                {r.deposit_amount > 0 && (
                  <div className="text-xs">
                    {t("res.deposit")}: ${Number(r.deposit_amount).toFixed(2)} {r.deposit_paid ? "✓" : ""}
                  </div>
                )}
                {r.notes && <div className="text-xs italic mt-1">{r.notes}</div>}
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          {!isNew && isAdmin ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4" />{t("event.delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("common.confirmDelete" as any)}</AlertDialogTitle>
                  <AlertDialogDescription>{event?.name}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>{t("common.delete")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            {isAdmin && <Button onClick={handleSave}>{t("common.save")}</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
