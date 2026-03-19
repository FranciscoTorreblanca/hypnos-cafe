import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "waiter" | "billing" | "kitchen" | "loyalty_member";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isLoyaltyMember: boolean;
  loyaltyMemberCode: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loyaltyMemberCode, setLoyaltyMemberCode] = useState<string | null>(null);

  const fetchRoles = async (userId: string) => {
    const [{ data: roleRows }, { data: loyaltyMember }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("loyalty_members").select("member_code").eq("user_id", userId).maybeSingle(),
    ]);

    const nextRoles = (roleRows ?? []).map((r) => r.role as AppRole);
    const hasLinkedLoyaltyMember = Boolean(loyaltyMember?.member_code);
    const normalizedRoles = hasLinkedLoyaltyMember && !nextRoles.includes("loyalty_member")
      ? [...nextRoles, "loyalty_member"]
      : nextRoles;

    setRoles(normalizedRoles);
    setLoyaltyMemberCode(loyaltyMember?.member_code ?? null);
    return normalizedRoles;
  };

  useEffect(() => {
    const syncAuthState = async (nextSession: Session | null) => {
      setLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await fetchRoles(nextSession.user.id);
      } else {
        setRoles([]);
        setLoyaltyMemberCode(null);
      }

      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncAuthState(nextSession);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => syncAuthState(session));

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole("admin");
  const isLoyaltyMember = roles.length > 0 && roles.every((role) => role === "loyalty_member");

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
    setLoyaltyMemberCode(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, roles, hasRole, isAdmin, isLoyaltyMember, loyaltyMemberCode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

