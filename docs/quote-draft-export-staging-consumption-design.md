# Quote Task 008A｜Export 消费 Finance-confirmed staging 候选设计

日期：2026-05-13

本文件只设计 Export 侧如何读取财务已确认的 staging 候选数据，作为后续报价草稿来源。008A 不实现 UI 页面、不新增 API route、不新增 server action、不写数据库、不读取真实 Excel、不导入报价表、不生成报价草稿、不生成正式报价。

## 业务边界

1. 报价表 / 成本表 / 价格候选数据由财务提交和维护。
2. 出口部不能上传报价表，不能维护价格表，不能设置底价或毛利。
3. 出口部只能消费财务确认后的 staging 候选数据生成报价草稿。
4. staging 不是正式价格表。
5. `finance_confirmed` 不等于 FinanceApprovedPrice。
6. `export_draft_candidate` 仍然不是正式报价。
7. 报价草稿不是正式报价，不能直接发客户。
8. 正式报价必须后续接 FinancePricing。

## Export 可以消费什么

Export 侧只能读取同时满足以下条件的 staging row：

1. `batch.status = finance_confirmed`
2. `row.visibility = export_draft_candidate`
3. `row.rowStatus = candidate`
4. `row.priceCandidateStatus` 是以下之一：
   - `cost_candidate_available`
   - `quote_candidate_available`
   - `not_finance_approved`

即使满足以上条件，输出也只能是报价草稿数据源候选，不是正式报价，不是财务批准价格。

## Export 不能消费什么

Export 侧不能读取或使用：

1. `batch.status != finance_confirmed`
2. `row.visibility = finance_only`
3. `row.visibility = internal_risk_only`
4. `row.rowStatus = needs_manual_review`
5. `row.rowStatus = addon_only`
6. `row.rowStatus = blocked`
7. `row.rowStatus = ignored`
8. `row.priceCandidateStatus = missing`
9. `row.priceCandidateStatus = requires_finance_review`

`not_finance_approved` 可以作为报价草稿候选，但必须持续显示“非正式报价 / 非财务批准价格”。它不能进入正式报价，也不能直接发客户。

## 脱敏规则

Export 消费 staging 数据时禁止暴露：

- `amount`
- `costPrice`
- `unitPrice`
- `quotePrice`
- `approvedPrice`
- `financeApprovedPrice`
- `minimumPrice`
- `grossMargin`
- `margin`
- `profit`
- `officialQuote`
- `sentToCustomer`

可以暴露：

- `standardKjCode`
- `baseKjCode`
- `oldKjNo`，仅作为历史引用
- `productNameCandidate`
- `category`
- `modelCandidate`
- `specificationCandidate`
- `tradeMode`
- `priceCandidateStatus`
- `hasCostCandidate`
- `hasQuoteCandidate`
- `hasPackagingInfo`
- `hasOemInfo`
- 已脱敏 warnings

`hasCostCandidate = true` 只表示有成本候选，不显示金额。

`hasQuoteCandidate = true` 只表示有报价候选，不显示金额。

## Mapping contract

Staging row 到 Export quote draft source candidate 的输出类型：

```ts
type ExportQuoteDraftSourceCandidate = {
  source: "finance_confirmed_staging";
  stagingBatchId: string;
  stagingRowId: string;

  standardKjCode?: string;
  baseKjCode?: string;
  oldKjNo?: string;

  productNameCandidate?: string;
  category?: string;
  modelCandidate?: string;
  specificationCandidate?: string;

  tradeMode: "export_usd" | "domestic_cny" | "unknown";

  priceCandidateStatus:
    | "cost_candidate_available"
    | "quote_candidate_available"
    | "not_finance_approved";

  hasCostCandidate: boolean;
  hasQuoteCandidate: boolean;
  hasPackagingInfo: boolean;
  hasOemInfo: boolean;

  warnings: string[];
};
```

mapping 规则：

1. 不可暴露的 row 必须拒绝，不静默返回空候选。
2. 输出必须脱敏。
3. 输出必须包含“不是正式报价 / 不是财务批准价格” warning。
4. 输出不得包含具体价格、底价、毛利、FinanceApprovedPrice 或正式报价状态。

## 查询 contract

未来 Export 侧 KJ 查询输入类型：

```ts
type FindExportQuoteDraftSourceCandidatesInput = {
  kjCode?: string;
  normalizedKjCode?: string;
  category?: string;
  tradeMode?: "export_usd" | "domestic_cny" | "unknown";
  limit?: number;
};
```

查询规则：

1. 必须至少提供 `kjCode` 或 `normalizedKjCode`。
2. `limit` 默认 20。
3. `limit` 最大 50。
4. 只支持 KJ 查询。
5. 不支持 OEM 自动匹配。
6. OEM / OE 输入应返回 `oem_matching_not_supported` 或 `requiresTechnicalReview`，不查询 staging。
7. 008A 不实现 API route 或 server action。

## Quote Task 008B｜Export staging consumption repository

008B 在 008A 的 read-only contract 基础上新增内部 repository：

```ts
findExportQuoteDraftSourceCandidates(input): Promise<ExportQuoteDraftSourceCandidate[]>
```

repository 只读取 staging metadata，不写数据库、不生成报价草稿、不生成正式报价、不开放 UI / API / server action。

查询条件必须同时满足：

1. `batch.status = finance_confirmed`
2. `row.visibility = export_draft_candidate`
3. `row.rowStatus = candidate`
4. `row.priceCandidateStatus` 是 `cost_candidate_available`、`quote_candidate_available` 或 `not_finance_approved`
5. KJ 命中 `standardKjCode`、`baseKjCode` 或 `oldKjNo`

排除：

1. `batch.status != finance_confirmed`
2. `finance_only`
3. `internal_risk_only`
4. `needs_manual_review`
5. `addon_only`
6. `blocked`
7. `ignored`
8. `missing`
9. `requires_finance_review`

repository 会先调用 `canExposeStagingRowToExportDraft` 再调用 `mapStagingRowToExportQuoteDraftSourceCandidate`，避免查询条件和脱敏 mapping 分叉。

008B 支持：

1. `kjCode` 或 `normalizedKjCode`，至少提供一个。
2. `category` 过滤。
3. `tradeMode` 过滤；指定 `export_usd` 或 `domestic_cny` 时，也允许返回 `unknown` tradeMode 候选供人工核对。
4. `limit` 默认 20，最大 50。

008B 暂不支持：

1. OEM / OE 自动匹配。
2. 鼎捷编码查询。
3. 孚盟编码查询。
4. 包装附加项候选消费。

说明：`oldKjNo` 仅作为历史旧 KJ 引用查询；鼎捷 / 孚盟查询后续再做独立规则，避免把 ERP / CRM 历史码静默当作产品报价主键。

## 水箱 / 中冷器规则

如果 category 是水箱或中冷器，且 row 已经满足 `export_draft_candidate` 条件，可以给 Export 作为草稿候选。

但输出 warnings 必须保留：

```text
水箱 / 中冷器存在多编码、多规格、多包装字段，生成草稿前请确认。
```

如果 row 是 `needs_manual_review`，则不能给 Export 消费。

水箱 / 中冷器的人工确认是行级别风险，不是整个品类禁止进入 V1。

## 特殊包装规则

特殊包装及其他不能作为产品标准报价候选。

如果：

1. category 是 `特殊包装及其他`
2. 或 `rowStatus = addon_only`

则不能映射为 `ExportQuoteDraftSourceCandidate`。

008A 不设计 addon consumption。以后如需做包装附加项，需要单独设计：

```ts
type ExportQuoteDraftAddonCandidate = ...
```

## 为什么仍然不是正式报价

`export_draft_candidate` 只表示该 row 可以被出口部用于生成报价草稿候选。

它不表示：

1. 正式报价。
2. 可发客户报价。
3. 财务批准价格。
4. 底价批准。
5. 毛利批准。
6. 订单或合同价格。

正式报价必须后续接 FinancePricing，并引用财务批准后的价格事实或价格快照。

## 008A 不做

008A 不做：

1. UI 页面。
2. API route。
3. server action。
4. Prisma schema / migration。
5. 报价表导入。
6. Excel 读取。
7. 报价草稿生成。
8. 正式报价。
9. 价格审批。
10. production 写入。
