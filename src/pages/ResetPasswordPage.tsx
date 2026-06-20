import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";

type ErrInfo = { code?: string; description?: string };

const parseHashError = (): ErrInfo | null => {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  if (!params.get("error")) return null;
  return {
    code: params.get("error_code") || params.get("error") || undefined,
    description: params.get("error_description")?.replace(/\+/g, " ") || undefined,
  };
};

const detectLang = (): "es" | "en" => {
  try {
    const stored = localStorage.getItem("hypnos_lang");
    if (stored === "es" || stored === "en") return stored;
    const nav = (navigator.language || "es").toLowerCase();
    return nav.startsWith("en") ? "en" : "es";
  } catch {
    return "es";
  }
};

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<ErrInfo | null>(() => parseHashError());
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverSent, setRecoverSent] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Effective language: use context, fallback to device, fallback to Spanish
  const lang = linkError ? (language || detectLang()) : language;
  const tx = (es: string, en: string) => (lang === "en" ? en : es);

  useEffect(() => {
    if (linkError) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [linkError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: t("common.success"), description: t("auth.resetTitle") });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecovering(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoverEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setRecoverSent(true);
      toast({
        title: tx("Enviado", "Sent"),
        description: tx("Revisa tu correo para el nuevo enlace.", "Check your email for the new link."),
      });
    } catch (err: any) {
      toast({
        title: tx("Error", "Error"),
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setRecovering(false);
    }
  };

  if (linkError) {
    const isExpired = linkError.code === "otp_expired" || /expired/i.test(linkError.description || "");
    const title = isExpired
      ? tx("El enlace expiró", "The link has expired")
      : tx("Enlace inválido", "Invalid link");
    const desc = isExpired
      ? tx(
          "El enlace de invitación o restablecimiento ya no es válido. Ingresa tu correo y te enviaremos uno nuevo.",
          "Your invitation or reset link is no longer valid. Enter your email and we'll send you a new one.",
        )
      : tx(
          "No pudimos validar este enlace. Ingresa tu correo y te enviaremos uno nuevo.",
          "We couldn't validate this link. Enter your email and we'll send you a new one.",
        );

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{desc}</CardDescription>
          </CardHeader>
          {recoverSent ? (
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                {tx(
                  "Si el correo está registrado, recibirás un enlace en unos minutos.",
                  "If the email is registered, you'll receive a link in a few minutes.",
                )}
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                {tx("Volver al inicio de sesión", "Back to sign in")}
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleRecover}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recover-email">{tx("Correo electrónico", "Email")}</Label>
                  <Input
                    id="recover-email"
                    type="email"
                    value={recoverEmail}
                    onChange={(e) => setRecoverEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button type="submit" className="w-full" disabled={recovering}>
                  {recovering
                    ? tx("Enviando...", "Sending...")
                    : tx("Enviar nuevo enlace", "Send new link")}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => navigate("/auth")}>
                  {tx("Volver al inicio de sesión", "Back to sign in")}
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
              H
            </div>
            <CardTitle className="text-2xl">{t("auth.resetTitle")}</CardTitle>
            <CardDescription>{t("common.loading")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
            H
          </div>
          <CardTitle className="text-2xl">{t("auth.resetTitle")}</CardTitle>
          <CardDescription>{t("auth.newPassword")}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.newPassword")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("common.loading") : t("auth.resetPassword")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
