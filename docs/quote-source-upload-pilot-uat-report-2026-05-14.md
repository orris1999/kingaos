# Finance quote source upload pilot UAT report - 2026-05-14

## Scope

Quote Task 009B tested the Finance quote source upload pilot in production with one real finance quote source file. The test only verified file upload to private OSS, metadata persistence, and AuditLog entries.

This UAT did not parse Excel content, import prices, create staging batches or rows, generate quote drafts, or generate formal quotes.

## Environment

- Date: 2026-05-14
- Environment: production ECS
- Code version: `4dfe9278a7ca8f522543cb6fcd5a21c1a94c28a2`
- Test account role: `super_admin`
- File type: `.xls`
- Source category used for UAT: 冷凝器

## Result

- `/login` returned 200.
- `super_admin` login succeeded.
- `/finance/quote-source-upload` opened successfully.
- The page displayed the required upload boundary warnings:
  - This page only uploads Finance quote source files.
  - It does not import prices.
  - It does not generate quote drafts.
  - It does not generate formal quotes.
  - Uploaded files are not FinanceApprovedPrice.
  - Export department cannot upload or maintain quote source files.
- The page allowed selecting a `.xls` file.
- The file was uploaded to private OSS.
- The latest uploaded object was verified by OSS head metadata.
- The latest `QuoteSourceUpload` metadata row was written.
- `uploadStatus` is `uploaded`.
- `submittedByRole` is `finance`.
- `consumerDepartment` is `export`.
- `storageProvider` is `aliyun_oss`.
- `storageKey` exists, but no signed URL is recorded in this report.
- AuditLog contains both:
  - `quote_source_upload.upload_url.generate`
  - `quote_source_upload.create`

## Data boundary verification

- No Excel content was parsed.
- No price fields were saved.
- No KJ row details were saved.
- No OEM row details were saved.
- `QuoteSourceStagingBatch` count remained `0`.
- `QuoteSourceStagingRow` count remained `0`.
- No quote draft was generated.
- No formal quote was generated.
- No customer data was modified.
- No test customer or test quote was created.

## Finding

Production `QuoteSourceUpload` count is `2`, while the original 009B target expected one upload record from a clean post-009A count of `0`.

The latest two upload records are both `.xls` 冷凝器 metadata-only uploads with `uploadStatus = uploaded`, matching file size, private OSS storage keys, and no staging side effects. The extra record was confirmed by the user as a manual website upload during the UAT window. No records were deleted or modified during UAT.

Severity: informational. The upload capability works, and the observed count of `2` is explained by one manual user upload plus this UAT upload.

## Recommendation

009C can proceed with dry-run/staging planning while preserving the boundary that uploaded files are not prices, not FinanceApprovedPrice, not quote drafts, and not formal quotes.
