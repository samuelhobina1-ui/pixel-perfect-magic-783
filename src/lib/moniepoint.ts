export const ACCOUNT = "5339964934";

// Parses a Moniepoint credit alert. Returns amount in kobo (integer) to avoid float errors.
// Rejects debit alerts and alerts naming a different account.
export function parseMoniepoint(text: string, account = ACCOUNT) {
  const t = text.replace(/\s+/g, " ");
  if (/debit (alert|amount|transaction)/i.test(t) && !/credit (alert|amount|transaction)/i.test(t)) return null;
  if (!/credit/i.test(t)) return null;
  const acct = t.match(/Account\s*(?:Number|No\.?)\s*[:\-]?\s*(\d{10})/i)?.[1];
  if (acct && acct !== account) return null;
  const m =
    t.match(/Credit\s*Amount\s*[:\-]?\s*(?:₦|NGN|N)?\s?([0-9][0-9,]*(?:\.\d{1,2})?)/i) ??
    t.match(/(?:₦|NGN)\s?([0-9][0-9,]*(?:\.\d{1,2})?)/i);
  if (!m) return null;
  const [whole, frac = ""] = m[1].replace(/,/g, "").split(".");
  const kobo = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!kobo) return null;
  const sender = t.match(/Sender(?:'|’)?s?\s*Name\s*[:\-]?\s*(?:from\s+)?([A-Za-z.' ]{2,60}?)(?=\s+(?:Date|Narration|Account|$))/i)?.[1]?.trim() ?? null;
  return { kobo, amount: kobo / 100, sender, account: acct ?? null };
}
