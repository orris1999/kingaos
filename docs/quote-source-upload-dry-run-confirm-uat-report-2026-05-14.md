# Finance Quote Source Dry-Run Confirm UAT Report

日期：2026-05-14

## 范围

本次 UAT 只验证已完成 dry-run 的财务报价表上传记录，可以在 production 中由 `super_admin` 临时开启 feature flag 后确认进入 staging batch metadata。

本次确认只创建 `QuoteSourceStagingBatch` metadata，不创建 `QuoteSourceStagingRow`，不导入价格，不保存 KJ 行 / OEM 行，不生成报价草稿，不生成正式报价。

## 测试环境

- 环境：production / ECS
- 代码版本：`a2d94a5294cc8b04211c175b379b8a488d53bc09`
- 测试账号角色：`super_admin`
- 临时开启 flag：`KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN_CONFIRM=true`
- 保持关闭：`KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN=false`
- 保持关闭：`KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=false` 或缺失
- 保持关闭：`KINGA_ENABLE_FINANCE_STAGING_CONFIRM=false` 或缺失
- UAT 完成后：`KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN_CONFIRM=false`

## 测试对象

- uploadId：`cmp57f7ix000hkyzii4s55d6n`
- 文件类型：`.xls`
- uploadStatus：`uploaded`
- dryRunStatus：`completed`
- dryRunAdapterId：`condenser-cost-2026`
- dryRunCategory：`冷凝器`

## 前置检查

- `/login` 返回 200。
- `/finance/quote-source-upload` 未登录访问仍跳转 `/login`。
- 目标 upload 存在。
- 目标 upload 尚未确认，`stagingBatchId = null`，`dryRunConfirmedAt = null`。
- UAT 前 `QuoteSourceStagingBatch count = 0`。
- UAT 前 `QuoteSourceStagingRow count = 0`。

## Confirm 结果

- confirm 执行结果：成功
- stagingBatchId：`cmp5fqlze0002kyb2igzs3j77`
- staging batch adapterId：`condenser-cost-2026`
- staging batch category：`冷凝器`
- staging batch status：`dry_run_passed`
- dryRunDecisionStatus：`manual_review_required`
- submittedByRole：`finance`
- consumerDepartment：`export`
- createdByName：`超级管理员`
- QuoteSourceUpload 已写入 `stagingBatchId`。
- QuoteSourceUpload 已写入 `dryRunConfirmedAt`。
- QuoteSourceUpload 已写入 `dryRunConfirmedByUserId`。
- QuoteSourceUpload 已写入 `dryRunConfirmedByName`。

## 页面检查

- 页面展示 dry-run 已确认状态。
- 页面展示 staging batch id、确认人、确认时间。
- UAT 完成并关闭 flag 后，页面重新显示“dry-run 确认暂未开放”。
- 页面未展示具体价格。
- 页面未展示底价 / 毛利。
- 页面未展示 Excel 完整内容。
- 页面未展示 KJ 明细行 / OEM 明细行。
- 页面未展示 FinanceApprovedPrice 或正式报价。

## 数据库验证

- QuoteSourceUpload count：2，confirm 未新增上传记录。
- QuoteSourceStagingBatch count：1，confirm 只创建 1 条 batch metadata。
- QuoteSourceStagingRow count：0，confirm 未创建 staging rows。
- batch `status = dry_run_passed`。
- batch `submittedByRole = finance`。
- batch `consumerDepartment = export`。
- 未保存具体价格。
- 未保存 KJ 行 / OEM 行。
- 未保存完整 Excel 内容。
- 未生成报价草稿。
- 未生成正式报价。

## AuditLog

已写入：

- `quote_source_upload.dry_run_confirm`

AuditLog metadata 包含：

- uploadId
- stagingBatchId
- sourceFileName
- adapterId
- category
- dryRunStatus
- dryRunDecisionStatus
- stagingBatchStatus
- actorUserId
- actorName
- warnings

AuditLog metadata 未包含：

- 具体价格
- 底价
- 毛利
- 完整 Excel 行
- KJ 明细
- OEM 明细
- signed URL
- AccessKey

## 结论

- 未导入报价表价格。
- 未上传新的报价表。
- 未读取新的真实报价表。
- 未创建 `QuoteSourceStagingRow`。
- 未保存具体价格 / KJ 行 / OEM 行。
- 未生成报价草稿。
- 未生成正式报价。
- 未修改客户数据。
- 未运行 migration / seed / bootstrap / backfill / cleanup apply。
- UAT 完成后已关闭 `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN_CONFIRM`。
- 本轮只是 Finance quote source dry-run confirm production UAT 报告，没有新增正式业务能力，所以未更新 changelog。

## 建议

建议进入 Quote Task 009G：在继续保持 feature-gated 的前提下，设计 staging batch 后续的只读查看 / 行级导入前检查边界。不要直接进入价格导入、报价草稿生成或正式报价。
