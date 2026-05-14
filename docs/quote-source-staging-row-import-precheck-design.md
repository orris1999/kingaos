# Quote Source Staging Row Import Precheck Design

日期：2026-05-14

## 为什么需要 precheck

`QuoteSourceStagingBatch` 只表示财务已把 dry-run 结构识别结果确认到 staging metadata。它不是行级候选数据，也不是价格导入结果。

行级导入前需要先检查：

1. batch status 是否允许继续设计。
2. adapterId 是否明确。
3. category 是否明确。
4. dry-run decision 是否允许进入下一步。
5. 是否已经存在 staging rows，避免重复导入。
6. warnings 是否需要财务 / 技术 / 产品资料人员人工确认。

本轮 precheck 只回答“是否可以进入行级导入设计”，不执行导入动作。

## batch metadata 与 rows 的区别

`QuoteSourceStagingBatch` 保存：

- 来源文件名。
- adapterId。
- category。
- dryRunDecisionStatus。
- batch status。
- 提交角色和消费部门。
- warnings / notes。

`QuoteSourceStagingRow` 未来才会保存行级候选 metadata，例如 KJ 候选、产品名候选、风险状态、visibility 和价格候选状态。

当前 009G 不创建 `QuoteSourceStagingRow`，不保存价格，不保存 KJ 行 / OEM 行，不生成报价草稿或正式报价。

## manual_review_required 的含义

`manual_review_required` 不代表失败。

它表示 dry-run 结构识别已完成，但进入行级导入前需要人工确认：

1. 当前 adapter 是否正确。
2. 当前 category 是否正确。
3. dry-run warnings 是否可接受。
4. 是否允许后续解析行级 KJ / 产品候选。
5. 是否允许后续进入候选金额设计。

对于当前已确认 batch：

- adapterId：`condenser-cost-2026`
- category：`冷凝器`
- status：`dry_run_passed`
- dryRunDecisionStatus：`manual_review_required`

结论是：可以进入行级导入前检查，但还不能直接导入 rows。

## 可以进入 row import design 的情况

可以进入设计，不代表可以现在导入。

允许进入 row import design 的最低条件：

1. `status = dry_run_passed`。
2. adapterId 存在。
3. category 存在。
4. `dryRunDecisionStatus = ready_for_staging_design` 或 `manual_review_required`。
5. 当前 rowCount = 0，避免重复处理已有 rows。

precheck 输出：

- `canDesignRowImport = true`
- `canImportRowsNow = false`

## 必须 blocked 的情况

以下情况必须 blocked：

1. adapterId 缺失。
2. category 缺失。
3. batch status 不是 `dry_run_passed`。
4. batch 已 `cancelled`。
5. dry-run decision 是 `blocked`。
6. dry-run decision 是 `addon_only`，不适合作为产品 KJ 行导入。
7. 已经存在 rows，需先核对现有 rows，避免重复导入。

需要 adapter review 的情况：

- dry-run decision 是 `needs_adapter_fix`。

需要 finance review 的情况：

- dry-run decision 是 `needs_finance_table_fix`。
- dry-run decision 是 `manual_review_required`，但仍可继续设计行级导入规则。

## 为什么本轮不创建 rows

本轮只补 staging batch 后续查看和 row import precheck 设计。

不创建 rows 的原因：

1. 行级 Excel 解析还没有单独验收。
2. KJ / OEM / 产品候选字段仍需要分品类规则。
3. 价格候选字段涉及财务风险，不能在 precheck 中落库。
4. 水箱 / 中冷器 / 包装类会引入多编码、多规格、多包装风险，需要单独设计。
5. 正式报价必须后续接 FinancePricing，不能从 staging 直接生成。

## 为什么本轮不保存价格

precheck 不保存：

- 具体价格。
- 成本价。
- 报价价。
- 底价。
- 毛利。
- 财务批准价格。

原因：

1. staging batch / precheck 不是 FinanceApprovedPrice。
2. 销售侧不能把成本候选当正式报价或财务批准价格。
3. 价格字段的保存、脱敏、可见性和审批必须单独设计。

## 后续分阶段建议

后续 row import 应拆成独立阶段：

1. 只读设计：基于 batch / dry-run summary 生成 row import plan，不写库。
2. 本地 / test row parser：使用 mock 或 test fixture 验证行级映射，不碰 production。
3. production feature flag：默认关闭，人工开启。
4. 单文件 row import UAT：只创建 staging rows metadata，不保存具体价格。
5. 财务确认 staging rows：确认哪些 rows 可作为出口草稿候选。
6. Export 消费：只消费 `finance_confirmed + export_draft_candidate`，仍然生成草稿，不生成正式报价。

任何阶段都不能绕过 FinancePricing / 财务审批 / 价格快照。
