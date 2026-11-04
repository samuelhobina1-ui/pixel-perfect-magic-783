<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Receipt OCR runs only in a lazily loaded browser worker; extracted fields are untrusted claims, because screenshots are not payment proof.
- Payment verification belongs in locked database functions with private Gmail evidence and one-time alert consumption; all automatic delivery paths must use the same comparison rules.
- Historical deliveries keep their original state and are labeled historical rather than claiming newly passed receipt checks.
- Stock and review helpers live in src/lib/admin-stock.ts; admin review uses a separate authenticated database RPC with mandatory reasons and durable history so automatic payment functions stay unchanged.
- Test-order removal is soft deletion with rejected status, and refunds are manual pending work; this preserves payment evidence and prevents implying a bank transfer occurred.
- Admin page metadata shares src/lib/page-head.ts to keep private pages consistently marked noindex with unique titles.
- ClubKonnect uses admin-authenticated server functions with server-only credentials and locked claim/finalization RPCs; submission is once-only, unknown results require status reconciliation, and automatic dispatch stays disabled until receipt safeguards are complete.
