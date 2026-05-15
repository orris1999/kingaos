# Quote Source Row Import Production UAT Report - 2026-05-15

## Scope

Quote Task 009J tested the feature-gated Finance quote source row import path for one existing condenser staging batch.

This UAT did not upload a new quote source file, did not execute dry-run, did not execute dry-run confirm, and did not manually write database records.

## Test Context

- Environment: production ECS
- Test account role: super_admin
- Batch ID: `cmp5fqlze0002kyb2igzs3j77`
- Adapter ID: `condenser-cost-2026`
- Category: `冷凝器`
- Batch status before import: `dry_run_passed`
- Dry-run decision before import: `manual_review_required`
- Row count before import: `0`
- Associated upload status: `uploaded`
- Associated upload dry-run status: `completed`
- Associated upload storage key: exists

## Feature Flag

- `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_ROW_IMPORT` was temporarily set to `true`.
- `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN` remained not enabled.
- `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN_CONFIRM` remained not enabled.
- `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT` remained missing / not enabled.
- `KINGA_ENABLE_FINANCE_STAGING_CONFIRM` remained missing / not enabled.

The row import flag was closed after the UAT attempt.

## UAT Result

Import result: failed.

The super_admin login succeeded and the authenticated row import route was reached, but the action returned:

```text
quote source staging repository writes are disabled in production
```

This indicates the existing local/test-only repository write guard is still active for the row import path. The failure happened before any row creation.

## Database Verification

After the failed import attempt:

- `QuoteSourceStagingRow` count for the batch remained `0`.
- `quote_source_staging.rows_imported` AuditLog count for the batch remained `0`.
- No sample rows existed for the batch.
- No `export_draft_candidate` visibility was created.

## Boundary Verification

Confirmed:

- No specific price was saved.
- No `costPrice`, `quotePrice`, `unitPrice`, or `amount` was saved.
- No `financeApprovedPrice`, `minimumPrice`, or `grossMargin` was saved.
- No full Excel row content was saved.
- No quote draft was generated.
- No formal quote was generated.
- No staging row was created.
- No customer data was modified.
- No migration, seed, bootstrap, backfill, or cleanup apply command was run.

## AuditLog

`quote_source_staging.rows_imported` was not written because the import did not pass the production write guard and no rows were created.

## Recommendation

Do not proceed to Quote Task 009K yet.

Before retrying production row import UAT, add a narrowly scoped production-enabled path for this feature flag, while preserving:

- super_admin-only permission.
- one-batch duplicate prevention.
- condenser-only first version boundary.
- no concrete price persistence.
- no `export_draft_candidate` promotion.
- no quote draft or formal quote generation.
