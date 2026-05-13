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

## 下一步

如果后续进入实现，需要另立任务并重新评审：

1. Prisma staging schema 是否需要落库。
2. staging batch / row 权限模型。
3. 金额字段是否保存、如何脱敏、谁可见。
4. FinancePricing 审批和价格快照。
5. Export 侧如何只消费允许可见的 staging row。
6. AuditLog 和导入批次审计。

本轮不做这些实现。
