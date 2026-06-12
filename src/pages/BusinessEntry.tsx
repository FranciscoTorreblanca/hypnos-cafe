import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export const PENDING_SLUG_KEY = "hypnos.pendingBusinessSlug";

const BusinessEntry = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading, businesses, isSuperAdmin, switchBusiness } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!slug || loading) return;

    if (!user) {
      sessionStorage.setItem(PENDING_SLUG_KEY, slug);
      navigate("/auth", { replace: true });
      return;
    }

    (async () => {
      const { data: biz } = await supabase
        .from("businesses")
        .select("id, slug")
        .eq("slug", slug)
        .maybeSingle();

      if (!biz) {
        toast({ title: "Business not found", variant: "destructive" });
        navigate("/dashboard", { replace: true });
        return;
      }

      const isMember = isSuperAdmin || businesses.some((b) => b.id === biz.id);
      if (!isMember) {
        toast({ title: "No access to this business", variant: "destructive" });
        navigate("/dashboard", { replace: true });
        return;
      }

      await switchBusiness(biz.id);
      sessionStorage.removeItem(PENDING_SLUG_KEY);
      navigate("/dashboard", { replace: true });
    })();
  }, [slug, user, loading, businesses, isSuperAdmin, switchBusiness, navigate, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
};

export default BusinessEntry;
