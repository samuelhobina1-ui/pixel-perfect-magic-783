import { describe, expect, it } from "vitest";
import { amountToKobo, parseReceiptText, lowPinStock, lydToKobo } from "@/lib/receipt";

describe("receipt claims", () => {
  it("reads 900 naira as 90000 kobo", () => expect(amountToKobo("₦900.00")).toBe(90000));
  it("reads NGN amounts", () => expect(amountToKobo("NGN 1,800.00")).toBe(180000));
  it("does not round invalid fractional kobo", () => expect(amountToKobo("900.001")).toBeNull());
  it("extracts sender and account from receipt evidence", () => {
    const r = parseReceiptText("Amount Paid: ₦900.00\nSender: SAMUEL HOBINA\nAccount: 5339964934");
    expect(r.senderName).toBe("SAMUEL HOBINA"); expect(r.account).toBe("5339964934");
  });
  it("does not invent missing receipt data", () => {
    const r = parseReceiptText("random image"); expect(r.amountKobo).toBeNull(); expect(r.senderName).toBeNull(); expect(r.date).toBeNull(); expect(r.account).toBeNull();
  });
  it("maps 5 LYD to 90000 kobo, not 900000", () => expect(lydToKobo(5)).toBe(90000));
  it("warns below five PINs", () => { expect(lowPinStock(4)).toBe(true); expect(lowPinStock(5)).toBe(false); });
});