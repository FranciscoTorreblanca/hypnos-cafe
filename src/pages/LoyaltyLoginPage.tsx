import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Heart } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

const LoyaltyLoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Get member code to redirect
      const { data: member } = await supabase
        .from("loyalty_members")
        .select("member_code")
        .eq("email", email)
        .maybeSingle();

      if (member) {
        navigate(`/loyalty/${member.member_code}`);
      } else {
        toast({ title: "Error", description: "No se encontró tu membresía de lealtad.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: "Credenciales incorrectas.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Heart className="mx-auto h-8 w-8 text-primary mb-2" />
          <CardTitle>Programa de Lealtad</CardTitle>
          <CardDescription>Inicia sesión para ver tu tarjeta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/loyalty" className="text-sm text-primary hover:underline">
              ¿No tienes cuenta? Regístrate
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoyaltyLoginPage;
