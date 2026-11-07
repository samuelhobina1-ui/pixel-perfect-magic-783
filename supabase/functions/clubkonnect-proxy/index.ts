import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    }});
  }
  try {
    const { action, phone, plan_code, amount } = await req.json();
    const USERID = Deno.env.get("CLUBKONNECT_USERID");
    const APIKEY = Deno.env.get("CLUBKONNECT_APIKEY");
    let url = "";
    let body: any = { UserID: USERID, APIKey: APIKEY };
    if (action === "balance") {
      url = "https://www.clubkonnect.com/api/balance/";
    }
    if (action === "buy-data") {
      url = "https://www.clubkonnect.com/api/buy-data/";
      body = { ...body, phone: phone, plan_code: plan_code, amount: amount };
    }
    if (action === "plans") {
      url = "https://www.clubkonnect.com/api/plans/";
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    }});
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
