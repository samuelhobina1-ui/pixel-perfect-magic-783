import { createFileRoute } from "@tanstack/react-router";

// Receives forwarded OPay SMS from the shop owner's phone. Caller is verified by the secret token
// stored in settings (checked inside the ingest_opay_sms database function).
export const Route = createFileRoute("/api/public/opay-sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? request.headers.get("x-token") ?? "";
        if (!/^[a-f0-9]{48}$/.test(token)) return new Response("Unauthorized", { status: 401 });
        const raw = await request.text();
        if (raw.length > 5000) return new Response("Too large", { status: 413 });
        let message = raw;
        try {
          const j = JSON.parse(raw) as Record<string, unknown>;
          message = String(j.message ?? j.msg ?? j.text ?? j.body ?? j.content ?? raw);
        } catch { /* plain text body */ }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("ingest_opay_sms", { _token: token, _message: message });
        if (error) {
          const unauth = error.message.includes("unauthorized");
          return Response.json({ success: false, error: unauth ? "Unauthorized" : "Failed" }, { status: unauth ? 401 : 500 });
        }
        return Response.json(data);
      },
    },
  },
});
