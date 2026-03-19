import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Heart, ArrowRight, LogIn } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

const LoyaltyPublicPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredCode, setRegisteredCode] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;
    if (password.length < 6) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("loyalty-signup", {
        body: { name: name.trim(), email: email.trim(), phone: phone.trim(), password },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Auto-login after signup
      await supabase.auth.signInWithPassword({ email: email.trim(), password });

      setRegisteredCode(data.member.member_code);
    } catch (err: any) {
      const msg = err?.message?.includes("registrado") ? "Este email ya está registrado." : (err?.message || "Error al registrarse.");
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const qrUrl = registeredCode ? `${window.location.origin}/loyalty/${registeredCode}` : "";

  if (registeredCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <Heart className="mx-auto h-8 w-8 text-primary mb-2" />
            <CardTitle>¡Bienvenido!</CardTitle>
            <CardDescription>Tu tarjeta de lealtad está lista</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white p-4 rounded-lg inline-block mx-auto">
              <QRCodeSVG value={qrUrl} size={180} />
            </div>
            <p className="font-mono text-2xl font-bold tracking-widest">{registeredCode}</p>
            <p className="text-sm text-muted-foreground">Guarda esta página o toma un screenshot de tu código QR</p>
            <Button variant="outline" className="w-full" onClick={() => navigate(`/loyalty/${registeredCode}`)}>
              Ver mi tarjeta <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Heart className="mx-auto h-8 w-8 text-primary mb-2" />
          <CardTitle>Programa de Lealtad</CardTitle>
          <CardDescription>Regístrate y acumula visitas para obtener recompensas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono (opcional)</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Registrando..." : "Registrarme"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/loyalty-login" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              <LogIn className="h-3 w-3" /> ¿Ya tienes cuenta? Inicia sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoyaltyPublicPage;
