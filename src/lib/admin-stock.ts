export function stockLevel(left: number): "low" | "warning" | "healthy" {
  return left < 5 ? "low" : left <= 10 ? "warning" : "healthy";
}

export function parseBulkPins(text: string): string[] {
  return [...new Set(text.split(/[\r\n,;]+/).map((pin) => pin.trim()).filter(Boolean))];
}

export function reviewReasons(order: { reject_reason: string | null; auto_checks: unknown; verified_txn_id: string | null }): string[] {
  const reasons: string[] = [];
  if (order.reject_reason?.trim()) reasons.push(order.reject_reason.trim());
  const checks = order.auto_checks && typeof order.auto_checks === "object" ? order.auto_checks as Record<string, unknown> : {};
  if (checks.unique_transaction === false) reasons.push("Transaction ID appears on another order.");
  if (checks.unique_receipt === false) reasons.push("Receipt was reused on another order.");
  if (!order.verified_txn_id) reasons.push("No bank alert has been linked to this order.");
  return reasons.length ? reasons : ["Payment needs an admin decision."];
}