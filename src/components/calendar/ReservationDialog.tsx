import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useReservations, type Reservation, type ReservationStatus } from "@/hooks/useReservations";
import { useEvents } from "@/hooks/useEvents";
import { Instagram, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUSES: ReservationStatus[] = ["pending", "confirmed", "cancelled", "no_show", "completed"];

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (val: string) => new Date(val).toISOString();

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reservation: Reservation | null;
  defaultDate?: Date | null;
  defaultEventId?: string | null;
  canDelete: boolean;
}

export const ReservationDialog = ({ open, onOpenChange, reservation, defaultDate, defaultEventId, canDelete }: Props) => {
  const { t, language } = useLanguage();
  const { createReservation, updateReservation, deleteReservation } = useReservations();
  const { data: events = [] } = useEvents();

  const isNew = !reservation;

  const [form, setForm] = useState({
    event_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_instagram: "",
    party_size: "2",
    reserved_for: "",
    table_number: "",
    status: "pending" as ReservationStatus,
    deposit_amount: "0",
    deposit_paid: false,
    deposit_method: "",
    deposit_reference: "",
    special_requests: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    if (reservation) {
      setForm({
        event_id: reservation.event_id ?? "",
        customer_name: reservation.customer_name,
        customer_phone: reservation.customer_phone,
        customer_email: reservation.customer_email,
        customer_instagram: reservation.customer_instagram ?? "",
        party_size: reservation.party_size.toString(),
        reserved_for: toLocalInput(reservation.reserved_for),
        table_number: reservation.table_number?.toString() ?? "",
        status: reservation.status,
        deposit_amount: reservation.deposit_amount.toString(),
        deposit_paid: reservation.deposit_paid,
        deposit_method: reservation.deposit_method,
        deposit_reference: reservation.deposit_reference,
        special_requests: reservation.special_requests,
        notes: reservation.notes,
      });
    } else {
      const linkedEvent = defaultEventId ? events.find((e) => e.id === defaultEventId) : null;
      const d = linkedEvent ? new Date(linkedEvent.starts_at) : (defaultDate ?? new Date());
      setForm({
        event_id: defaultEventId ?? "",
        customer_name: "",
        customer_phone: "",
        customer_email: "",
        customer_instagram: "",
        party_size: "2",
        reserved_for: toLocalInput(d.toISOString()),
        table_number: "",
        status: "pending",
        deposit_amount: "0",
        deposit_paid: false,
        deposit_method: "",
        deposit_reference: "",
        special_requests: "",
        notes: "",
      });
    }
  }, [open, reservation, defaultDate, defaultEventId, events]);

  // When user picks/changes a linked event on a NEW reservation, sync date to event start
  const handleEventChange = (newEventId: string) => {
    setForm((prev) => {
      const next = { ...prev, event_id: newEventId };
      if (isNew && newEventId) {
        const ev = events.find((e) => e.id === newEventId);
        if (ev) next.reserved_for = toLocalInput(ev.starts_at);
      }
      return next;
    });
  };

  const normalizeInstagram = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const handle = trimmed.replace(/^@/, "");
    return `https://instagram.com/${handle}`;
  };

  const handleSave = async () => {
    if (!form.customer_name.trim() || !form.reserved_for) {
      toast.error(language === "es" ? "Cliente y fecha requeridos" : "Customer and date required");
      return;
    }
    const payload = {
      event_id: form.event_id || null,
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone,
      customer_email: form.customer_email,
      customer_instagram: normalizeInstagram(form.customer_instagram),
      party_size: parseInt(form.party_size) || 1,
      reserved_for: fromLocalInput(form.reserved_for),
      table_number: form.table_number ? parseInt(form.table_number) : null,
      status: form.status,
      deposit_amount: parseFloat(form.deposit_amount) || 0,
      deposit_paid: form.deposit_paid,
      deposit_method: form.deposit_method,
      deposit_reference: form.deposit_reference,
      special_requests: form.special_requests,
      notes: form.notes,
    };
    try {
      if (isNew) {
        await createReservation.mutateAsync(payload);
        toast.success(language === "es" ? "Reserva creada" : "Reservation created");
      } else {
        await updateReservation.mutateAsync({ id: reservation!.id, ...payload });
        toast.success(language === "es" ? "Reserva actualizada" : "Reservation updated");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? t("calendar.newReservation") : t("calendar.editReservation")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>{t("res.linkedEvent")}</Label>
            <Select value={form.event_id || "none"} onValueChange={(v) => handleEventChange(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("res.noEvent")}</SelectItem>
                {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("res.customer")}</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div>
              <Label>{t("res.phone")}</Label>
              <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>{t("res.email")}</Label>
            <Input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
          </div>

          <div>
            <Label className="flex items-center gap-1.5">
              <Instagram className="h-3.5 w-3.5" />
              {t("res.instagram")}
            </Label>
            <div className="flex gap-2">
              <Input
                value={form.customer_instagram}
                onChange={(e) => setForm({ ...form, customer_instagram: e.target.value })}
                placeholder="@username"
              />
              {form.customer_instagram && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(normalizeInstagram(form.customer_instagram), "_blank")}
                  title={t("res.openInstagram")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t("res.partySize")}</Label>
              <Input type="number" min={1} value={form.party_size} onChange={(e) => setForm({ ...form, party_size: e.target.value })} />
            </div>
            <div>
              <Label>{t("res.table")}</Label>
              <Input type="number" value={form.table_number} onChange={(e) => setForm({ ...form, table_number: e.target.value })} />
            </div>
            <div>
              <Label>{t("res.status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ReservationStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`res.status.${s}` as any)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>{t("res.reservedFor")}</Label>
            <Input type="datetime-local" value={form.reserved_for} onChange={(e) => setForm({ ...form, reserved_for: e.target.value })} />
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">{t("res.deposit")}</Label>
              <div className="flex items-center gap-2">
                <Label className="text-xs">{t("res.depositPaid")}</Label>
                <Switch checked={form.deposit_paid} onCheckedChange={(v) => setForm({ ...form, deposit_paid: v })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" step="0.01" placeholder="$" value={form.deposit_amount}
                onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} />
              <Input placeholder={t("res.depositMethod")} value={form.deposit_method}
                onChange={(e) => setForm({ ...form, deposit_method: e.target.value })} />
              <Input placeholder={t("res.depositRef")} value={form.deposit_reference}
                onChange={(e) => setForm({ ...form, deposit_reference: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>{t("res.specialRequests")}</Label>
            <Textarea value={form.special_requests} onChange={(e) => setForm({ ...form, special_requests: e.target.value })} />
          </div>

          <div>
            <Label>{t("res.notes")}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={language === "es" ? "Ej: pagado, $500 a cuenta, 2 personas, indicaciones especiales..." : "E.g.: paid, $500 deposit, 2 people, special instructions..."}
            />
          </div>
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          {!isNew && canDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("common.confirmDelete" as any)}</AlertDialogTitle>
                  <AlertDialogDescription>{reservation?.customer_name}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={async () => {
                    await deleteReservation.mutateAsync(reservation!.id);
                    onOpenChange(false);
                  }}>{t("common.delete")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave}>{t("common.save")}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
