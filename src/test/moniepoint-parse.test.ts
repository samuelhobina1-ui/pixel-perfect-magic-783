import { describe, expect, it } from "vitest";
import { parseMoniepoint } from "@/routes/api/public/jobs/gmail-opay";

describe("parseMoniepoint", () => {
  it("reads ₦ amount with commas", () => {
    expect(parseMoniepoint("Credit Alert You have received ₦5,000.00 from JOHN DOE Account 9045001199")?.amount).toBe(5000);
  });
  it("reads NGN amount", () => {
    expect(parseMoniepoint("Transaction Alert - Credit Amount: NGN 100.00")?.amount).toBe(100);
  });
  it("ignores debit alerts", () => {
    expect(parseMoniepoint("Debit Alert ₦2,000.00")).toBeNull();
  });
});
