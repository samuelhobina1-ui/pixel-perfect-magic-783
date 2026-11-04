import { describe, it, expect } from 'vitest';
import { CLUB_NETWORKS, clubState, nigeriaMobile, parseClubPlans } from '../lib/clubkonnect';
describe('ClubKonnect safety', () => {
  it('uses exact provider network codes', () => { expect(CLUB_NETWORKS).toEqual({ '01': 'MTN', '02': 'GLO', '03': '9MOBILE', '04': 'AIRTEL' }); });
  it('does not mark accepted requests completed', () => { expect(clubState({ statuscode: '100', status: 'ORDER_RECEIVED' })).toBe('pending'); });
  it('requires final completion status and code together', () => { expect(clubState({ statuscode: '200', orderstatus: 'ORDER_COMPLETED' })).toBe('completed'); expect(clubState({ statuscode: '201', orderstatus: 'ORDER_COMPLETED' })).toBe('unknown'); expect(clubState({ statuscode: '200', status: 'ORDER_RECEIVED' })).toBe('pending'); });
  it('keeps unknown results out of failed/refund states', () => { expect(clubState({})).toBe('unknown'); expect(clubState({ status: 'INVALID_RECIPIENT' })).toBe('failed'); });
  it('only permits Nigerian delivery numbers', () => { expect(nigeriaMobile('08012345678')).toBe(true); expect(nigeriaMobile('0912345678')).toBe(false); });
  it('reads provider plan codes rather than inventing them', () => { expect(parseClubPlans({ MOBILE_NETWORK: { MTN: [{ ID: '01', PRODUCT: [{ PRODUCT_CODE: '4', PRODUCT_NAME: '1GB Weekly', PRODUCT_AMOUNT: '410.00' }] }] } })).toEqual([{ network: '01', code: '4', name: '1GB Weekly', amount: 410 }]); });
});