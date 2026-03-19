import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getResetRedirectUrl = (req: Request) => {
  const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || "";
  return `${origin}/reset-password`;
};

const generateTempPassword = () => crypto.randomUUID() + "Aa1!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader! } },
    });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    const { data: isAdmin } = await callerClient.rpc("is_admin");
    if (!isAdmin) throw new Error("Not authorized");

    const { action, member_id, user_id, email } = await req.json();
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (action === "reset_password") {
      if (!email || !member_id) throw new Error("Email and member_id required");

      let targetUserId = user_id as string | null | undefined;

      if (!targetUserId) {
        const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password: generateTempPassword(),
          email_confirm: true,
        });

        if (createError) throw createError;

        targetUserId = createdUser.user.id;

        const { error: linkError } = await adminClient
          .from("loyalty_members")
          .update({ user_id: targetUserId })
          .eq("id", member_id);

        if (linkError) throw linkError;
      }

      const { error } = await adminClient.auth.resetPasswordForEmail(email, {
        redirectTo: getResetRedirectUrl(req),
      });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, user_id: targetUserId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle_active") {
      if (!member_id || !user_id) throw new Error("member_id and user_id required");

      const { data: member, error: fetchErr } = await adminClient
        .from("loyalty_members")
        .select("is_active")
        .eq("id", member_id)
        .single();
      if (fetchErr) throw fetchErr;

      const newStatus = !member.is_active;

      const { error: updateErr } = await adminClient
        .from("loyalty_members")
        .update({ is_active: newStatus })
        .eq("id", member_id);
      if (updateErr) throw updateErr;

      const { error: authErr } = await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: newStatus ? "none" : "876000h",
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
