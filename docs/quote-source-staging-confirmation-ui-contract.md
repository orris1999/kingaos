# Quote Task 006G｜Finance staging confirmation UI / action contract

日期：2026-05-13

本文件设计 Finance staging confirmation 的页面和 action contract。Quote Task 006G 只设计 contract；Quote Task 007A 已实现只读页面，但仍不实现 API route、不实现 server action、不写数据库、不读取 Excel、不导入报价表。

## 业务边界

1. 报价表 / 成本表 / 价格候选数据由财务提交和维护。
2. 出口部不能上传报价表，不能维护价格表，不能设置底价或毛利。
3. 出口部只能消费财务提交并经过确认流程的数据生成报价草稿。
4. staging 不是正式价格表。
5. `finance_confirmed` 不等于 FinanceApprovedPrice。
6. `export_draft_candidate` 仍然不是正式报价，不能直接发客户。
7. 正式报价必须后续接 FinancePricing。

## 页面位置

Quote Task 007A 已实现只读页面，归属 Finance：

- `/finance/quote-source-staging`
- `/finance/quote-source-staging/[batchId]`

不要放在：

- `/admin`
- `/export`

原因：

1. 报价表由财务提交和维护。
2. 出口部只能消费财务确认后的 staging 候选数据。
3. 当前 confirmation 是财务侧数据源确认，不是销售侧报价动作。

## 007A 只读页面边界

007A 只读页面规则：

1. 仅 `super_admin` 可访问。
2. 不新增 permission key，不更新 seed，不运行 `db:seed`。
3. 只读取 `QuoteSourceStagingBatch` / `QuoteSourceStagingRow` metadata。
4. 不执行确认动作。
5. 不执行退回修正动作。
6. 不执行取消动作。
7. 不新增 server action / API route / POST action。
8. 不修改 batch status。
9. 不修改 row visibility。
10. 不展示具体金额、底价、毛利或财务批准价格字段。

确认、退回修正和取消按钮在 007A 页面中必须 disabled，并显示“下一阶段开放”。

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

007A 页面只展示 disabled 按钮：

- 确认进入草稿候选（下一阶段开放）
- 退回修正（下一阶段开放）
- 取消批次（下一阶段开放）

本轮不实现真实操作。未来 007B 才能实现 server action，并且必须接服务端权限校验和 AuditLog。

## 未来权限设计

未来权限 key 草案：

- `finance.quote_source_staging.view`
- `finance.quote_source_staging.confirm`
- `finance.quote_source_staging.cancel`
- `finance.quote_source_staging.request_fix`

007A 不新增 permission key，不更新 seed，不运行 `db:seed`。后续开放给财务角色时，必须单独新增 permission key、seed 和生产权限部署计划。

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

- `quote_source_staging.finance_confirmed`（007B server action 实际写入）
- `quote_source_staging.confirm`
- `quote_source_staging.request_adapter_fix`
- `quote_source_staging.request_finance_table_fix`
- `quote_source_staging.cancel`

006G 只设计 metadata，不接真实 AuditLog。007B 新增的确认 server action 必须写入 `quote_source_staging.finance_confirmed` AuditLog，metadata 不包含具体价格、底价、毛利、`financeApprovedPrice`、`officialQuote` 或 `sentToCustomer`。

## 007B super_admin-only confirmation action

Quote Task 007B 已实现 server action contract 的确认动作，但页面按钮仍保持 disabled，不接 UI。

已实现：

- `confirmQuoteSourceStagingBatchAction(input)`
- 仅 `super_admin` 可调用。
- `rowVisibilityPolicy` 只允许 `strict_candidate_only`。
- 拒绝 `include_manual_review`。
- 调用 `confirmQuoteSourceStagingBatchForDraftCandidates`。
- 成功后写入 `AuditLog.action = quote_source_staging.finance_confirmed`。

仍未实现：

- UI 按钮 wiring。
- `request_adapter_fix` server action。
- `request_finance_table_fix` server action。
- `cancel` server action。
- 新增权限 key / seed。

007B 的生产边界：

1. `finance_confirmed` 仍不等于 `FinanceApprovedPrice`。
2. `export_draft_candidate` 仍不是正式报价。
3. `not_finance_approved` 可以作为报价草稿候选，但不能作为正式报价。
4. action result 不返回具体价格、底价、毛利或正式报价字段。
5. `/finance/quote-source-staging/[batchId]` 的确认 / 退回 / 取消按钮仍显示“下一阶段开放”。

## 007C feature-gated UI wiring

Quote Task 007C 已将 `/finance/quote-source-staging/[batchId]` 的确认区域接入 007B server action，但必须通过服务端 feature flag 控制。

Feature flag：

- 名称：`KINGA_ENABLE_FINANCE_STAGING_CONFIRM`
- 默认：关闭。
- 缺失：按关闭处理。
- `false`：关闭。
- `true`：开启。
- 不使用 `NEXT_PUBLIC_` 前缀。
- 只由 server component 读取，不暴露给浏览器运行时。
- ECS 部署默认不修改 `.env`，不自动启用。

关闭时页面行为：

1. 显示“确认进入草稿候选（暂未开放）”。
2. 按钮 disabled。
3. 显示“当前确认功能未启用。本页仅展示 staging 批次，不执行写入。”
4. 不渲染可提交 form。
5. 不调用 `confirmQuoteSourceStagingBatchAction`。

开启时页面行为：

1. 仅 `super_admin` 可访问该详情页和触发 action。
2. 表单显示确认说明 `confirmationNote`，该字段可选。
3. `rowVisibilityPolicy` 固定为 `strict_candidate_only`。
4. 页面不提供 `include_manual_review` 选项。
5. 提交前必须勾选“我已确认以上风险，确认进入草稿候选”。
6. 确认后由 action 写入 AuditLog，并刷新当前 batch 详情页。

仍未开放：

- 退回修正。
- 取消批次。
- 新增权限 key / seed。
- 正式报价。
- FinancePricing。
- 报价表导入。

007C 后仍然必须明确：

1. `finance_confirmed` 不等于 `FinanceApprovedPrice`。
2. `export_draft_candidate` 仍不是正式报价。
3. 只有符合条件的 candidate 行会成为出口部报价草稿候选。
4. `needs_manual_review` / `addon_only` / `blocked` / `ignored` 行不会自动给出口部使用。

## 007D feature flag verification and rollout runbook

Quote Task 007D 已补充 feature flag 验证和 production rollout runbook。007D 不启用 production flag，不修改 ECS `.env`，不读取真实 Excel，不导入报价表，不写 production 数据。

验证结论：

1. `KINGA_ENABLE_FINANCE_STAGING_CONFIRM` 缺失时默认关闭。
2. `KINGA_ENABLE_FINANCE_STAGING_CONFIRM=false` 时关闭。
3. `KINGA_ENABLE_FINANCE_STAGING_CONFIRM=true` 时，本地 / test 环境可以进入确认表单分支。
4. 不使用 `NEXT_PUBLIC_`，flag 不暴露给前端运行时。
5. feature flag 关闭时不渲染可提交 form，不调用 `confirmQuoteSourceStagingBatchAction`。
6. feature flag 开启时仍固定 `rowVisibilityPolicy = strict_candidate_only`，不提供 `include_manual_review`。
7. `super_admin` 可以确认，普通 admin、普通财务、出口部用户和未登录用户不能确认。
8. 确认后只有符合条件的 `candidate + finance_only` 行可以变成 `export_draft_candidate`。
9. `needs_manual_review` / `addon_only` / `blocked` / `ignored` / `missing` / `requires_finance_review` 不会自动给出口部消费。
10. AuditLog action = `quote_source_staging.finance_confirmed`，metadata 不含敏感价格字段。

Production rollout runbook：

- `docs/quote-source-staging-confirmation-rollout-runbook.md`

production 仍默认关闭。未来如需开启，必须由人工修改 ECS `.env`：

```bash
KINGA_ENABLE_FINANCE_STAGING_CONFIRM=true
pm2 restart kingaos --update-env
```

Codex 不应自动修改 ECS `.env`，也不应自动启用该 flag。

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

006G 不做：

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

007B 只实现 super_admin-only confirmation server action 和 AuditLog 写入，仍不做 UI wiring、API route、Prisma schema / migration、Excel 导入、真实价格保存、价格审批或正式报价。
