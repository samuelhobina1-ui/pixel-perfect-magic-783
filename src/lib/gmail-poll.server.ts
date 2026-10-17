import { ACCOUNT, parseMoniepoint } from "@/lib/moniepoint";

const GW = "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me";
// INBOX only, read or unread, recent Moniepoint alerts for our account.
const Q = `in:inbox newer_than:3d from:(alerts@moniepoint.com OR no-reply@moniepoint.com OR noreply@moniepoint.com) ${ACCOUNT}`;

function decode(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
}
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[]; headers?: { name: string; value: string }[] };
function bodyText(p: Part): string {
  if (p.mimeType === "text/plain" && p.body?.data) return decode(p.body.data);
  for (const c of p.parts ?? []) { const t = bodyText(c); if (t) return t; }
  if (p.body?.data) return decode(p.body.data).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#8358;/g, "₦");
  return "";
}

export async function pollMoniepointGmail() {
  const lk = process.env["LOVABLE_API_KEY"], gk = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lk || !gk) throw new Error("Gmail not connected");
  const h = { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": gk };
  const list = await fetch(`${GW}/messages?maxResults=10&q=${encodeURIComponent(Q)}`, { headers: h });
  if (!list.ok) { const t = await list.text(); throw new Error(`Gmail list [${list.status}]: ${t}`); }
  const ids = ((await list.json()) as { messages?: { id: string }[] }).messages ?? [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results: { id: string; subject: string; parsed: ReturnType<typeof parseMoniepoint>; result: unknown }[] = [];
  for (const { id } of ids) {
    const r = await fetch(`${GW}/messages/${id}?format=full`, { headers: h });
    if (!r.ok) { console.error(`Gmail get [${r.status}]: ${await r.text()}`); continue; }
    const m = (await r.json()) as { payload: Part; snippet?: string };
    const from = m.payload.headers?.find((x) => x.name.toLowerCase() === "from")?.value ?? "";
    const subject = m.payload.headers?.find((x) => x.name.toLowerCase() === "subject")?.value ?? "";
    const text = `${subject} ${bodyText(m.payload) || m.snippet || ""}`.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").slice(0, 2000);
    const p = /@moniepoint\.com>?\s*$/i.test(from) ? parseMoniepoint(text) : null;
    let result: unknown = "skipped: not a credit alert for " + ACCOUNT;
    if (p) {
      const { data, error } = await supabaseAdmin.rpc("ingest_bank_alert", { _ref: `MP-${id}`, _amount: p.kobo / 100, _sender: p.sender ?? "", _message: text });
      result = error ? error.message : data;
    }
    console.log("[gmail-moniepoint]", id, subject, JSON.stringify(p), JSON.stringify(result));
    results.push({ id, subject, parsed: p, result });
  }
  const found = results.filter((r) => r.parsed).length;
  const matched = results.filter((r) => (r.result as { matched?: boolean })?.matched).map((r) => (r.result as { order?: string }).order);
  await supabaseAdmin.from("settings").update({ last_gmail_poll_at: new Date().toISOString(), last_gmail_found: found, last_gmail_note: matched.length ? `Matched ${matched.join(", ")}` : null }).eq("id", 1);
  return { checked: ids.length, found, matched, results };
}
