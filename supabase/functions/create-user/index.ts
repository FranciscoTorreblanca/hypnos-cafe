import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { email, full_name, role, business_id } = await req.json();
    if (!email || !full_name || !role) throw new Error("Missing fields");

    // Resolve target business: super admins can target any, regular admins use their own
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    let targetBusinessId: string | null = business_id ?? null;
    if (!targetBusinessId) {
      const { data: myBiz } = await adminClient
        .from("business_members").select("business_id, is_default")
        .eq("user_id", caller.id).order("is_default", { ascending: false }).limit(1).maybeSingle();
      targetBusinessId = myBiz?.business_id ?? null;
    }
    if (!targetBusinessId) throw new Error("No business context available");

    // Check if user already exists
    let userId: string | null = null;
    let isNewUser = false;
    const { data: existingProfile } = await adminClient
      .from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();

    if (existingProfile) {
      userId = existingProfile.id;
      // Already a member of this business?
      const { data: existingMember } = await adminClient
        .from("business_members")
        .select("id, role")
        .eq("user_id", userId)
        .eq("business_id", targetBusinessId)
        .eq("role", role)
        .maybeSingle();
      if (existingMember) {
        throw new Error("This user is already a member of this business with that role");
      }
    } else {
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createError) throw createError;
      userId = newUser.user.id;
      isNewUser = true;
    }

    // Assign legacy global role (kept for back-compat) - ignore duplicates
    await adminClient
      .from("user_roles")
      .insert({ user_id: userId, role })
      .then((r) => r); // ignore unique violation

    // Link user to business with scoped role
    await adminClient
      .from("business_members")
      .insert({ user_id: userId, business_id: targetBusinessId, role, is_default: isNewUser });

    // Send password reset email so the new user can set their password
    if (isNewUser) {
      const { error: resetError } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email,
      });
      if (resetError) throw resetError;
    }

    return new Response(JSON.stringify({ id: userId, existing: !isNewUser }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
