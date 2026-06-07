import { normalizeSearch } from "@/lib/utils";
import { useMemo, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays, Users, Instagram, MapPin, Search,
} from "lucide-react";
import { addMonths, format, isSameDay, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { useEvents, type CalendarEvent } from "@/hooks/useEvents";
import { useReservations, type Reservation, type ReservationStatus } from "@/hooks/useReservations";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { EventDialog } from "@/components/calendar/EventDialog";
import { ReservationDialog } from "@/components/calendar/ReservationDialog";

const STATUS_VARIANT: Record<ReservationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  confirmed: "default",
  cancelled: "destructive",
  no_show: "destructive",
  completed: "secondary",
};

const CalendarPage = () => {
  const { t, language } = useLanguage();
  const { isAdmin, hasRole } = useAuth();
  const canManageRes = isAdmin || hasRole("waiter") || hasRole("billing");

  const { data: events = [], isLoading: loadingEvents } = useEvents();
  const { data: reservations = [], isLoading: loadingRes } = useReservations();

  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const [eventOpen, setEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [resOpen, setResOpen] = useState(false);
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "all">("all");

  const dayEvents = useMemo(
    () => selectedDay ? events.filter((e) => isSameDay(new Date(e.starts_at), selectedDay)) : [],
    [events, selectedDay],
  );
  const dayReservations = useMemo(
    () => selectedDay
      ? reservations.filter((r) => isSameDay(new Date(r.reserved_for), selectedDay))
      : [],
    [reservations, selectedDay],
  );

  const upcomingEvents = useMemo(() => {
    const now = startOfDay(new Date());
    return events.filter((e) => !isBefore(new Date(e.starts_at), now));
  }, [events]);

  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.customer_name.toLowerCase().includes(q) &&
            !r.customer_phone.toLowerCase().includes(q) &&
            !r.customer_email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [reservations, search, statusFilter]);

  const openNewEvent = () => { setEditingEvent(null); setEventOpen(true); };
  const openEvent = (e: CalendarEvent) => { setEditingEvent(e); setEventOpen(true); };
  const openNewRes = () => { setEditingRes(null); setResOpen(true); };
  const openRes = (r: Reservation) => { setEditingRes(r); setResOpen(true); };

  return (
    <>
      <div className="space-y-4 max-w-7xl mx-auto pb-24">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("calendar.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("calendar.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            {canManageRes && (
              <Button size="sm" variant="outline" onClick={openNewRes}>
                <Plus className="h-4 w-4" />{t("calendar.newReservation")}
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" onClick={openNewEvent}>
                <Plus className="h-4 w-4" />{t("calendar.newEvent")}
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calendar"><CalendarDays className="h-4 w-4 mr-1" />{t("calendar.month")}</TabsTrigger>
            <TabsTrigger value="events">{t("calendar.events")} ({upcomingEvents.length})</TabsTrigger>
            <TabsTrigger value="reservations"><Users className="h-4 w-4 mr-1" />{t("calendar.reservations")}</TabsTrigger>
          </TabsList>

          {/* CALENDAR / MONTH VIEW */}
          <TabsContent value="calendar" className="space-y-3 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => setMonthDate(addMonths(monthDate, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-semibold capitalize min-w-[140px] text-center">
                  {format(monthDate, "MMMM yyyy")}
                </div>
                <Button size="icon" variant="ghost" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setMonthDate(new Date()); setSelectedDay(new Date()); }}>
                {t("calendar.today")}
              </Button>
            </div>

            <MonthGrid
              monthDate={monthDate}
              events={events}
              reservations={reservations}
              selectedDay={selectedDay}
              onSelectDay={(d) => setSelectedDay(d)}
              onSelectEvent={openEvent}
            />

            {selectedDay && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base capitalize">
                    {format(selectedDay, "PPPP")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dayEvents.length === 0 && dayReservations.length === 0 && (
                    <p className="text-xs text-muted-foreground">{t("calendar.noEvents")}</p>
                  )}
                  {dayEvents.map((e) => (
                    <button key={e.id} onClick={() => openEvent(e)}
                      className="w-full text-left rounded-md border p-2 hover:bg-accent/40 transition">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{e.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(e.starts_at), "p")} – {format(new Date(e.ends_at), "p")}
                            {e.location && <> · <MapPin className="inline h-3 w-3" /> {e.location}</>}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{t(`event.status.${e.status}` as any)}</Badge>
                      </div>
                    </button>
                  ))}
                  {dayReservations.length > 0 && (
                    <div className="pt-2">
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        {t("calendar.reservations")} ({dayReservations.length})
                      </div>
                      {dayReservations.map((r) => (
                        <button key={r.id} onClick={() => openRes(r)}
                          className="w-full text-left rounded-md border p-2 mb-1 hover:bg-accent/40">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{r.customer_name}</span>
                            <Badge variant={STATUS_VARIANT[r.status]} className="text-[10px]">
                              {t(`res.status.${r.status}` as any)}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(r.reserved_for), "p")} · {r.party_size} {language === "es" ? "personas" : "ppl"}
                            {r.deposit_amount > 0 && <> · ${Number(r.deposit_amount).toFixed(0)} {r.deposit_paid ? "✓" : "·"}</>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* EVENTS LIST */}
          <TabsContent value="events" className="space-y-2 pt-3">
            {loadingEvents && <p className="text-sm text-muted-foreground">…</p>}
            {!loadingEvents && upcomingEvents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t("calendar.noEvents")}</p>
            )}
            {upcomingEvents.map((e) => (
              <button key={e.id} onClick={() => openEvent(e)}
                className="w-full text-left rounded-lg border p-3 hover:bg-accent/40 transition">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: e.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{e.name}</span>
                      <Badge variant="outline" className="text-[10px]">{t(`event.type.${e.event_type}` as any)}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t(`event.status.${e.status}` as any)}</Badge>
                      {e.is_public && <Badge className="text-[10px]">Public</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(e.starts_at), "PPp")}
                      {e.location && <> · {e.location}</>}
                    </div>
                    {e.instagram_url && (
                      <a href={e.instagram_url} target="_blank" rel="noreferrer"
                        onClick={(ev) => ev.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-primary mt-1">
                        <Instagram className="h-3 w-3" /> Instagram
                      </a>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </TabsContent>

          {/* RESERVATIONS LIST */}
          <TabsContent value="reservations" className="space-y-3 pt-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder={t("res.customer")}
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "es" ? "Todos" : "All"}</SelectItem>
                  {(["pending","confirmed","cancelled","no_show","completed"] as ReservationStatus[]).map((s) =>
                    <SelectItem key={s} value={s}>{t(`res.status.${s}` as any)}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {loadingRes && <p className="text-sm text-muted-foreground">…</p>}
            {!loadingRes && filteredReservations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t("calendar.noReservations")}</p>
            )}

            <div className="space-y-2">
              {filteredReservations.map((r) => {
                const linkedEvent = events.find((e) => e.id === r.event_id);
                return (
                  <button key={r.id} onClick={() => openRes(r)}
                    className="w-full text-left rounded-lg border p-3 hover:bg-accent/40">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{r.customer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(r.reserved_for), "PPp")} · {r.party_size} {language === "es" ? "personas" : "ppl"}
                          {r.customer_phone && <> · {r.customer_phone}</>}
                        </div>
                        {linkedEvent && (
                          <div className="text-xs text-primary mt-0.5">→ {linkedEvent.name}</div>
                        )}
                        {r.notes && <div className="text-xs italic mt-1 line-clamp-2">{r.notes}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={STATUS_VARIANT[r.status]} className="text-[10px]">
                          {t(`res.status.${r.status}` as any)}
                        </Badge>
                        {r.deposit_amount > 0 && (
                          <div className="text-xs mt-1">
                            ${Number(r.deposit_amount).toFixed(0)} {r.deposit_paid ? "✓" : "·"}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <EventDialog
        open={eventOpen}
        onOpenChange={setEventOpen}
        event={editingEvent}
        defaultStart={selectedDay}
        isAdmin={isAdmin}
      />
      <ReservationDialog
        open={resOpen}
        onOpenChange={setResOpen}
        reservation={editingRes}
        defaultDate={selectedDay}
        canDelete={isAdmin}
      />
    </>
  );
};

export default CalendarPage;
