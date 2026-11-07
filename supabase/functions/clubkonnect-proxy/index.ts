import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: cred } = await supabase
      .from("clubkonnect_credentials")
      .select("user_id, api_key")
      .eq("id", 1)
      .single();

    if (!cred) throw new Error("No credentials in clubkonnect_credentials table");

    const USERID = cred.user_id;
    const APIKEY = cred.api_key;

    const { action, ...rest } = await req.json();

    let url = "";
    let body: any = { UserID: USERID, APIKey: APIKEY };

    if (action === "buy-airtime") {
      url = "https://www.clubkonnect.com/api/airtime/";
      body = { ...body, MobileNetwork: rest.network, MobileNumber: rest.phone, Amount: rest.amount };
    } else if (action === "buy-data") {
      url = "https://www.clubkonnect.com/api/data/";
      body = { ...body, MobileNetwork: rest.network, DataPlan: rest.planId, MobileNumber: rest.phone };
    } else if (action === "get-plans") {
      url = "https://www.clubkonnect.com/api/get-data-plans/";
      body = { ...body, MobileNetwork: rest.network };
    } else if (action === "check-balance") {
      url = "https://www.clubkonnect.com/api/balance/";
    } else {
      throw new Error("Unknown action: " + action);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
