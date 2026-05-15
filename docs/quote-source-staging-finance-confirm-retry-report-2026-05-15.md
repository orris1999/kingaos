# Quote Source Staging Finance Confirm Retry UAT Report - 2026-05-15

## Scope

- Quote task: 009K-Retry
- Test time: 2026-05-15 14:29 CST
- Test account role: `super_admin`
- Batch ID: `cmp5fqlze0002kyb2igzs3j77`
- Adapter ID: `condenser-cost-2026`
- Category: `冷凝器`

## Feature Flag

- Temporarily enabled: `KINGA_ENABLE_FINANCE_STAGING_CONFIRM=true`
- Closed after UAT: yes
- Kept closed or not true after UAT:
  - `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_ROW_IMPORT`
  - `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN`
  - `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN_CONFIRM`
  - `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT`
- `.env` backup created: `.env.backup-20260515142442-before-finance-staging-confirm-retry`

## Precheck

- `/login` returned 200: yes
- `/finance/quote-source-staging` unauthenticated access redirected to login: yes
- Batch existed: yes
- Batch status before confirm: `dry_run_passed`
- Dry-run decision status: `manual_review_required`
- Row count before confirm: `1794`
- Visibility before confirm: `finance_only: 1794`
- Row status before confirm: `candidate: 1747`, `needs_manual_review: 47`
- `confirmedAt` before confirm: empty

## Result

- Confirm successful: yes
- Batch status after confirm: `finance_confirmed`
- Row count after confirm: `1794`
- Visibility after confirm:
  - `export_draft_candidate: 1747`
  - `finance_only: 47`
- Row status after confirm:
  - `candidate: 1747`
  - `needs_manual_review: 47`
- `needs_manual_review` rows promoted: no
- AuditLog `quote_source_staging.finance_confirmed` written: yes
- AuditLog metadata contained sensitive price fields: no

## Data Boundary

- Saved concrete prices: no
- Saved `costPrice` / `quotePrice` / `unitPrice` / `amount`: no
- Saved `financeApprovedPrice` / `minimumPrice` / `grossMargin`: no
- Generated quote draft: no
- Generated official quote: no
- Modified customer data: no
- Ran migration / seed / bootstrap / backfill: no

## Recommendation

- Recommend continuing to Quote Task 009L.
- 009L should continue treating `export_draft_candidate` as quote draft candidates only, not as formal prices, formal quotes, or `FinanceApprovedPrice`.
