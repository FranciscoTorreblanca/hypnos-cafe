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

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader! } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    const { data: isAdmin } = await callerClient.rpc("is_admin");
    if (!isAdmin) throw new Error("Not authorized");

    const { action, member_id, user_id, email } = await req.json();
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (action === "reset_password") {
      if (!email) throw new Error("Email required");
      const { error } = await adminClient.auth.admin.generateLink({ type: "recovery", email });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle_active") {
      if (!member_id || !user_id) throw new Error("member_id and user_id required");
      
      // Get current status
      const { data: member, error: fetchErr } = await adminClient
        .from("loyalty_members")
        .select("is_active")
        .eq("id", member_id)
        .single();
      if (fetchErr) throw fetchErr;

      const newStatus = !member.is_active;

      // Update loyalty_members
      const { error: updateErr } = await adminClient
        .from("loyalty_members")
        .update({ is_active: newStatus })
        .eq("id", member_id);
      if (updateErr) throw updateErr;

      // Ban/unban the auth user
      const { error: authErr } = await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: newStatus ? "none" : "876000h", // ~100 years
      });
      if (authErr) throw authErr;

      return new Response(JSON.stringify({ success: true, is_active: newStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
