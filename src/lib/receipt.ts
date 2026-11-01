import { ACCOUNT } from "@/lib/moniepoint";

export type ReceiptClaims = { amountKobo: number | null; senderName: string | null; account: string | null; date: string | null; rawText: string };

export function amountToKobo(value: string): number | null {
  const clean = value.replace(/[,\s₦]/g, "").replace(/^(NGN|N)/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole = "0", fraction = ""] = clean.split(".");
  const result = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return Number.isSafeInteger(result) && result > 0 && result <= 2147483647 ? result : null;
}

export function parseReceiptText(rawText: string): ReceiptClaims {
  const text = rawText.slice(0, 12000);
  const amount = text.match(/(?:amount(?:\s+paid)?|credit\s+amount)\s*[:\-]?\s*(?:₦|NGN|N)?\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1]
    ?? text.match(/(?:₦|NGN)\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1]
    ?? text.match(/\b([\d,]+\.\d{2})\b/)?.[1];
  const sender = text.match(/(?:sender(?:'s)?(?:\s+name)?|from)\s*[:\-]?\s*([^\n\r]+?)(?=\s+(?:date|time|account|recipient|narration)\b|\n|\r|$)/i)?.[1]?.trim() ?? null;
  // Do not invent a date when the screenshot has none.
  const dateText = text.match(/\b\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?/)?.[0];
  const date = dateText && Number.isFinite(Date.parse(dateText)) ? new Date(dateText).toISOString() : null;
  return { amountKobo: amount ? amountToKobo(amount) : null, senderName: sender?.slice(0, 120) ?? null, account: text.includes(ACCOUNT) ? ACCOUNT : text.match(/\b\d{10}\b/)?.[0] ?? null, date, rawText: text };
}

export const lowPinStock = (stock: number) => stock < 5;
export const lydToKobo = (lyd: number) => lyd * 18000;

export async function readReceipt(file: File): Promise<ReceiptClaims> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(file);
    return parseReceiptText(data.text);
  } finally { await worker.terminate(); }
}