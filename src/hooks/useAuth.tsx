import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "waiter" | "billing" | "kitchen" | "loyalty_member" | "super_admin";

export type FeatureKey =
  | "tickets" | "calendar" | "loyalty" | "kitchen" | "cost_calculator"
  | "stock" | "budget" | "analytics" | "push_notifications"
  | "mercado_pago" | "menu_generator" | "wifi" | "time_attendance" | "cash_closing";

export interface BusinessSummary {
  id: string;
  name: string;
  slug: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isBusinessAdmin: boolean;
  currentBusinessRoles: string[];
  isLoyaltyMember: boolean;
  loyaltyMemberCode: string | null;
  businesses: BusinessSummary[];
  currentBusinessId: string | null;
  currentBusiness: BusinessSummary | null;
  features: Record<FeatureKey, boolean>;
  hasFeature: (key: FeatureKey) => boolean;
  switchBusiness: (id: string) => Promise<void>;
  refreshBusiness: () => Promise<void>;
  signOut: () => Promise<void>;
}

const ALL_FEATURES_ON: Record<FeatureKey, boolean> = {
  tickets: true, calendar: true, loyalty: true, kitchen: true, cost_calculator: true,
  stock: true, budget: true, analytics: true, push_notifications: true,
  mercado_pago: true, menu_generator: true, wifi: true, time_attendance: false, cash_closing: false,
};

const STORAGE_KEY = "hypnos.currentBusinessId";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loyaltyMemberCode, setLoyaltyMemberCode] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>(ALL_FEATURES_ON);

  // Invalidate all cached queries whenever the active business changes so
  // every hook re-fetches scoped data without each one needing to key by it.
  useEffect(() => {
    if (currentBusinessId) queryClient.invalidateQueries();
  }, [currentBusinessId, queryClient]);

  const fetchRoles = async (userId: string) => {
    const [{ data: roleRows }, { data: loyaltyMember }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("loyalty_members").select("member_code").eq("user_id", userId).maybeSingle(),
    ]);
    const nextRoles = (roleRows ?? []).map((r) => r.role as AppRole);
    const hasLinkedLoyaltyMember = Boolean(loyaltyMember?.member_code);
    const normalizedRoles: AppRole[] = hasLinkedLoyaltyMember && !nextRoles.includes("loyalty_member")
      ? [...nextRoles, "loyalty_member"]
      : nextRoles;
    setRoles(normalizedRoles);
    setLoyaltyMemberCode(loyaltyMember?.member_code ?? null);
    return normalizedRoles;
  };

  const fetchBusinesses = async (userId: string, currentRoles: AppRole[]) => {
    const isSuper = currentRoles.includes("super_admin");
    let list: BusinessSummary[] = [];
    if (isSuper) {
      const { data } = await supabase.from("businesses").select("id,name,slug").order("name");
      list = data ?? [];
    } else {
      const { data } = await supabase
        .from("business_members")
        .select("business_id, is_default, businesses:business_id(id,name,slug)")
        .eq("user_id", userId);
      list = (data ?? [])
        .map((row: any) => row.businesses)
        .filter(Boolean)
        .sort((a: BusinessSummary, b: BusinessSummary) => a.name.localeCompare(b.name));
    }
    setBusinesses(list);

    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const validStored = list.find((b) => b.id === stored)?.id ?? null;
    const fallback = list[0]?.id ?? null;
    const chosen = validStored ?? fallback;
    setCurrentBusinessId(chosen);
    if (chosen && typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, chosen);
    if (chosen) {
      await supabase.rpc("set_active_business", { _business_id: chosen });
      await fetchFeatures(chosen);
    }
  };

  const fetchFeatures = async (businessId: string) => {
    const { data } = await supabase
      .from("business_features")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();
    if (data) {
      const next: Record<FeatureKey, boolean> = { ...ALL_FEATURES_ON };
      (Object.keys(ALL_FEATURES_ON) as FeatureKey[]).forEach((k) => {
        if (typeof (data as any)[k] === "boolean") next[k] = (data as any)[k];
      });
      setFeatures(next);
    } else {
      setFeatures(ALL_FEATURES_ON);
    }
  };

  useEffect(() => {
    let currentUserId: string | null = null;
    const syncAuthState = async (nextSession: Session | null, opts: { initial?: boolean } = {}) => {
      const nextUserId = nextSession?.user?.id ?? null;
      const userChanged = nextUserId !== currentUserId;
      if (opts.initial || userChanged) setLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (userChanged) {
        if (nextSession?.user) {
          const nextRoles = await fetchRoles(nextSession.user.id);
          await fetchBusinesses(nextSession.user.id, nextRoles);
        } else {
          setRoles([]);
          setLoyaltyMemberCode(null);
          setBusinesses([]);
          setCurrentBusinessId(null);
          setFeatures(ALL_FEATURES_ON);
        }
      }
      currentUserId = nextUserId;
      if (opts.initial || userChanged) setLoading(false);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { void syncAuthState(s); });
    void supabase.auth.getSession().then(({ data: { session } }) => syncAuthState(session, { initial: true }));
    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole("admin");
  const isSuperAdmin = hasRole("super_admin");
  const isLoyaltyMember = roles.length > 0 && roles.every((role) => role === "loyalty_member");
  const hasFeature = (key: FeatureKey) => features[key] !== false;
  const currentBusiness = businesses.find((b) => b.id === currentBusinessId) ?? null;

  const switchBusiness = useCallback(async (id: string) => {
    await supabase.rpc("set_active_business", { _business_id: id });
    setCurrentBusinessId(id);
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, id);
    await fetchFeatures(id);
  }, []);

  const refreshBusiness = useCallback(async () => {
    if (!user) return;
    await fetchBusinesses(user.id, roles);
  }, [user, roles]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
    setLoyaltyMemberCode(null);
    setBusinesses([]);
    setCurrentBusinessId(null);
    setFeatures(ALL_FEATURES_ON);
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user, session, loading, roles, hasRole, isAdmin, isSuperAdmin,
        isLoyaltyMember, loyaltyMemberCode,
        businesses, currentBusinessId, currentBusiness,
        features, hasFeature, switchBusiness, refreshBusiness, signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
