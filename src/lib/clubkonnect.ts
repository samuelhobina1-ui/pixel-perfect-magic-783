export const CLUB_NETWORKS = { '01': 'MTN', '02': 'GLO', '03': '9MOBILE', '04': 'AIRTEL' } as const;
export type ClubPlan = { network: string; code: string; name: string; amount: number };
export function parseClubPlans(input: unknown): ClubPlan[] {
  if (!input || typeof input !== 'object') return [];
  const networks = (input as Record<string, unknown>)['MOBILE_NETWORK'];
  if (!networks || typeof networks !== 'object') return [];
  const result: ClubPlan[] = [];
  for (const entries of Object.values(networks)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const network = String(entry.ID ?? '').padStart(2, '0');
      if (!(network in CLUB_NETWORKS) || !Array.isArray(entry.PRODUCT)) continue;
      for (const p of entry.PRODUCT) {
        const amount = Number(p.PRODUCT_AMOUNT);
        if (p.PRODUCT_CODE != null && p.PRODUCT_NAME && Number.isFinite(amount)) result.push({ network, code: String(p.PRODUCT_CODE), name: String(p.PRODUCT_NAME), amount });
      }
    }
  }
  return result;
}
export function clubState(input: Record<string, unknown>): 'pending' | 'completed' | 'failed' | 'unknown' {
  const code = String(input['statuscode'] ?? input['statusCode'] ?? '');
  const status = String(input['orderstatus'] ?? input['orderStatus'] ?? input['status'] ?? '').toUpperCase();
  // Receipt of a request is NOT confirmation of delivery.
  if (code === '200' && status === 'ORDER_COMPLETED') return 'completed';
  if (status === 'ORDER_RECEIVED' || status === 'ORDER_PROCESSING') return 'pending';
  if (/^(INVALID_|MISSING_)/.test(status) || status === 'ORDER_CANCELLED' || status === 'INSUFFICIENT_BALANCE') return 'failed';
  return 'unknown';
}
export function nigeriaMobile(input: string) { return /^0[789]\d{9}$/.test(input); }