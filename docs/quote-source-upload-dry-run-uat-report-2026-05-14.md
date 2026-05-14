# Finance Quote Source Upload Dry-Run UAT Report

日期：2026-05-14

## 范围

本次 UAT 只验证已上传财务报价表文件的 production dry-run 结构识别能力。dry-run 不导入价格，不生成 staging rows，不生成报价草稿，不生成正式报价。

## 测试环境

- 环境：production / ECS
- 代码版本：`55ee8c548932dc3ceeb599136e1ac488c18673ca`
- 测试账号角色：`super_admin`
- 临时开启 flag：`KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN=true`
- 保持关闭：`KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=false` 或缺失
- 保持关闭：`KINGA_ENABLE_FINANCE_STAGING_CONFIRM=false` 或缺失
- UAT 完成后：`KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN=false`

## 测试对象

- uploadId：`cmp57f7ix000hkyzii4s55d6n`
- 文件类型：`.xls`
- 文件类别：冷凝器
- 上传状态：`uploaded`

## 页面检查

- `/login` 返回 200。
- `/finance/quote-source-upload` 可由 `super_admin` 打开。
- 页面保留上传边界提示：
  - 本页面只上传财务报价表文件。
  - 当前不导入价格，不生成报价草稿，不生成正式报价。
  - 上传文件不是财务批准价格。
  - 出口部不能上传或维护报价表。
- flag 开启后，目标上传记录可点击“执行结构识别 dry-run”。
- flag 关闭后，dry-run 按钮重新显示为 disabled 的“dry-run 暂未开放”。

## Dry-Run 结果

- dry-run 执行结果：成功
- dryRunStatus：`completed`
- dryRunAdapterId：`condenser-cost-2026`
- dryRunCategory：`冷凝器`
- sheet 数量：3
- 检测到 KJ 列：是
- 检测到 OEM / OE 列：否
- 检测到产品名称列：是
- 检测到成本候选列：是
- 检测到报价候选列：否
- 检测到包装列：是
- mappedColumns：`model`、`notes`、`kjCode`、`erpCode`、`costPrice`、`packaging`、`productName`、`specification`

## Warnings

- 成本价不是财务批准价格，只能作为 priceCandidate，不能直接生成正式报价。
- 报价表 / 成本表 / 价格候选数据必须由财务提交和维护，出口部不能上传或维护报价表。
- Export 只能消费 dry-run / staging 结果生成报价草稿，不能维护价格表。
- dry-run 不导入生产数据库，不自动批准价格，不生成正式报价。
- Excel 嵌入图片不是稳定主图来源，后续需要 KJ 主图库。
- OEM / OE 可能一对多，本阶段不做自动匹配。
- KJ 可能存在标准编码 / 旧编码 / ERP 编码 / 孚盟编码并存，需要规范化和冲突检查。
- 不同品类表结构不一致，需要按 adapter 配置解析。
- 不能生产明细只作为风险参考，不进入可报价主数据。

## 数据库验证

- QuoteSourceUpload count：2，dry-run 未新增上传记录。
- QuoteSourceStagingBatch count：0，dry-run 未创建 staging batch。
- QuoteSourceStagingRow count：0，dry-run 未创建 staging rows。
- dry-run metadata 已写入目标 QuoteSourceUpload。
- dryRunSummary 只保存结构摘要 keys、sheet 数量、mappedColumns、fieldDetection 和 warnings。
- 未保存具体价格。
- 未保存 KJ 行 / OEM 行。
- 未保存完整 Excel 内容。

## AuditLog

已写入：

- `quote_source_upload.dry_run`

AuditLog metadata 包含：

- uploadId
- sourceFileName
- adapterId
- category
- dryRunStatus
- sheetCount
- mappedColumnKeys
- warnings
- actorUserId
- actorName

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
- 未创建 staging batch / rows。
- 未生成报价草稿。
- 未生成正式报价。
- 未修改客户数据。
- 未运行 migration / seed / bootstrap / backfill / cleanup apply。
- UAT 通过。

## 建议

建议进入 Quote Task 009E：设计从 dry-run metadata 到 staging import 的下一步，但必须继续保持 feature-gated、metadata-only 优先，并在进入任何行级 staging 前明确不保存具体价格 / KJ 行 / OEM 行的边界。
