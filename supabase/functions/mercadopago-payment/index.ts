import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read access token from restaurant_settings
    const { data: tokenSetting } = await supabase
      .from("restaurant_settings")
      .select("value")
      .eq("key", "mp_access_token_encrypted")
      .maybeSingle();

    const accessToken = tokenSetting?.value;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Mercado Pago access token not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { device_id, amount, description, external_reference } = await req.json();

    if (!device_id || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing device_id or amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = {
      amount: Math.round(amount * 100) / 100,
      description: description || "Pago Hypnos Cafe",
      external_reference: external_reference || "",
      print_on_terminal: true,
    };

    const response = await fetch(
      `https://api.mercadopago.com/point/integration-api/devices/${device_id}/payment-intents`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Mercado Pago error:", data);
      return new Response(
        JSON.stringify({ error: data.message || "Mercado Pago API error", details: data }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
