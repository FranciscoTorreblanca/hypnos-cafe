import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ScheduleEmployee = { id: string; business_id: string; user_id: string | null; name: string; phone: string; color: string; is_active: boolean };
export type ScheduleShift = { id: string; employee_id: string; weekday: number; start_time: string; end_time: string; notes: string };
export type ScheduleException = { id: string; employee_id: string; date: string; kind: "off" | "shift"; start_time: string | null; end_time: string | null; notes: string };
export type DayHours = { open: string; close: string; closed: boolean };
export type OpeningHours = Record<string, DayHours>; // key: weekday 0=Mon..6=Sun

export const DEFAULT_HOURS: OpeningHours = Object.fromEntries(
  Array.from({ length: 7 }, (_, i) => [String(i), { open: "08:00", close: "22:00", closed: false }]),
);

const sb = supabase as any;

export const weekdayOf = (d: Date) => (d.getDay() + 6) % 7;
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const hhmm = (t?: string | null) => (t ?? "").slice(0, 5);

export function useScheduleData() {
  const { currentBusinessId } = useAuth();
  const qc = useQueryClient();
  const key = ["schedule", currentBusinessId];
  const q = useQuery({
    queryKey: key,
    enabled: !!currentBusinessId,
    queryFn: async () => {
      const [e, s, x, h] = await Promise.all([
        sb.from("schedule_employees").select("*").eq("business_id", currentBusinessId).order("name"),
        sb.from("schedule_shifts").select("*").eq("business_id", currentBusinessId).order("start_time"),
        sb.from("schedule_exceptions").select("*").eq("business_id", currentBusinessId).order("date"),
        sb.from("restaurant_settings").select("value").eq("business_id", currentBusinessId).eq("key", "opening_hours").maybeSingle(),
      ]);
      for (const r of [e, s, x]) if (r.error) throw r.error;
      let hours: OpeningHours = DEFAULT_HOURS;
      try { if (h.data?.value) hours = { ...DEFAULT_HOURS, ...JSON.parse(h.data.value) }; } catch { /* ignore */ }
      return {
        employees: (e.data ?? []) as ScheduleEmployee[],
        shifts: (s.data ?? []) as ScheduleShift[],
        exceptions: (x.data ?? []) as ScheduleException[],
        hours,
      };
    },
  });
  return { ...q, reload: () => qc.invalidateQueries({ queryKey: key }) };
}

export type ResolvedShift = { employee_id: string; start: string; end: string; notes: string; exception: boolean; opens: boolean; closes: boolean };

/** Shifts for a given date: date exceptions replace the weekly template for that employee. */
export function shiftsForDate(
  date: Date,
  data: { shifts: ScheduleShift[]; exceptions: ScheduleException[]; hours: OpeningHours },
  employeeIds: string[],
): ResolvedShift[] {
  const wd = weekdayOf(date);
  const ds = isoDate(date);
  const h = data.hours[String(wd)];
  const out: ResolvedShift[] = [];
  for (const id of employeeIds) {
    const exc = data.exceptions.filter((x) => x.employee_id === id && x.date === ds);
    const rows = exc.length
      ? exc.filter((x) => x.kind === "shift" && x.start_time && x.end_time).map((x) => ({ start: hhmm(x.start_time), end: hhmm(x.end_time), notes: x.notes, exception: true }))
      : data.shifts.filter((s) => s.employee_id === id && s.weekday === wd).map((s) => ({ start: hhmm(s.start_time), end: hhmm(s.end_time), notes: s.notes, exception: false }));
    for (const r of rows) {
      out.push({
        employee_id: id, ...r,
        opens: !!h && !h.closed && r.start <= h.open,
        closes: !!h && !h.closed && r.end >= h.close,
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
