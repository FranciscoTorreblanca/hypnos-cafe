import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/fetchAllPages";

function generateMemberCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// --- Members ---
export function useLoyaltyMembers() {
  return useQuery({
    queryKey: ["loyalty-members"],
    queryFn: async () => {
      const data = await fetchAllPages((from, to) => supabase
        .from("loyalty_members")
        .select("*")
        .order("created_at", { ascending: false }).order("id").range(from, to));
      return data;
    },
  });
}

export function useLoyaltyMemberByCode(code: string | undefined) {
  return useQuery({
    queryKey: ["loyalty-member", code],
    enabled: !!code,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_members")
        .select("*")
        .eq("member_code", code!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// Registration is now handled by the loyalty-signup edge function
// This mutation is kept for admin use only
export function useRegisterLoyaltyMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; email: string; phone: string }) => {
      const member_code = generateMemberCode();
      const { data, error } = await supabase
        .from("loyalty_members")
        .insert({ ...input, member_code })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loyalty-members"] }),
  });
}

// --- Visits ---
export function useLoyaltyVisits(memberId: string | undefined) {
  return useQuery({
    queryKey: ["loyalty-visits", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      if (!memberId) return [];
      const data = await fetchAllPages((from, to) => supabase
        .from("loyalty_visits")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false }).order("id").range(from, to));
      return data;
    },
  });
}

export function useRegisterVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, registeredBy }: { memberId: string; registeredBy: string }) => {
      // Insert visit
      const { error: visitErr } = await supabase
        .from("loyalty_visits")
        .insert({ member_id: memberId, registered_by: registeredBy });
      if (visitErr) throw visitErr;

      // Increment total_visits
      const { data: member, error: fetchErr } = await supabase
        .from("loyalty_members")
        .select("total_visits")
        .eq("id", memberId)
        .single();
      if (fetchErr) throw fetchErr;

      const newCount = (member.total_visits ?? 0) + 1;
      const { error: updateErr } = await supabase
        .from("loyalty_members")
        .update({ total_visits: newCount })
        .eq("id", memberId);
      if (updateErr) throw updateErr;

      // Auto-grant coupons based on min_visits
      const { data: coupons } = await supabase
        .from("loyalty_coupons")
        .select("id, min_visits")
        .eq("is_active", true)
        .gt("min_visits", 0)
        .lte("min_visits", newCount);

      if (coupons && coupons.length > 0) {
        const { data: existing } = await supabase
          .from("loyalty_member_coupons")
          .select("coupon_id")
          .eq("member_id", memberId);
        const existingIds = new Set((existing ?? []).map((e) => e.coupon_id));
        const toGrant = coupons.filter((c) => !existingIds.has(c.id));
        if (toGrant.length > 0) {
          await supabase
            .from("loyalty_member_coupons")
            .insert(toGrant.map((c) => ({ member_id: memberId, coupon_id: c.id })));
        }
      }

      return newCount;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty-members"] });
      qc.invalidateQueries({ queryKey: ["loyalty-member"] });
      qc.invalidateQueries({ queryKey: ["loyalty-visits"] });
      qc.invalidateQueries({ queryKey: ["loyalty-member-coupons"] });
    },
  });
}

// --- Coupons ---
export function useLoyaltyCoupons() {
  return useQuery({
    queryKey: ["loyalty-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string; title_en: string; description: string; description_en: string;
      discount_type: string; discount_value: number; min_visits: number;
    }) => {
      const { data, error } = await supabase.from("loyalty_coupons").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loyalty-coupons"] }),
  });
}

export function useUpdateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; is_active?: boolean; title?: string; title_en?: string; description?: string; description_en?: string; discount_type?: string; discount_value?: number; min_visits?: number }) => {
      const { error } = await supabase.from("loyalty_coupons").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loyalty-coupons"] }),
  });
}

// --- Member Coupons ---
export function useMemberCoupons(memberId: string | undefined) {
  return useQuery({
    queryKey: ["loyalty-member-coupons", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_member_coupons")
        .select("*, loyalty_coupons(*)")
        .eq("member_id", memberId!)
        .order("granted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useRedeemCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, redeemedBy }: { id: string; redeemedBy: string }) => {
      const { error } = await supabase
        .from("loyalty_member_coupons")
        .update({ is_redeemed: true, redeemed_at: new Date().toISOString(), redeemed_by: redeemedBy })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loyalty-member-coupons"] }),
  });
}

// --- Coupon Items (free items linked to a coupon) ---
export function useCouponItems(couponId: string | undefined) {
  return useQuery({
    queryKey: ["loyalty-coupon-items", couponId],
    enabled: !!couponId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_coupon_items")
        .select("*, menu_items(id, name, name_en)")
        .eq("coupon_id", couponId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useCouponItemsByCoupons(couponIds: string[]) {
  return useQuery({
    queryKey: ["loyalty-coupon-items-batch", couponIds],
    enabled: couponIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_coupon_items")
        .select("*, menu_items(id, name, name_en)")
        .in("coupon_id", couponIds);
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveCouponItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ couponId, menuItemIds }: { couponId: string; menuItemIds: string[] }) => {
      // Delete existing
      const { error: delErr } = await supabase
        .from("loyalty_coupon_items")
        .delete()
        .eq("coupon_id", couponId);
      if (delErr) throw delErr;
      // Insert new
      if (menuItemIds.length > 0) {
        const { error: insErr } = await supabase
          .from("loyalty_coupon_items")
          .insert(menuItemIds.map((mid) => ({ coupon_id: couponId, menu_item_id: mid })));
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loyalty-coupon-items"] }),
  });
}
