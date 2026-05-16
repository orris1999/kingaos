# Quote Task 006A｜Finance 报价表 staging 导入模型设计

日期：2026-05-13

本文件设计 Finance 报价表 staging 导入模型。Quote Task 006A 先固化纯 domain 类型；Quote Task 006B 开始落地 metadata-only Prisma schema，只新增 staging batch / row 元数据表，不导入报价表、不保存具体金额、不生成报价草稿、不生成正式报价。

## 为什么需要 staging

Finance dry-run 只能证明文件结构是否可识别，不能直接让出口部使用。staging 的作用是把财务确认过的结构化候选数据放入一个中间层，供后续 V1 KJ 报价草稿生成器消费。

staging 解决的问题：

1. 把财务提交的报价表结构化为可检查的 batch 和 row。
2. 保留来源文件、adapter、dry-run 决策和风险提示。
3. 区分候选行、需要人工确认行、附加项行和阻断行。
4. 控制哪些行未来可作为出口部报价草稿候选。
5. 避免 dry-run 结果未经确认就直接给出口部消费。

staging 仍然不解决：

1. 不做正式报价。
2. 不做价格审批。
3. 不保存或展示底价 / 毛利。
4. 不绕过 FinancePricing。

## dry-run 与 staging 的区别

| 阶段 | 作用 | 是否写库 | 是否可给出口部消费 | 是否是正式价格 |
|---|---|---:|---:|---:|
| dry-run | 浏览器本地或 CLI 结构识别，输出 adapter 匹配、字段映射和风险提示。 | 否 | 否 | 否 |
| staging | 财务确认后进入中间候选层，保留结构化 batch / row 和 visibility。 | 006B 仅新增 metadata 表 | 仅特定 visibility 后可作为草稿候选 | 否 |
| FinancePricing | 财务核价 / 批准价格事实。 | 未来单独设计 | 可被正式报价引用 | 是 |

dry-run 进入 staging 的前置条件：

1. `dryRunDecisionStatus = ready_for_staging_design`。
2. `canProceedToStagingDesign = true`。
3. 财务已确认这份表可以进入 staging 设计。
4. 财务确认价格字段含义，但这些字段仍只是候选，不是财务批准价格。

即使进入 staging，也不能自动变成出口部可用数据源。还需要：

1. batch 状态达到 `finance_confirmed`。
2. row visibility 被明确设置为 `export_draft_candidate`。
3. 行级风险和 warning 已保留。
4. 仍然只作为报价草稿数据源候选。

## staging 与正式 FinancePricing 的区别

staging batch 的 `finance_confirmed` 只表示：

- 财务确认这份表可以作为草稿数据源候选进入后续 staging。
- 财务确认结构和字段可以继续设计。

它不表示：

- 价格已被财务批准。
- 可以直接生成正式报价。
- 可以发客户。
- 可以作为订单或合同价格。

正式价格必须后续接 FinancePricing，并在正式报价链路中保存财务批准后的价格快照。

## Quote Task 006B metadata-only Prisma schema

006B 新增两个 Prisma model：

1. `QuoteSourceStagingBatch`：保存来源文件名、adapter、品类、dry-run 决策状态、batch 状态、财务确认人、warnings 和 notes。
2. `QuoteSourceStagingRow`：保存行级编码候选、产品候选信息、tradeMode、priceCandidateStatus、结构布尔值、visibility、rowStatus 和 warnings。

006B 仍然不保存：

- 具体金额。
- 底价。
- 毛利。
- 财务批准价格。
- 可发客户的正式报价状态。

这两个表只是 staging metadata，不是正式价格表，也不是 FinanceApprovedPrice。它们为后续 Finance 报价表 staging 导入留结构位置，但不提供导入动作、上传后台、API route 或 server action。

## Quote Task 006C repository 边界

006C 新增 repository 层，只服务于 staging metadata。它不新增 UI、API route、server action、导入脚本或 production 写入入口。

repository 当前边界：

1. 只允许写入 `QuoteSourceStagingBatch` / `QuoteSourceStagingRow` metadata。
2. 不保存具体金额、底价、毛利或财务批准价格。
3. `finance_confirmed` 仍然只表示财务确认这份 staging 来源可以继续作为草稿数据源候选，不等于 FinanceApprovedPrice。
4. `export_draft_candidate` 仍然只是出口部报价草稿候选，不是正式报价，也不能发客户。
5. `addon_only`、`blocked`、`ignored` 行不能设置为 `export_draft_candidate`。
6. repository 不暴露给浏览器页面，不提供上传报价表能力。
7. repository tests 只能连接 local / test / temporary PostgreSQL，不能连接 production RDS。

repository 写入保护：

1. `NODE_ENV=production` 时拒绝写入。
2. `DATABASE_URL` 缺失或无效时拒绝写入。
3. 数据库 host 不是 `localhost`、`127.0.0.1` 或 `::1` 时拒绝写入。
4. 数据库名必须包含 `dev`、`test`、`verify` 或 `local` 这类非生产标识。
5. 任何输入中出现敏感价格字段都抛错，不静默忽略。

repository 默认值和校验：

1. `submittedByRole` 缺省为 `finance`，非 `finance` 拒绝。
2. `consumerDepartment` 缺省为 `export`，非 `export` 拒绝。
3. batch status、rowStatus、visibility、priceCandidateStatus 必须在 domain 类型允许范围内。
4. `addon_only + export_draft_candidate` 拒绝。
5. `blocked / ignored + export_draft_candidate` 拒绝。

## Quote Task 006D repository 状态流转和审计设计

006D 在 repository 层补充 batch 状态机。状态变更仍然只服务 staging metadata，不开放 UI、API route 或 server action，不接真实 AuditLog action，不导入报价表。

允许流转：

| 当前状态 | 下一状态 |
|---|---|
| `draft` | `dry_run_passed` |
| `dry_run_passed` | `finance_confirmed` / `adapter_fix_required` / `finance_table_fix_required` / `cancelled` |
| `adapter_fix_required` | `dry_run_passed` |
| `finance_table_fix_required` | `dry_run_passed` |
| `finance_confirmed` | `cancelled` |

禁止流转：

| 当前状态 | 禁止下一状态 |
|---|---|
| `finance_confirmed` | `draft` / `dry_run_passed` |
| `cancelled` | `finance_confirmed` / `dry_run_passed` / `adapter_fix_required` / `finance_table_fix_required` |

repository 状态更新规则：

1. `updateQuoteSourceStagingBatchStatus` 必须先读取当前 batch status。
2. 状态更新必须调用 `assertQuoteSourceStagingBatchTransition`。
3. 非法流转必须抛错，不静默忽略。
4. `finance_confirmed` 只写确认人和确认时间，不创建任何正式价格字段。
5. `finance_confirmed` 仍然不等于 FinanceApprovedPrice。
6. `cancelled` 可以写 notes / warnings，但不删除 batch 或 rows。
7. 状态更新不会改变 row visibility。
8. `addon_only` / `blocked` / `ignored` 行仍不能成为 `export_draft_candidate`。

未来 AuditLog metadata 设计：

```ts
type QuoteSourceStagingAuditMetadata = {
  batchId: string;
  sourceFileName?: string;
  adapterId?: string;
  category?: string;
  previousStatus: string;
  nextStatus: string;
  actorUserId?: string;
  actorName?: string;
  reason?: string;
};
```

未来 AuditLog action 建议：

- `quote_source_staging.status_change`
- `quote_source_staging.finance_confirmed`
- `quote_source_staging.cancelled`
- `quote_source_staging.adapter_fix_required`
- `quote_source_staging.finance_table_fix_required`

006D 不接真实 AuditLog 写入。后续如果要接入，必须由服务端权限校验和 AuditLog domain action 统一处理。

## Quote Task 006E dry-run 到 staging input mapper

006E 增加纯 domain mapper，将脱敏 dry-run summary / decision 结果转换为 repository input。mapper 只是把已经识别出的结构 metadata 整理成 `CreateQuoteSourceStagingBatchInput` 和 row input，不读取 Excel、不导入报价表、不写生产数据库、不生成报价草稿或正式报价。

decision 到 batch status 的映射：

| dry-run decision | staging batch status |
|---|---|
| `ready_for_staging_design` | `dry_run_passed` |
| `needs_finance_table_fix` | `finance_table_fix_required` |
| `needs_adapter_fix` | `adapter_fix_required` |
| `addon_only` | `dry_run_passed`，但 row 必须是 `addon_only` 且不能给出口部消费 |
| `blocked` | `cancelled`，表示该 dry-run 结果不进入后续 staging 候选 |
| `manual_review_required` | `dry_run_passed`，但 row 必须进入人工确认路径 |

mapper 规则：

1. `submittedByRole` 默认 `finance`。
2. `consumerDepartment` 默认 `export`。
3. mapper 不会自动生成 `finance_confirmed`。
4. candidate 行在 dry-run 阶段默认 `visibility = finance_only`。
5. `export_draft_candidate` 必须等待后续财务确认 action，mapper 本身不提升 visibility。
6. `addon_only` / `blocked` / `ignored` 行不能映射为 `export_draft_candidate`。
7. `needs_manual_review` 行默认只进入 `finance_only` 或 `internal_risk_only`。
8. mapper 递归拒绝敏感价格字段，包括具体金额、底价、毛利、财务批准价格和可发客户状态。
9. mapper 输出仍只是 staging metadata，不等于正式价格导入。

未来 AuditLog metadata 建议：

```ts
type QuoteSourceStagingMappedFromDryRunAuditMetadata = {
  sourceFileName: string;
  adapterId: string;
  category?: string;
  dryRunDecisionStatus: QuoteSourceDryRunDecisionStatus;
  batchStatus: QuoteSourceStagingBatchStatus;
  rowCount: number;
  actorUserId?: string;
  actorName?: string;
};
```

未来 AuditLog action 可命名为：

- `quote_source_staging.mapped_from_dry_run`

006E 不接真实 AuditLog 写入，不开放 UI / API / server action。

## Quote Task 009E uploaded dry-run confirmation to batch metadata

009E 在 009C uploaded file dry-run 之后新增 feature-gated 确认动作：把 `QuoteSourceUpload` 上已完成的 dry-run 结构摘要确认进入 `QuoteSourceStagingBatch` metadata。

边界：

1. 确认动作只创建 `QuoteSourceStagingBatch`。
2. 不创建 `QuoteSourceStagingRow`。
3. 不读取 Excel 行。
4. 不保存具体价格、底价、毛利或财务批准价格。
5. 不保存 KJ 行 / OEM 行。
6. 不生成报价草稿。
7. 不生成正式报价。

feature flag：

- `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN_CONFIRM`
- 缺失 / `false` 默认关闭。
- 不使用 `NEXT_PUBLIC_`。
- production 部署后默认不可确认。

确认前置条件：

1. `uploadStatus = uploaded`。
2. `dryRunStatus = completed`。
3. `dryRunAdapterId` 存在。
4. `dryRunCategory` 存在。
5. `dryRunSummary` 存在。
6. `stagingBatchId` 为空，避免同一个 upload 重复确认创建多个 batch。

确认后写入：

1. `QuoteSourceStagingBatch.sourceFileName = QuoteSourceUpload.sourceFileName`。
2. `adapterId = dryRunAdapterId`。
3. `category = dryRunCategory`。
4. `submittedByRole = finance`。
5. `consumerDepartment = export`。
6. `dryRunDecisionStatus` 来自 dry-run decision。
7. `status` 按 dry-run decision 映射，结构满足 V1 条件时为 `dry_run_passed`。
8. `createdByUserId / createdByName` 为当前 `super_admin`。
9. `QuoteSourceUpload.stagingBatchId`、`dryRunConfirmedAt`、`dryRunConfirmedByUserId`、`dryRunConfirmedByName`。

AuditLog：

- action：`quote_source_upload.dry_run_confirm`
- metadata 只包含 uploadId、stagingBatchId、sourceFileName、adapterId、category、dryRunStatus、dryRunDecisionStatus、batch status、actor 和 warnings。
- metadata 不得包含具体价格、底价、毛利、完整 Excel 行、KJ 明细、OEM 明细、signed URL 或 AccessKey。

## Quote Task 009G staging batch review and row import precheck

009G 在 009E 创建 `QuoteSourceStagingBatch` metadata 之后，补充 Finance staging 页面说明和纯 domain row import precheck。

边界：

1. 只展示 staging batch metadata。
2. 不创建 `QuoteSourceStagingRow`。
3. 不读取新的真实报价表。
4. 不解析 Excel 行。
5. 不保存具体价格、KJ 行或 OEM 行。
6. 不生成报价草稿。
7. 不生成正式报价。

`manual_review_required` 不代表失败。它表示 dry-run 结构识别已完成，但进入行级导入前需要人工确认：

1. 当前 adapter 是否正确。
2. 当前 category 是否正确。
3. dry-run warnings 是否可接受。
4. 是否允许后续解析行级 KJ / 产品候选。
5. 是否允许后续进入候选金额设计。

新增 `precheckQuoteSourceStagingRowImport` 纯函数，只回答是否可以进入行级导入设计：

1. `dry_run_passed + ready_for_staging_design + adapter/category` 可进入设计。
2. `dry_run_passed + manual_review_required + adapter/category` 可进入设计，但需要财务人工确认。
3. adapterId 或 category 缺失必须 blocked。
4. cancelled / 非 `dry_run_passed` batch 必须 blocked。
5. rowCount > 0 时提示已有 rows，避免重复导入。
6. `canImportRowsNow` 永远为 `false`。

页面必须明确：

- 当前只有 staging batch metadata。
- 当前还没有 staging rows。
- 当前还没有导入价格。
- 当前还不能给出口部使用。
- 当前不能生成报价草稿。
- 当前不能生成正式报价。

## Quote Task 009H condenser row import mapper / parser

009H 在 009G precheck 之后新增 local / test only 的 row import mapper / parser。它用于验证行级候选 metadata 的映射规则，不新增 UI、API route、server action、Prisma schema 或 migration。

第一版只支持：

1. `adapterId = condenser-cost-2026`。
2. `category = 冷凝器`。
3. local / test DB 写入验证。

009H mapper 输出 `CreateQuoteSourceStagingRowInput[]`，只包含脱敏 metadata：

1. KJ 候选和标准化 KJ。
2. 产品名称 / 车型 / 规格候选。
3. 包装信息是否存在。
4. OEM / OE 信息是否存在，但不做自动匹配。
5. 成本候选列 / 报价候选列是否存在。
6. `visibility = finance_only`。
7. `rowStatus = candidate` 或 `needs_manual_review`。

009H 明确不保存：

1. 具体价格。
2. 成本价 / 报价价 / 单价 / 金额。
3. 底价 / 毛利。
4. FinanceApprovedPrice。
5. 完整 Excel 行。
6. 可发客户的正式报价状态。

`rowStatus = candidate` 仍不等于出口部可用。后续必须经过财务确认和 visibility promotion，才可能成为 `export_draft_candidate`，且仍只用于询价 / 报价草稿。

## Quote Task 009K-Fix finance confirmation action path

009K-Fix 只修复受控 production finance-confirm action path，不新增 schema / migration，不执行 production confirm。

修复原则：

1. 保留 staging repository 默认 production guard。
2. 只允许 Finance confirmation action 使用专用受控 production write reason。
3. action 必须先通过 feature flag 和 `super_admin` 校验。
4. `rowVisibilityPolicy` 必须是 `strict_candidate_only`。
5. `include_manual_review` 必须拒绝。
6. `manual_review_required` 不等于失败；它表示进入行级导入 / 可见性提升前需要人工确认。

受控确认成功后才允许：

1. `QuoteSourceStagingBatch.status` 从 `dry_run_passed` 变为 `finance_confirmed`。
2. 写入确认人和确认时间。
3. 只把合格 `candidate + finance_only` rows 提升为 `export_draft_candidate`。
4. 写入脱敏 AuditLog `quote_source_staging.finance_confirmed`。

仍然禁止：

1. 提升 `needs_manual_review` / `addon_only` / `blocked` / `ignored` rows。
2. 提升 `missing` / `requires_finance_review` rows。
3. 保存具体价格、底价、毛利或 FinanceApprovedPrice。
4. 生成报价草稿或正式报价。

009K-Retry 才执行 production UAT。

## Quote Task 006F finance confirmation domain action

006F 增加 Finance staging confirmation domain action。该 action 仍然只服务 staging metadata，只允许在 local / test DB 中测试，不开放 UI、API route 或 server action，不读取真实 Excel，不导入报价表，不写 production 数据。

Finance confirmation 的含义：

1. 将 `dry_run_passed` batch 推进到 `finance_confirmed`。
2. 写入 `confirmedByUserId`、`confirmedByName`、`confirmedAt`。
3. 按行级规则把少量安全候选行从 `finance_only` 提升为 `export_draft_candidate`。
4. 继续保留所有 warnings 和价格边界。

Finance confirmation 不表示：

1. 形成 FinanceApprovedPrice。
2. 形成正式价格表。
3. 生成正式报价。
4. 可以直接发客户。
5. 批准底价、毛利或特殊价格。

确认前置条件：

- 只有 batch 当前状态为 `dry_run_passed` 时，才能进入 `finance_confirmed`。
- `draft`、`adapter_fix_required`、`finance_table_fix_required`、`cancelled`、已经 `finance_confirmed` 的 batch 都不能直接确认。
- 确认必须调用 staging batch 状态机；非法流转必须抛错。

默认行级提升策略为 `strict_candidate_only`：

| rowStatus | priceCandidateStatus | 原 visibility | 确认后 visibility |
|---|---|---|---|
| `candidate` | `cost_candidate_available` / `quote_candidate_available` / `not_finance_approved` | `finance_only` | `export_draft_candidate` |
| `candidate` | `missing` / `requires_finance_review` | `finance_only` | `finance_only` |
| `needs_manual_review` | 任意 | `finance_only` | `finance_only` |
| `addon_only` | 任意 | `finance_only` / `internal_risk_only` | 不得为 `export_draft_candidate` |
| `blocked` / `ignored` | 任意 | `finance_only` / `internal_risk_only` | 不得为 `export_draft_candidate` |

`not_finance_approved` 可以作为报价草稿候选行被出口部消费，但仍然只是价格候选边界标签，不是正式报价，不是财务批准价格，不能直接发客户。

未来 AuditLog metadata 建议：

```ts
type QuoteSourceStagingFinanceConfirmedAuditMetadata = {
  batchId: string;
  sourceFileName?: string;
  adapterId?: string;
  category?: string;
  previousStatus: string;
  nextStatus: "finance_confirmed";
  actorUserId: string;
  actorName?: string;
  exportDraftCandidateRows: number;
  financeOnlyRows: number;
  internalRiskOnlyRows: number;
  addonOnlyRows: number;
  blockedRows: number;
  ignoredRows: number;
  confirmationNote?: string;
};
```

未来 AuditLog action 可命名为：

- `quote_source_staging.finance_confirmed`

006F 不接真实 AuditLog 写入，不开放确认按钮，不开放 server action。后续如果要开放给 Finance 页面，必须先补服务端权限校验、AuditLog 写入和只读 / 写入边界验证。

## Quote Task 006G confirmation UI / action contract

006G 只设计未来 Finance staging confirmation 页面和 action contract，详见 `docs/quote-source-staging-confirmation-ui-contract.md`。本轮不实现 UI 页面，不实现 API route，不实现 server action，不写 production 数据。

未来页面归属 Finance：

- `/finance/quote-source-staging`
- `/finance/quote-source-staging/[batchId]`

未来权限 key 草案：

- `finance.quote_source_staging.view`
- `finance.quote_source_staging.confirm`
- `finance.quote_source_staging.cancel`
- `finance.quote_source_staging.request_fix`

本轮不把这些权限写入 seed，不运行 `db:seed`。

未来确认 action contract 只允许 `rowVisibilityPolicy = strict_candidate_only`。这意味着：

1. 只有符合条件的 `candidate` 行能成为 `export_draft_candidate`。
2. `needs_manual_review` 默认不自动给出口部消费。
3. `addon_only` / `blocked` / `ignored` 永远不自动给出口部消费。
4. action result 不返回具体价格、底价、毛利或财务批准价格。
5. `finance_confirmed` 仍然不等于 FinanceApprovedPrice。
6. `export_draft_candidate` 仍然不是正式报价。

未来 action 必须接 AuditLog，但 006G 只设计 metadata，不接真实 AuditLog 写入。

## Quote Task 007A Finance staging 只读页面

007A 已实现 Finance staging confirmation 的只读页面：

- `/finance/quote-source-staging`
- `/finance/quote-source-staging/[batchId]`

007A 页面边界：

1. 仅 `super_admin` 可访问。
2. 只读展示 staging batch / rows。
3. 列表页展示批次 ID、文件名、adapterId、品类、dry-run decision、当前 status、`submittedByRole`、`consumerDepartment` 和创建时间。
4. 详情页展示 batch 基本信息、row 统计、出口部可消费预览、风险提示和只读确认区域。
5. 确认 / 退回修正 / 取消按钮 disabled，并标记“下一阶段开放”。
6. 页面不实现 server action、API route、POST action 或写库逻辑。
7. 页面不修改 batch status，不修改 row visibility。
8. 页面不创建测试 batch / row，不读取真实 Excel，不导入报价表。
9. 页面不展示具体金额、底价、毛利或财务批准价格字段。

007A 继续强调：

- `finance_confirmed` 不等于 FinanceApprovedPrice。
- `export_draft_candidate` 不是正式报价。
- `needs_manual_review` 默认不会给出口部消费。
- `addon_only` / `blocked` / `ignored` 不会给出口部消费。

未来 007B 若要实现 confirmation server action，必须基于 006F 的 domain action，并补齐服务端权限校验、AuditLog 写入、错误回滚和生产数据安全验证。

## Batch 设计

```ts
type QuoteSourceStagingBatchStatus =
  | "draft"
  | "dry_run_passed"
  | "finance_confirmed"
  | "adapter_fix_required"
  | "finance_table_fix_required"
  | "cancelled";

type QuoteSourceStagingBatch = {
  id: string;
  sourceFileName: string;
  adapterId: string;
  category: string;
  submittedByRole: "finance";
  consumerDepartment: "export";
  dryRunDecisionStatus: QuoteSourceDryRunDecisionStatus;
  status: QuoteSourceStagingBatchStatus;
  createdByUserId?: string;
  createdAt: string;
  confirmedByUserId?: string;
  confirmedAt?: string;
  warnings: string[];
  notes?: string;
};
```

规则：

1. `submittedByRole` 必须是 `finance`。
2. `consumerDepartment` 可以是 `export`。
3. dry-run 未通过不能进入 staging。
4. staging batch 仍不是正式价格表。
5. `finance_confirmed` 不等于财务批准价格。
6. `finance_confirmed` 只表示财务确认这份表可以作为草稿数据源候选。

## Row 设计

```ts
type QuoteSourceStagingRowStatus =
  | "candidate"
  | "needs_manual_review"
  | "addon_only"
  | "blocked"
  | "ignored";

type QuoteSourceStagingVisibility =
  | "finance_only"
  | "export_draft_candidate"
  | "internal_risk_only";

type QuoteSourceStagingRow = {
  id: string;
  batchId: string;
  sourceRowNumber?: number;

  rawKjCode?: string;
  standardKjCode?: string;
  baseKjCode?: string;
  oldKjNo?: string;
  fumacrmCode?: string;
  dingjieCodeWithoutCap?: string;
  dingjieCodeWithCap?: string;

  productNameCandidate?: string;
  category?: string;
  modelCandidate?: string;
  specificationCandidate?: string;

  tradeMode?: "export_usd" | "domestic_cny" | "unknown";
  priceCandidateStatus:
    | "cost_candidate_available"
    | "quote_candidate_available"
    | "missing"
    | "not_finance_approved"
    | "requires_finance_review";

  hasCostCandidate: boolean;
  hasQuoteCandidate: boolean;
  hasPackagingInfo: boolean;
  hasOemInfo: boolean;

  visibility: QuoteSourceStagingVisibility;
  rowStatus: QuoteSourceStagingRowStatus;

  warnings: string[];
};
```

## 为什么本轮不保存具体金额

006B Prisma schema 也不设计以下字段：

- `amount`
- `unitPrice`
- `costPrice`
- `quotePrice`
- `salesPrice`
- `minimumPrice`
- `grossMargin`
- `margin`
- `profit`
- `approvedPrice`
- `financeApprovedPrice`
- `sentToCustomer`
- `officialQuote`

原因：

1. 成本价敏感。
2. 出口部不能看到底价 / 毛利。
3. 当前报价表只是成本候选，不是财务批准价格。
4. staging 不能绕过 FinancePricing。
5. 具体金额的存储、脱敏、可见性、审计和审批必须单独设计。

本轮只设计：

- `hasCostCandidate`
- `hasQuoteCandidate`
- `priceCandidateStatus`

如果后续需要保存具体金额，必须另立 FinancePricing / PriceCandidateStorage / 权限脱敏 / 审计 / 审批任务。

## Visibility 规则

### finance_only

只有财务 / 管理层可见。

适用：

- 成本候选。
- 内部风险。
- 需要财务确认的字段。
- 不应暴露给出口部的说明。

### export_draft_candidate

出口部可用于生成报价草稿候选。

限制：

- 仍然不是正式报价。
- 不包含底价 / 毛利。
- 不包含财务未授权的成本明细。
- 后续正式报价仍需 FinancePricing。

### internal_risk_only

只作为风险提示，不能进入报价草稿行。

适用：

- 不能生产。
- 只做报价不公布。
- 不保质 / 漏水说明。
- 限销或其它风险 sheet。

## 水箱 / 中冷器 staging 规则

水箱 / 中冷器可以进入 staging 设计，但必须保留行级风险：

- 多编码。
- 多规格。
- 多包装。
- 基础 KJ 多候选。
- 旧 KJ / 孚盟码 / 鼎捷码匹配。
- OEM 暂不自动匹配。
- Excel 嵌入图不是稳定主图。

行级规则：

1. 完整标准 KJ 唯一匹配：`rowStatus = candidate`。
2. 基础 KJ 多候选：`rowStatus = needs_manual_review`。
3. 旧 KJ / 孚盟 / 鼎捷码匹配：`rowStatus = needs_manual_review`。
4. OEM / OE：`rowStatus = needs_manual_review` 或 `blocked`，V1 暂不自动匹配。
5. 命中特殊 sheet：`visibility = internal_risk_only`，不得直接进入产品报价草稿行。

## 特殊包装及其他 staging 规则

特殊包装及其他不能进入产品标准报价 staging。

建议规则：

- `rowStatus = addon_only`
- `visibility = finance_only` 或 `internal_risk_only`

它只能作为包装 / 附加项候选，不能给 Export 当产品报价行消费。

## Export 消费边界

Export 只能消费：

1. 财务提交并确认的 staging batch。
2. `visibility = export_draft_candidate` 的 row。
3. 没有阻断性风险的候选行。
4. 仍然只作为报价草稿数据源候选。

Export 不能消费：

1. dry-run 原始结果。
2. `finance_only` row。
3. `internal_risk_only` row。
4. `addon_only` row 作为产品标准报价行。
5. 任何具体底价、毛利或未经 FinancePricing 批准的价格事实。

## 007B Finance confirmation server action

Quote Task 007B 新增 `confirmQuoteSourceStagingBatchAction`，作为未来 Finance staging 确认页面的 server action contract 实现。页面按钮仍未启用，真实 UI 调用后续 007C 再接。

Action 规则：

1. 仅 `super_admin` 可调用；普通 admin、普通财务、出口部账号暂不开放。
2. 不新增权限 key，不运行 seed。
3. 只允许 `rowVisibilityPolicy = strict_candidate_only`。
4. 拒绝 `include_manual_review`，因此 `needs_manual_review` 行不会自动给出口部消费。
5. 只调用已有 `confirmQuoteSourceStagingBatchForDraftCandidates`，不新建正式报价状态机。
6. 写入 `AuditLog.action = quote_source_staging.finance_confirmed`。
7. AuditLog metadata 只保存 batch、status、actor、row count 和确认说明，不保存具体价格、底价、毛利或正式报价字段。

确认后语义：

- `finance_confirmed` 只表示财务确认该 staging batch 可作为报价草稿候选数据源。
- `finance_confirmed` 不等于 `FinanceApprovedPrice`。
- `export_draft_candidate` 仍不是正式报价，不能直接发客户。
- `not_finance_approved` 行可以成为报价草稿候选，但必须继续提示“不是财务批准价格”。
- `missing` / `requires_finance_review` 价格状态不能自动给出口部消费。
- `addon_only` / `blocked` / `ignored` / `needs_manual_review` 默认不能变成 `export_draft_candidate`。

007B 仍然不做：

- UI 按钮 wiring。
- API route。
- Prisma schema / migration。
- Excel 导入。
- 报价表上传。
- 真实价格保存。
- 价格审批。
- 正式报价。

## 007C feature-gated confirmation UI

Quote Task 007C 将确认表单接入 `/finance/quote-source-staging/[batchId]`，但默认生产不可用。

Feature flag：

- `KINGA_ENABLE_FINANCE_STAGING_CONFIRM`
- 缺失或 `false` 时关闭。
- `true` 时开启。
- 不使用 `NEXT_PUBLIC_`，不暴露给前端。
- ECS 部署不自动修改 `.env`，不自动启用。

关闭时：

1. 页面仍按只读方式展示 staging batch / rows。
2. “确认进入草稿候选（暂未开放）”按钮 disabled。
3. 不渲染可提交 form。
4. 不调用 server action。
5. 不写数据库。

开启时：

1. 详情页显示确认说明输入框。
2. 用户必须勾选风险确认 checkbox。
3. 表单固定提交 `rowVisibilityPolicy = strict_candidate_only`。
4. 不允许选择 `include_manual_review`。
5. 调用 `confirmQuoteSourceStagingBatchAction`，由 action 再校验 `super_admin` 并写入 AuditLog。
6. 确认成功后刷新详情页，可显示 `status = finance_confirmed`、`confirmedBy`、`confirmedAt`。

继续不开放：

- 退回修正。
- 取消批次。
- API route。
- Prisma schema / migration。
- 报价表导入。
- 报价草稿生成。
- 正式报价。

安全边界：

- `finance_confirmed` 不等于 `FinanceApprovedPrice`。
- `export_draft_candidate` 仍不是正式报价。
- `not_finance_approved` 可以作为报价草稿候选，但不能作为正式报价。
- `needs_manual_review` / `addon_only` / `blocked` / `ignored` 不会自动给出口部消费。

## Quote Task 007D feature flag verification and rollout runbook

007D 只做 feature flag 与 confirmation flow 验证，以及 production rollout runbook。不新增 schema / migration，不启用 production feature flag，不修改 ECS `.env`，不写 production 数据。

已验证边界：

1. `KINGA_ENABLE_FINANCE_STAGING_CONFIRM` 缺失或 `false` 时默认关闭。
2. `KINGA_ENABLE_FINANCE_STAGING_CONFIRM=true` 时，本地 / test 环境可显示确认表单并调用 confirmation action。
3. 不使用 `NEXT_PUBLIC_`，不把 flag 暴露到浏览器运行时。
4. 关闭时按钮 disabled，不存在可提交 form，不调用 action。
5. 开启时 `rowVisibilityPolicy` 固定为 `strict_candidate_only`。
6. 普通 admin、普通财务、出口部用户和未登录用户不能 confirm。
7. `candidate + cost_candidate_available` 可以变成 `export_draft_candidate`。
8. `candidate + not_finance_approved` 可以作为草稿候选，但仍然不是正式报价。
9. `needs_manual_review` / `addon_only` / `blocked` / `ignored` 不会自动给出口部消费。
10. `missing` / `requires_finance_review` 价格状态不会自动给出口部消费。
11. AuditLog 写入 `quote_source_staging.finance_confirmed`，metadata 不含敏感价格字段。

Production rollout runbook：

- `docs/quote-source-staging-confirmation-rollout-runbook.md`

开启 production 前必须确认：

1. 已有真实 staging batch。
2. staging batch 已通过 Finance dry-run 和确认流程。
3. 当前代码版本已部署。
4. AuditLog 可用。
5. super_admin 明确确认本次动作只是报价草稿候选数据源确认。

开启和关闭都必须由人工修改 ECS `.env` 并重启 PM2；Codex 不自动修改 ECS `.env`。

## 下一步

如果后续进入实现，需要另立任务并重新评审：

1. Prisma staging schema 是否需要落库。
2. staging batch / row 权限模型。
3. 金额字段是否保存、如何脱敏、谁可见。
4. FinancePricing 审批和价格快照。
5. Export 侧如何只消费允许可见的 staging row。
6. AuditLog 和导入批次审计。

本轮不做这些实现。

## Quote Task 009I feature-gated row import action

009I 新增 row import action / route，但只用于 local / test DB 验证，production 默认关闭。

Feature flag：

- `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_ROW_IMPORT`
- 缺失或 `false` 时关闭。
- `true` 时仍需通过 server-side 权限、batch 状态、adapter/category、rowCount 和 production write guard。
- 不使用 `NEXT_PUBLIC_`，不暴露给前端。

第一版只支持：

- `adapterId = condenser-cost-2026`
- `category = 冷凝器`

执行流程：

1. `super_admin` 对已存在的 `QuoteSourceStagingBatch` 触发 row import。
2. batch 必须是 `status = dry_run_passed`。
3. 系统通过 `QuoteSourceUpload.stagingBatchId` 查找对应上传文件。
4. parser + mapper 只生成脱敏 row metadata。
5. 创建 `QuoteSourceStagingRow` 时默认 `visibility = finance_only`。
6. 写入 `quote_source_staging.rows_imported` AuditLog。

继续不做：

1. 不保存具体价格、底价、毛利或财务批准价格。
2. 不保存完整 Excel 行。
3. 不自动设置 `export_draft_candidate`。
4. 不生成报价草稿。
5. 不生成正式报价。
6. 不开放给出口部消费。

后续必须单独完成 finance confirmation / visibility promotion / export consumption UAT，才能让出口部消费确认后的 staging 候选。

## Quote Task 009J-Fix controlled production row import write channel

009J production UAT 中，row import action 在 repository production guard 前被拒绝，错误为 `quote source staging repository writes are disabled in production`。009J-Fix 保留默认 guard，并增加一条显式 controlled production write option，只允许 Finance row import UAT 使用：

- `allowControlledProductionWrite = true`
- `productionWriteReason = finance_quote_source_row_import_uat`

该 option 只能由 `quote-source-row-import` action 在完成全部业务校验后传入。校验包括：

1. feature flag 已开启。
2. 当前账号是 `super_admin`。
3. batch 存在且 `status = dry_run_passed`。
4. batch 是 `condenser-cost-2026 / 冷凝器`。
5. batch 当前没有 rows。
6. 能通过 `QuoteSourceUpload.stagingBatchId` 找到 upload。
7. upload 是 `uploaded`，dry-run 已 `completed`，且有 server-side `storageKey`。
8. parser / mapper 生成 rows 后，rows 不含价格字段、完整 Excel 行、`export_draft_candidate` 或正式报价字段。
9. rows 全部默认 `finance_only`。

repository 层继续复核敏感字段和 visibility。该 controlled path 不开放给出口部，不保存具体价格，不创建正式价格，不生成报价草稿，也不生成正式报价。009J-Retry 才会执行 production row import UAT。

## Quote Task 009M candidate amount design boundary

009L 已完成真实 finance-confirmed staging rows 的 Export Workbench UAT。该 UAT 证明出口部可以在 feature flag 控制下读取 `export_draft_candidate` 行并生成不带金额的草稿预览 / 草稿 Excel，同时 `needs_manual_review` 行不会被出口部消费。

009M 只设计候选金额如何在后续阶段进入 staging / quote draft preview，不实现入库、不解析真实 Excel 金额、不新增 Prisma schema / migration。

候选金额边界：

1. `candidateAmount` 不是 `FinanceApprovedPrice`。
2. `candidateAmount` 不是正式报价。
3. `candidateAmount` 不能直接发客户。
4. `candidateAmount` 必须后续进入 FinancePricing / 财务确认 / 价格快照链路。
5. 带金额的草稿 Excel 即使未来开放，也仍然必须标注非正式报价。

外销 / 内销候选来源：

1. `export_usd` 使用 `2026.5.11出口成本报价`，作为外销 / 境外收美金 / 有退税场景的候选来源。
2. `domestic_cny` 使用 `2026.5.11出口部内销成本报价`，作为内销 / 收人民币场景的候选来源。
3. `unknown` 不自动选择候选金额，必须提示选择外销或内销。
4. 历史日期列不进入默认候选。

如果未来保存候选金额，必须单独设计来源字段、visibility、财务确认人、AuditLog 和权限脱敏。本阶段只新增 domain types，不保存真实金额，不让出口部看到底价 / 毛利，不改变 staging row schema。

## Quote Task 009N candidate amount storage schema

009N 新增独立 `QuoteCandidateAmount` storage model，只用于保存未来候选金额的结构位置。本轮不导入真实金额、不读取真实 Excel、不创建候选金额记录、不生成报价草稿或正式报价。

关键边界：

1. 不修改 `QuoteSourceStagingRow` 既有字段。
2. `candidateValue` 只是候选值，不命名为 `costPrice`、`quotePrice`、`approvedPrice` 或 `financeApprovedPrice`。
3. 默认 `visibility = finance_only`，出口部不可见。
4. 默认 `status = not_finance_approved`。
5. `isFinanceApprovedPrice = false`，`canBeSentToCustomer = false`，`requiresFinancePricing = true`。
6. 正式报价仍必须后续接 FinancePricing。
7. 后续导入真实金额必须另做 action / UAT / AuditLog，不得直接复用 schema migration 当作导入动作。

## Quote Task 009O candidate amount local/test importer

009O 只实现候选金额 local/test importer，不开放 production 导入。它可以从 workbook row-like 数据中读取 mock 候选金额，并在 local/test DB 创建 `QuoteCandidateAmount`，用于验证 storage 和重复导入边界。

第一版支持范围：

1. 只支持 `condenser-cost-2026 / 冷凝器`。
2. `export_usd` 只读取 `2026.5.11出口成本报价`，币种 `USD`。
3. `domestic_cny` 只读取 `2026.5.11出口部内销成本报价`，币种 `CNY`。
4. `unknown` 不自动导入金额。
5. 旧日期列，例如 `2026.4.10`，不作为默认候选来源。

写入边界：

1. 只能写 local/test DB，production guard 默认拒绝。
2. `visibility` 默认并保持 `finance_only`。
3. `status` 默认并保持 `not_finance_approved`。
4. `isFinanceApprovedPrice = false`。
5. `canBeSentToCustomer = false`。
6. `requiresFinancePricing = true`。
7. repository 层防止同一 `stagingRowId + tradeMode + sourceColumnName + sourceColumnDate` 重复导入。

009O 不生成 `QuoteDraft` / `QuoteDraftLine`，不生成正式报价，不给出口部显示候选金额。production 导入、权限、AuditLog 和 UAT 后续单独执行。

## Quote Task 009P candidate amount import action

009P 新增 feature-gated candidate amount import action / route，但只在 local/test DB 验证。production 默认关闭，不执行生产导入，不新增 UI，不让出口部看到金额。

边界：

1. 服务端 flag：`KINGA_ENABLE_FINANCE_QUOTE_CANDIDATE_AMOUNT_IMPORT`，缺失或非 `true` 默认关闭。
2. 只允许 `super_admin`。
3. 第一版只支持 `condenser-cost-2026 / 冷凝器`。
4. batch 必须是 `finance_confirmed`。
5. 只处理 `export_draft_candidate + rowStatus=candidate` rows。
6. `needs_manual_review` rows 不导入金额。
7. `export_usd` 使用 `2026.5.11出口成本报价`，币种 `USD`。
8. `domestic_cny` 使用 `2026.5.11出口部内销成本报价`，币种 `CNY`。
9. `unknown` 不导入候选金额。
10. 旧日期列不导入。

写入仍固定 `QuoteCandidateAmount.visibility = finance_only`、`status = not_finance_approved`、`isFinanceApprovedPrice = false`、`canBeSentToCustomer = false`、`requiresFinancePricing = true`。action result 和 AuditLog metadata 不返回 `candidateValue`，不包含底价、毛利、完整 Excel 行或任何正式报价字段。

009P 不生成 `QuoteDraft` / `QuoteDraftLine`，不生成正式报价。production 导入和 UAT 后续在 009Q 单独执行。

## Quote Task 009Q candidate amount controlled production path

009Q 不执行 production import，只为后续 009R production UAT 建立受控写入边界。

受控 production path 必须同时满足：

1. `KINGA_ENABLE_FINANCE_QUOTE_CANDIDATE_AMOUNT_IMPORT = true`。
2. 当前用户是 `super_admin`。
3. batch 存在且 `status = finance_confirmed`。
4. batch adapter/category 为 `condenser-cost-2026 / 冷凝器`。
5. batch 中存在 `export_draft_candidate` rows。
6. 只处理 `export_draft_candidate + rowStatus=candidate` rows。
7. `needs_manual_review` rows 不导入候选金额。
8. upload 可通过 `QuoteSourceUpload.stagingBatchId` 找到，且 `uploaded / dryRunStatus=completed / storageKey exists`。
9. tradeModes 只允许 `export_usd` / `domestic_cny`，拒绝 `unknown`。

repository 默认 production guard 保留。production 写入只有在 action 完成上述校验后，携带 `productionWriteReason = finance_quote_candidate_amount_import_uat` 才能进入写入路径。

候选金额仍默认 `finance_only`，不是 `FinanceApprovedPrice`，不能发客户，不生成报价草稿或正式报价。
