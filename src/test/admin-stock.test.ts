import { describe, expect, it } from "vitest";
import { parseBulkPins, reviewReasons, stockLevel } from "../lib/admin-stock";

describe("stock thresholds", () => {
  it("warns red below five", () => { expect(stockLevel(2)).toBe("low"); expect(stockLevel(3)).toBe("low"); expect(stockLevel(4)).toBe("low"); expect(stockLevel(5)).not.toBe("low"); });
  it("warns yellow from five through ten", () => { expect(stockLevel(5)).toBe("warning"); expect(stockLevel(10)).toBe("warning"); });
  it("shows green above ten", () => { expect(stockLevel(11)).toBe("healthy"); });
  it("accepts fifty PINs in one paste", () => { expect(parseBulkPins(Array.from({ length: 50 }, (_, i) => `PIN-${i}`).join("\n"))).toHaveLength(50); });
  it("removes duplicate lines within a paste", () => { expect(parseBulkPins("123\n123\n456")).toEqual(["123", "456"]); });
});
it("explains reused transactions, reused receipts and missing alert independently", () => {
  const reasons = reviewReasons({ reject_reason: "Fake receipt", auto_checks: { unique_transaction: false, unique_receipt: false }, verified_txn_id: null });
  expect(reasons).toHaveLength(4);
});