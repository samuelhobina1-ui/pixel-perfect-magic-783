import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export { ACCOUNT, parseMoniepoint } from "@/lib/moniepoint";

// Polls the owner's Gmail every minute for Moniepoint credit alerts and auto-confirms the matching pending order.
export const Route = createFileRoute("/api/public/jobs/gmail-opay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const fail = await authenticateCronRequest(request);
        if (fail) return fail;
        try {
          const { pollMoniepointGmail } = await import("@/lib/gmail-poll.server");
          return Response.json(await pollMoniepointGmail());
        } catch (e) {
          console.error(e);
          return new Response(String(e), { status: 502 });
        }
      },
    },
  },
});
