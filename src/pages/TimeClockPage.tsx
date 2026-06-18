import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBridgeStatus, setStoredDeviceToken } from "@/hooks/useAttendance";
import { captureFingerprint } from "@/lib/fingerprintBridge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, AlertTriangle, RotateCw, CheckCircle2 } from "lucide-react";

const useNow = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return now;
};

interface MemberRow { user_id: string; email: string; full_name: string; openSessionId?: string | null }

const TimeClockPage = () => {
  const { currentBusinessId, currentBusiness } = useAuth();
  const { status, refresh } = useBridgeStatus();
  const { toast } = useToast();
  const now = useNow();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const bridgeReady = status && status !== "loading" && status.reader_connected;

  const load = async () => {
    if (!currentBusinessId) return;
    const { data: m } = await supabase.from("business_members")
      .select("user_id").eq("business_id", currentBusinessId);
    const ids = (m ?? []).map((x: any) => x.user_id);
    if (ids.length === 0) { setMembers([]); return; }
    const [{ data: profs }, { data: open }] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name").in("id", ids),
      (supabase as any).from("attendance_sessions")
        .select("id,user_id").is("check_out_at", null).in("user_id", ids),
    ]);
    const openMap = new Map<string, string>((open ?? []).map((s: any) => [s.user_id, s.id]));
    setMembers((profs ?? []).map((p: any) => ({
      user_id: p.id, email: p.email, full_name: p.full_name,
      openSessionId: openMap.get(p.id) ?? null,
    })));
  };

  useEffect(() => { void load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [currentBusinessId]);

  const punch = async (m: MemberRow) => {
    if (!bridgeReady) return;
    setBusy(true); setFeedback(null);
    try {
      const hash = await captureFingerprint("verify");
      const fnName = m.openSessionId ? "attempt_check_out" : "attempt_check_in";
      const { error } = await (supabase as any).rpc(fnName, {
        _user_id: m.user_id, _device_id: null, _fingerprint_hash: hash, _method: "fingerprint",
      });
      if (error) throw error;
      setFeedback(`${m.openSessionId ? "Checked out" : "Checked in"}: ${m.full_name || m.email}`);
      await load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message ?? String(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col">
      <header className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold">{currentBusiness?.name ?? "Time Clock"}</h1>
          <p className="text-muted-foreground text-sm">Tap your name and place your finger on the reader.</p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-light tabular-nums">{now.toLocaleTimeString()}</div>
          <div className="text-xs text-muted-foreground">{now.toLocaleDateString()}</div>
        </div>
      </header>

      {!bridgeReady ? (
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Time clock unavailable</p>
                <p className="text-muted-foreground">Reconnect the USB fingerprint reader to continue.</p>
              </div>
            </div>
            <Button onClick={refresh} variant="outline" size="sm" className="gap-1">
              <RotateCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {feedback && (
            <div className="max-w-2xl mx-auto mb-4 rounded-md bg-primary/10 text-primary px-4 py-2 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> {feedback}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-5xl mx-auto w-full">
            {members.map((m) => (
              <Button
                key={m.user_id}
                variant={m.openSessionId ? "secondary" : "outline"}
                className="h-24 flex flex-col gap-1 text-base"
                disabled={busy}
                onClick={() => punch(m)}
              >
                <Fingerprint className="h-5 w-5" />
                <span className="truncate w-full text-center">{m.full_name || m.email}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {m.openSessionId ? "Tap to check out" : "Tap to check in"}
                </span>
              </Button>
            ))}
            {members.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-12">No users in this business.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TimeClockPage;
