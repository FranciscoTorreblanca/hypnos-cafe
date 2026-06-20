import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getRedirectUrl = (req: Request, path = "/reset-password") => {
  const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || "";
  return `${origin}${path}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader! } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    const { data: isAdmin } = await callerClient.rpc("is_admin");
    const { data: isSuper } = await callerClient.rpc("is_super_admin");
    if (!isAdmin && !isSuper) throw new Error("Not authorized");

    const body = await req.json();
    const action: string = body.action || "invite";
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // --- Send password reset email to an existing user ---
    if (action === "reset_password") {
      const { email } = body;
      if (!email) throw new Error("Email is required");
      const { error } = await adminClient.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectUrl(req),
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Invite / add user to business (supports multi-role) ---
    const { email, full_name, role, business_id } = body;
    const rawRoles: string[] = Array.isArray(body.roles) && body.roles.length > 0
      ? body.roles
      : (role ? [role] : []);
    const roles = Array.from(new Set(rawRoles.filter(Boolean)));
    const ENUM_ROLES = new Set(["admin", "waiter", "billing", "kitchen"]);
    if (!email || !full_name || roles.length === 0) throw new Error("Missing fields");

    // Resolve target business
    let targetBusinessId: string | null = business_id ?? null;
    if (!targetBusinessId) {
      const { data: myBiz } = await adminClient
        .from("business_members").select("business_id, is_default")
        .eq("user_id", caller.id).order("is_default", { ascending: false }).limit(1).maybeSingle();
      targetBusinessId = myBiz?.business_id ?? null;
    }
    if (!targetBusinessId) throw new Error("No business context available");

    const { data: biz } = await adminClient
      .from("businesses").select("name").eq("id", targetBusinessId).maybeSingle();
    const businessName = biz?.name || "your business";

    // Check if user already exists
    let userId: string | null = null;
    let isNewUser = false;
    const { data: existingProfile } = await adminClient
      .from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();

    if (existingProfile) {
      userId = existingProfile.id;
    } else {
      const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        { data: { full_name }, redirectTo: getRedirectUrl(req) },
      );
      if (inviteError) throw inviteError;
      userId = invited.user.id;
      isNewUser = true;
    }

    // Existing business memberships (skip duplicates)
    const { data: existingMembers } = await adminClient
      .from("business_members")
      .select("role")
      .eq("user_id", userId)
      .eq("business_id", targetBusinessId);
    const existingRoles = new Set((existingMembers ?? []).map((m: any) => m.role));

    // Legacy enum roles (only insert ones the user_roles enum accepts)
    for (const r of roles) {
      if (!ENUM_ROLES.has(r)) continue;
      await adminClient.from("user_roles").insert({ user_id: userId, role: r }).then((x) => x);
    }

    // Per-business memberships (one row per role)
    const toInsert = roles
      .filter((r) => !existingRoles.has(r))
      .map((r, idx) => ({
        user_id: userId!,
        business_id: targetBusinessId!,
        role: r,
        is_default: isNewUser && idx === 0,
      }));
    if (toInsert.length > 0) {
      const { error: memErr } = await adminClient.from("business_members").insert(toInsert);
      if (memErr) throw memErr;
    } else if (!isNewUser) {
      throw new Error("This user already has all selected roles in this business");
    }

    return new Response(
      JSON.stringify({
        id: userId,
        existing: !isNewUser,
        invited: isNewUser,
        business_name: businessName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
