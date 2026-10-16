import { describe, expect, it } from "vitest";
import { parseMoniepoint } from "@/routes/api/public/jobs/gmail-opay";

const real = "Credit Alert Credit Amount: ₦900.00 Account Number: 5339964934 Sender’s Name: from HOBINA KINGSLEY SAMUEL Date & Time: 15 Oct, 2026 | 02:43:30 PM";

describe("parseMoniepoint", () => {
  it("reads the example alert exactly", () => {
    const p = parseMoniepoint(real);
    expect(p?.amount).toBe(900);
    expect(p?.account).toBe("5339964934");
  });
  it("rejects a different account number", () => {
    expect(parseMoniepoint(real.replace("5339964934", "9045001199"))).toBeNull();
  });
  it("keeps kobo so ₦890 is not ₦900", () => {
    expect(parseMoniepoint(real.replace("900.00", "890.00"))?.amount).toBe(890);
  });
  it("reads NGN amount", () => {
    expect(parseMoniepoint("Transaction Alert - Credit Amount: NGN 100.00")?.amount).toBe(100);
  });
  it("ignores debit alerts", () => {
    expect(parseMoniepoint("Debit Alert ₦2,000.00")).toBeNull();
  });
});
