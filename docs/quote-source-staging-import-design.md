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
