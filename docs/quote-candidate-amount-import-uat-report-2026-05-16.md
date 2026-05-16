# Quote Candidate Amount Import Production UAT Report - 2026-05-16

## Scope

- Quote Task: 009R
- Test time: 2026-05-16 CST
- Environment: production ECS
- Test account role: `super_admin`
- Batch ID: `cmp5fqlze0002kyb2igzs3j77`
- Adapter ID: `condenser-cost-2026`
- Category: `冷凝器`

This UAT tested the feature-gated candidate amount import path for one existing condenser `finance_confirmed` staging batch. It did not upload a new quote source file, did not read a new Excel file, did not create a quote draft, and did not generate a formal quote.

## Feature Flag

- Temporarily enabled: `KINGA_ENABLE_FINANCE_QUOTE_CANDIDATE_AMOUNT_IMPORT=true`
- Closed after UAT attempt: yes
- Kept closed / not enabled during the attempt:
  - `KINGA_ENABLE_FINANCE_STAGING_CONFIRM`
  - `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_ROW_IMPORT`
  - `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN`
  - `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN_CONFIRM`
  - `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT`

## Precheck

- `/login` returned 200: yes
- `/finance/quote-source-staging` unauthenticated access was intercepted: yes
- Target batch existed: yes
- Batch status before import: `finance_confirmed`
- Batch adapter/category matched target scope: yes
- Visibility before import:
  - `export_draft_candidate`: `1747`
  - `finance_only`: `47`
- Row status before import:
  - `candidate`: `1747`
  - `needs_manual_review`: `47`
- Existing `QuoteCandidateAmount` rows for the batch before import: `0`
- Associated upload status: `uploaded`
- Associated upload dry-run status: `completed`
- Associated upload storage key: exists

## UAT Result

- Candidate amount import successful: no
- tradeModes requested: `export_usd`, `domestic_cny`
- Failure type: authenticated request did not receive a valid session
- Route response: `401` / `未登录`
- `QuoteCandidateAmount` rows after attempt: `0`
- `quote_candidate_amount.imported` AuditLog rows after attempt: `0`

The import action did not reach candidate amount creation. The production route correctly required authentication before import. No manual database write was performed, and the attempt was stopped after the authentication failure.

## Boundary Verification

Confirmed:

- No candidate amount rows were created.
- No `candidateValue` was returned in an action result or written to this report.
- No concrete amount, bottom price, or gross margin was output.
- No `costPrice`, `quotePrice`, `unitPrice`, or `amount` was saved.
- No `financeApprovedPrice`, `minimumPrice`, or `grossMargin` was saved.
- No `QuoteDraft` or `QuoteDraftLine` was generated.
- No formal quote was generated.
- No customer data was modified.
- No migration, seed, bootstrap, backfill, or cleanup apply command was run.
- `needs_manual_review` rows were not processed.

## AuditLog

`quote_candidate_amount.imported` was not written because the import did not pass the authenticated route boundary and no candidate amount rows were created.

## Recommendation

Do not proceed to Quote Task 009S yet.

Retry candidate amount production import only after confirming an authenticated `super_admin` browser/session path for the existing route. Keep `KINGA_ENABLE_FINANCE_QUOTE_CANDIDATE_AMOUNT_IMPORT` closed until the retry window.
