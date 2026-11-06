import { clubState, parseClubPlans } from './clubkonnect';

type Credentials = { userId: string; apiKey: string };

// Known provider error codes we surface verbatim so admins see the real cause.
const PROVIDER_ERROR = /^(INVALID_|MISSING_|IP_|INSUFFICIENT_)/;

export async function clubRequest(path: string, credentials: Credentials, params: Record<string, string> = {}) {
  const url = new URL(path, 'https://www.nellobytesystems.com');
  url.search = new URLSearchParams({ UserID: credentials.userId, APIKey: credentials.apiKey, ...params }).toString();
  // Do not follow redirects with credentials or print provider URLs (they contain the API key).
  let response: Response;
  try {
    response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(25000) });
  } catch (err) {
    console.error('[clubkonnect] network failure', path, err instanceof Error ? err.message : 'unknown');
    throw new Error('ClubKonnect could not be reached (network error). Do not resubmit deliveries; reconcile first.');
  }
  const text = await response.text();
  // Log status + raw body for debugging; the URL (with API key) is never logged.
  console.log('[clubkonnect]', path, 'HTTP', response.status, 'body:', text.slice(0, 500));
  if (!response.ok) throw new Error(`ClubKonnect HTTP ${response.status} for ${path}`);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('ClubKonnect returned a non-JSON response');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('ClubKonnect returned an invalid response');
  const status = String((data as Record<string, unknown>)['status'] ?? '');
  if (PROVIDER_ERROR.test(status)) throw new Error(`ClubKonnect error: ${status}`);
  return data as Record<string, unknown>;
}

export async function clubPlans(credentials: Credentials) {
  return parseClubPlans(await clubRequest('/APIDatabundlePlansV3.asp', credentials));
}

export function sanitizedClubEvent(data: Record<string, unknown>, event: string) {
  // Allowlisted status values only; never persist arbitrary provider text or echoed credentials.
  return { event, time: new Date().toISOString(), state: clubState(data), code: /^\d{1,6}$/.test(String(data['statuscode'] ?? data['statusCode'] ?? '')) ? String(data['statuscode'] ?? data['statusCode']) : null };
}
