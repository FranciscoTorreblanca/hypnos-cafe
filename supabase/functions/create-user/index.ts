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

    // Create user with service role
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createError) throw createError;

    // Assign legacy global role (kept for back-compat)
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: newUser.user.id, role });
    if (roleError) throw roleError;

    // Link user to business with scoped role
    await adminClient
      .from("business_members")
      .insert({ user_id: newUser.user.id, business_id: targetBusinessId, role, is_default: true });

    // Send password reset email so the new user can set their password
    const { error: resetError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (resetError) throw resetError;

    return new Response(JSON.stringify({ id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
