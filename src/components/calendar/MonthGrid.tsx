import { useMemo } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, format, addDays,
} from "date-fns";
import type { CalendarEvent } from "@/hooks/useEvents";
import type { Reservation } from "@/hooks/useReservations";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  monthDate: Date;
  events: CalendarEvent[];
  reservations: Reservation[];
  selectedDay: Date | null;
  onSelectDay: (d: Date) => void;
  onSelectEvent: (e: CalendarEvent) => void;
}

export const MonthGrid = ({ monthDate, events, reservations, selectedDay, onSelectDay, onSelectEvent }: Props) => {
  const { language } = useLanguage();
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [monthDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) =>
      format(addDays(start, i), "EEE", { locale: undefined as any })
    );
  }, []);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((e) => {
      const key = format(new Date(e.starts_at), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [events]);

  const resByDay = useMemo(() => {
    const map = new Map<string, number>();
    reservations.forEach((r) => {
      if (r.status === "cancelled" || r.status === "no_show") return;
      const key = format(new Date(r.reserved_for), "yyyy-MM-dd");
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [reservations]);

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="grid grid-cols-7 bg-muted text-xs font-medium">
        {weekDays.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center capitalize">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = isSameMonth(day, monthDate);
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const dayKey = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(dayKey) ?? [];
          const resCount = resByDay.get(dayKey) ?? 0;
          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "min-h-[68px] sm:min-h-[88px] border-t border-l p-1 text-left transition-colors",
                "hover:bg-accent/40",
                !inMonth && "bg-muted/30 text-muted-foreground",
                isSelected && "ring-2 ring-primary ring-inset z-10",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-xs font-medium inline-flex h-5 w-5 items-center justify-center rounded-full",
                  isToday && "bg-primary text-primary-foreground",
                )}>{format(day, "d")}</span>
                {resCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">{resCount}{language === "es" ? "r" : "r"}</span>
                )}
              </div>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 2).map((e) => (
                  <div
                    key={e.id}
                    onClick={(ev) => { ev.stopPropagation(); onSelectEvent(e); }}
                    className="truncate rounded px-1 py-[1px] text-[10px] text-white cursor-pointer"
                    style={{ background: e.color }}
                  >
                    {e.name}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
