# ClubKonnect data delivery
- [ ] Secure credentials, balance test and plan mapping in admin.
- [ ] Add verified-payment-only data dispatch, durable order logging and duplicate protection.
- [ ] Verify integration; live purchase waits for credentials, confirmed plans and payment safeguards.

# Stock and manual review
- [x] Merge duplicate products, preserving order links and all PINs.
- [x] Add dashboard restock warning and tap-to-send WhatsApp reminder.
- [ ] Send WhatsApp message directly — blocked: user declined WhatsApp Business connection; use dashboard reminder instead.
- [x] Add manual-review reasons, evidence and audited actions.
- [x] Improve stock table and bulk PIN entry; verify counts and flows with isolated test records.

# Receipt checks (previous unfinished request; not part of this change)
- [ ] Add receipt OCR with editable amount and sender fallback.
- [ ] Store receipt claims and unique Gmail alerts; enforce amount, sender, account and two-hour checks.
- [x] Add manual-review comparison, approval reason and rejection.
- [ ] WhatsApp bans — deferred from earlier unfinished request, not requested in this change.
- [x] Correct Libyana pricing and add low-stock warnings.
- [ ] Verify real order/alert state, test the complete flow and publish.

Do not publish incomplete verification safeguards. Gmail polling and automatic matching must remain unchanged in the stock/manual-review update.