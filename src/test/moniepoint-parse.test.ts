import { describe, expect, it } from "vitest";
import { parseMoniepoint } from "@/lib/moniepoint";

// Layout copied from the real Moniepoint "Credit alert!" email (no ₦ sign before the amount).
const real = "Credit alert! Hi HOBINA, We wish to inform you that a credit transaction occurred on your account with us. Credit Amount 900.00 Transaction Details Account Balance: N 939.25 Account Number: 5339964934 Sender's Name: from HOBINA KINGSLEY SAMUEL Date & Time: 16 Oct, 2026 | 01:49:44 AM";

describe("parseMoniepoint", () => {
  it("reads ₦900.00 from the real alert as 90000 kobo, not the balance", () => {
    const p = parseMoniepoint(real);
    expect(p?.kobo).toBe(90000);
    expect(p?.account).toBe("5339964934");
    expect(p?.sender).toBe("HOBINA KINGSLEY SAMUEL");
  });
  it("reads the ₦-prefixed form", () => {
    expect(parseMoniepoint("Credit Amount: ₦900.00 Account Number: 5339964934")?.kobo).toBe(90000);
  });
  it("rejects a different account number", () => {
    expect(parseMoniepoint(real.replace("5339964934", "9045001199"))).toBeNull();
  });
  it("keeps kobo so ₦890 is not ₦900", () => {
    expect(parseMoniepoint(real.replace("900.00", "890.00"))?.kobo).toBe(89000);
  });
  it("ignores debit alerts", () => {
    expect(parseMoniepoint("Debit alert! a debit transaction occurred. Debit Amount 850.00 Account Number: 5339964934")).toBeNull();
  });
});
