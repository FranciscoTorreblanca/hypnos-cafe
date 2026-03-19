import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isLoyaltyMember } = useAuth();
  const [memberCode, setMemberCode] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (isLoyaltyMember && user) {
      setChecking(true);
      supabase
        .from("loyalty_members")
        .select("member_code")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          setMemberCode(data?.member_code ?? null);
          setChecking(false);
        });
    }
  }, [isLoyaltyMember, user]);

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (isLoyaltyMember) {
    return <Navigate to={memberCode ? `/loyalty/${memberCode}` : "/loyalty-login"} replace />;
  }

  return <>{children}</>;
};