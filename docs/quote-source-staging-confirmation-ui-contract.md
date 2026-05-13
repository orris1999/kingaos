# Quote Task 006G｜Finance staging confirmation UI / action contract

日期：2026-05-13

本文件只设计 Finance staging confirmation 的未来页面和 action contract。不实现 UI 页面、不实现 API route、不实现 server action、不写数据库、不读取 Excel、不导入报价表。

## 业务边界

1. 报价表 / 成本表 / 价格候选数据由财务提交和维护。
2. 出口部不能上传报价表，不能维护价格表，不能设置底价或毛利。
3. 出口部只能消费财务提交并经过确认流程的数据生成报价草稿。
4. staging 不是正式价格表。
5. `finance_confirmed` 不等于 FinanceApprovedPrice。
6. `export_draft_candidate` 仍然不是正式报价，不能直接发客户。
7. 正式报价必须后续接 FinancePricing。

## 未来页面位置

未来页面归属 Finance：

- `/finance/quote-source-staging`
- `/finance/quote-source-staging/[batchId]`

不要放在：

- `/admin`
- `/export`

原因：

1. 报价表由财务提交和维护。
2. 出口部只能消费财务确认后的 staging 候选数据。
3. 当前 confirmation 是财务侧数据源确认，不是销售侧报价动作。

## 页面信息结构

### Batch 基本信息

展示：

- 文件名
- adapterId
- 品类
- dry-run decision
- 当前 status
- `submittedByRole = finance`
- `consumerDepartment = export`

### Row 统计

展示：

- 总行数
- candidate 行
- needs_manual_review 行
- addon_only 行
- blocked 行
- ignored 行

### 出口部可消费预览

展示：

- 将会变成 `export_draft_candidate` 的行数
- 仍保持 `finance_only` 的行数
- `internal_risk_only` 的行数

预览必须明确：这些只是报价草稿候选，不是正式报价，不包含财务批准价格。

### 风险提示

必须展示：

- 成本价不是财务批准价格。
- `finance_confirmed` 不等于 FinanceApprovedPrice。
- `export_draft_candidate` 不是正式报价。
- `needs_manual_review` 默认不会给出口部消费。
- `addon_only` / `blocked` / `ignored` 不会给出口部消费。
- 正式报价必须后续接 FinancePricing。

### 财务确认区域

包含：

- `confirmationNote`
- 确认按钮
- 取消按钮
- 退回 adapter 修正按钮
- 退回财务表修正按钮

本轮不实现这些按钮。

## 未来权限设计

未来权限 key 草案：

- `finance.quote_source_staging.view`
- `finance.quote_source_staging.confirm`
- `finance.quote_source_staging.cancel`
- `finance.quote_source_staging.request_fix`

本轮不新增 permission key，不更新 seed，不运行 `db:seed`。

权限边界：

1. `super_admin` 可以访问。
2. 财务经理 / 授权财务人员未来可以访问。
3. 出口部不能确认 staging。
4. 出口部不能上传报价表。
5. 出口部不能维护价格表。

## Future server action contract

本轮只定义类型，不实现 server action。

```ts
type ConfirmQuoteSourceStagingBatchActionInput = {
  batchId: string;
  confirmationNote?: string;
  rowVisibilityPolicy?: "strict_candidate_only";
};

type ConfirmQuoteSourceStagingBatchActionResult = {
  ok: boolean;
  batchId: string;
  previousStatus: string;
  nextStatus: "finance_confirmed";
  exportDraftCandidateRows: number;
  financeOnlyRows: number;
  internalRiskOnlyRows: number;
  warnings: string[];
  errors?: string[];
};
```

规则：

1. `rowVisibilityPolicy` 本轮 contract 只允许 `strict_candidate_only`。
2. 不允许 `include_manual_review` 进入未来页面确认 contract。
3. action result 不返回具体价格。
4. action result 不返回底价 / 毛利。
5. action result 不返回财务批准价格。
6. action result 不生成正式报价状态。

## 确认弹窗文案

标题：

```text
确认将该批报价表 staging 标记为“财务已确认可作为报价草稿候选数据源”？
```

正文：

```text
请注意：
1. 这不是正式报价。
2. 这不是财务批准价格。
3. 这不会生成可发客户的报价单。
4. 只有符合条件的 candidate 行会成为出口部报价草稿候选。
5. needs_manual_review / addon_only / blocked / ignored 行不会自动给出口部使用。
```

按钮：

- 取消
- 确认进入草稿候选

## 取消 / 退回修正 action contract

```ts
type RequestQuoteSourceStagingFixActionInput = {
  batchId: string;
  reason: string;
  fixType: "adapter_fix_required" | "finance_table_fix_required";
};

type CancelQuoteSourceStagingBatchActionInput = {
  batchId: string;
  reason: string;
};
```

规则：

1. `reason` 必填。
2. `adapter_fix_required` 表示需要技术补 adapter。
3. `finance_table_fix_required` 表示需要财务修报价表结构或字段。
4. `cancelled` 不删除 batch / rows，只改变状态并保留审计线索。
5. 本轮不实现 server action。

## AuditLog metadata 设计

未来 AuditLog metadata：

```ts
type QuoteSourceStagingConfirmationActionAuditMetadata = {
  batchId: string;
  sourceFileName?: string;
  adapterId?: string;
  category?: string;
  previousStatus: string;
  nextStatus: string;
  actorUserId: string;
  actorName?: string;
  confirmationNote?: string;
  rowVisibilityPolicy: "strict_candidate_only";
  exportDraftCandidateRows: number;
  financeOnlyRows: number;
  internalRiskOnlyRows: number;
  addonOnlyRows: number;
  blockedRows: number;
  ignoredRows: number;
};
```

未来 action：

- `quote_source_staging.confirm`
- `quote_source_staging.request_adapter_fix`
- `quote_source_staging.request_finance_table_fix`
- `quote_source_staging.cancel`

本轮不接真实 AuditLog。

## 错误状态

未来页面应展示清晰错误：

1. batch 不存在。
2. 当前 status 不是 `dry_run_passed`。
3. staging 已取消。
4. staging 已确认，不允许重复确认。
5. 没有确认权限。
6. 缺少确认说明或退回原因。
7. 系统检测到禁止字段或正式价格字段。

错误处理原则：

- 不静默忽略。
- 不自动重试写入。
- 不删除 batch / rows。
- 不把失败结果给出口部消费。

## 回滚 / 取消边界

已 `finance_confirmed` 的 batch 可以进入 `cancelled`，但不能回到 `draft` 或 `dry_run_passed`。

取消只表示：

- 这份 staging 候选不再给出口部消费。
- 数据仍保留，供审计和排查。

取消不表示：

- 删除报价表数据。
- 删除 rows。
- 撤回正式报价。

原因：当前 staging 还不是正式报价，不能混入正式报价撤回语义。

## 明确不做

本轮不做：

- UI 页面。
- API route。
- server action。
- Prisma schema / migration。
- 报价表上传。
- Excel 导入。
- 真实价格保存。
- 价格审批。
- 正式报价。
- AuditLog 写入。
