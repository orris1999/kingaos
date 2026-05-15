# Quote Draft Real Staging UAT Report - 2026-05-15

## Scope

- Quote task: 009L
- Test time: 2026-05-15 14:59 CST
- Test account role: `super_admin`
- Batch ID: `cmp5fqlze0002kyb2igzs3j77`
- Adapter ID: `condenser-cost-2026`
- Category: `冷凝器`

## Feature Flags

- Temporarily enabled: `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=true`
- Kept enabled: `KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL=true`
- Closed after UAT: `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=false`
- Kept closed or not true:
  - `KINGA_ENABLE_FINANCE_STAGING_CONFIRM`
  - `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_ROW_IMPORT`
  - `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN`
  - `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN_CONFIRM`
- `.env` backup created: `.env.backup-20260515144809-before-export-staging-workbench-uat`

## Precheck

- `/login` returned 200: yes
- `/export/quote-draft-workbench` unauthenticated access redirected to login: yes
- Batch status before UAT: `finance_confirmed`
- Visibility before UAT:
  - `export_draft_candidate: 1747`
  - `finance_only: 47`
- Row status before UAT:
  - `candidate: 1747`
  - `needs_manual_review: 47`

## Workbench UAT

- Data source selected: `财务确认 staging 候选`
- Real KJ sample count: 10
- Successful matches: 10
- Not found count: 2
  - One `needs_manual_review` KJ remained unavailable to Export consumption.
  - One intentionally missing KJ returned not found.
- OEM unsupported check: passed; OEM input remained unsupported.
- Draft preview generated: yes
- Preview source: `finance_confirmed staging`
- Preview displayed KJ / product name / category: yes
- Preview displayed concrete price: no
- Preview displayed bottom price or gross margin: no
- Preview row displayed `FinanceApprovedPrice` field or value: no
- Page retained the boundary warning that `finance_confirmed` is not `FinanceApprovedPrice`.

## Excel Draft Export

- Draft Excel exported: yes
- File name contained `草稿`: yes
- Excel contained non-formal quote warning: yes
- Excel contained "price candidate is not finance-approved and cannot be sent directly to customer" warning: yes
- Excel contained current preview rows: yes
- Excel contained concrete price / bottom price / gross margin: no
- Excel contained `FinanceApprovedPrice` / `officialQuote` / `sentToCustomer`: no

## Data Boundary

- Saved `QuoteDraft` / `QuoteDraftLine`: no; these models are not present.
- Modified staging row visibility: no.
- Saved concrete amount: no.
- Saved `costPrice` / `quotePrice` / `unitPrice` / `amount`: no.
- Saved `financeApprovedPrice` / `minimumPrice` / `grossMargin`: no.
- Generated official quote: no.
- Modified customer data: no.
- Ran migration / seed / bootstrap / backfill: no.

## Post-UAT Readonly Verification

- Batch status remained: `finance_confirmed`
- Visibility remained:
  - `export_draft_candidate: 1747`
  - `finance_only: 47`
- Row status remained:
  - `candidate: 1747`
  - `needs_manual_review: 47`
- After closing the feature flag, the staging data source was disabled again on the Workbench page.

## Recommendation

- Recommend continuing to the next stage.
- Next stage should keep treating `export_draft_candidate` as draft candidate data only.
- Amount candidate design should stay separated from formal quote generation and continue through FinancePricing / finance approval boundaries.
