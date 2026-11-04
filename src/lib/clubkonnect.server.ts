import { clubState, parseClubPlans } from './clubkonnect';

type Credentials = { userId: string; apiKey: string };
export async function clubRequest(path: string, credentials: Credentials, params: Record<string, string> = {}) {
  const url = new URL(path, 'https://www.nellobytesystems.com');
  url.search = new URLSearchParams({ UserID: credentials.userId, APIKey: credentials.apiKey, ...params }).toString();
  // Do not follow redirects with credentials or print provider URLs/bodies.
  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error('Provider unavailable');
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid response');
    return data as Record<string, unknown>;
  } catch { throw new Error('ClubKonnect could not be reached. Check connection or reconcile an existing delivery; do not submit it again.'); }
}
export async function clubPlans(credentials: Credentials) {
  return parseClubPlans(await clubRequest('/APIDatabundlePlansV3.asp', credentials));
}
export function sanitizedClubEvent(data: Record<string, unknown>, event: string) {
  // Allowlisted status values only; never persist arbitrary provider text or echoed credentials.
  return { event, time: new Date().toISOString(), state: clubState(data), code: /^\d{1,6}$/.test(String(data['statuscode'] ?? data['statusCode'] ?? '')) ? String(data['statuscode'] ?? data['statusCode']) : null };
}