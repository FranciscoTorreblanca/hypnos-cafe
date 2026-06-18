import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBridgeStatus, useOpenSession } from "@/hooks/useAttendance";
import { captureFingerprint } from "@/lib/fingerprintBridge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, RotateCw, LogOut, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

const useNow = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return now;
};

const CheckInPage = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const now = useNow();
  const { status, refresh } = useBridgeStatus();
  const { loading, hasOpen, session, refresh: refreshSession } = useOpenSession(user?.id ?? null);
  const [busy, setBusy] = useState(false);

  const bridgeReady = status && status !== "loading" && status.reader_connected;

  const doCheckIn = async () => {
    if (!bridgeReady || !user) return;
    setBusy(true);
    try {
      const hash = await captureFingerprint("verify");
      const { error } = await (supabase as any).rpc("attempt_check_in", {
        _user_id: user.id, _device_id: null, _fingerprint_hash: hash, _method: "fingerprint",
      });
      if (error) throw error;
      toast({ title: "Checked in" });
      await refreshSession();
      navigate("/dashboard");
    } catch (e: any) {
      toast({ title: "Check-in failed", description: e.message ?? String(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const doCheckOut = async () => {
    if (!bridgeReady || !user) return;
    setBusy(true);
    try {
      const hash = await captureFingerprint("verify");
      const { error } = await (supabase as any).rpc("attempt_check_out", {
        _user_id: user.id, _device_id: null, _fingerprint_hash: hash, _method: "fingerprint",
      });
      if (error) throw error;
      toast({ title: "Checked out" });
      await refreshSession();
    } catch (e: any) {
      toast({ title: "Check-out failed", description: e.message ?? String(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Clock className="h-4 w-4" /> {now.toLocaleString()}
          </div>
          <CardTitle className="text-2xl mt-2">
            {hasOpen ? "Shift in progress" : "Start your shift"}
          </CardTitle>
          <CardDescription>
            {user?.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <p className="text-sm text-muted-foreground text-center">Detecting fingerprint reader…</p>
          )}

          {status !== "loading" && !bridgeReady && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Fingerprint reader not available</p>
                  <p className="text-muted-foreground mt-1">
                    This device cannot start a shift. Check in on the dedicated
                    time-clock device before entering the floor. If you already
                    did, tap retry.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={refresh} className="gap-1">
                  <RotateCw className="h-3.5 w-3.5" /> Retry
                </Button>
                <Button size="sm" variant="outline" onClick={() => { void refreshSession(); }}>
                  Refresh status
                </Button>
              </div>
            </div>
          )}

          {bridgeReady && !loading && hasOpen && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-3 text-sm flex gap-2 items-start">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p>Checked in at {new Date(session.check_in_at).toLocaleTimeString()}</p>
                  {session.scheduled_check_out && (
                    <p className="text-muted-foreground">
                      Scheduled end: {new Date(session.scheduled_check_out).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
              <Button className="w-full" onClick={() => navigate("/dashboard")}>
                Go to app
              </Button>
              <Button className="w-full gap-2" variant="outline" onClick={doCheckOut} disabled={busy}>
                <Fingerprint className="h-4 w-4" /> Check out
              </Button>
            </div>
          )}

          {bridgeReady && !loading && !hasOpen && (
            <Button className="w-full h-14 text-base gap-2" onClick={doCheckIn} disabled={busy}>
              <Fingerprint className="h-5 w-5" />
              {busy ? "Reading fingerprint…" : "Place finger to check in"}
            </Button>
          )}

          <Button variant="ghost" size="sm" className="w-full gap-1" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckInPage;
