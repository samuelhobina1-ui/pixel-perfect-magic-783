import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin-only "Check Gmail now" button.
export const checkGmailNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const { pollMoniepointGmail } = await import("@/lib/gmail-poll.server");
    const r = await pollMoniepointGmail();
    return { checked: r.checked, found: r.found, matched: r.matched };
  });
