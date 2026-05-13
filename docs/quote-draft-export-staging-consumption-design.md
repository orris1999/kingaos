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

## Quote Task 008C｜Workbench feature-gated staging candidates

008C 将内部 `/export/quote-draft-workbench` 接入两种数据源：

1. `mock catalog`：默认数据源，继续不读取真实报价表。
2. `finance_confirmed staging candidates`：只读查询财务确认后的 staging 候选。

staging candidates 模式必须受服务端 feature flag 控制：

```text
KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=false
```

规则：

1. 环境变量缺失或不是 `true` 时，视为关闭。
2. 不使用 `NEXT_PUBLIC_`，不把环境变量暴露到前端。
3. production 默认关闭，本轮不修改 ECS `.env`。
4. flag 关闭时，Workbench 只能使用 mock catalog，staging 数据源 disabled。
5. flag 开启时，第一版仅 `super_admin` 可以通过只读 action 查询 staging candidates。

只读 action：

```ts
findExportQuoteDraftSourceCandidatesAction(input)
```

该 action：

1. 必须 `requireCurrentUser`。
2. 第一版只允许 `super_admin`。
3. 调用 `findExportQuoteDraftSourceCandidates`。
4. 不写数据库。
5. 不修改 batch / rows。
6. 不创建报价草稿。
7. 不生成正式报价。
8. 返回脱敏 `ExportQuoteDraftSourceCandidate[]`。

Workbench staging 模式显示：

1. 行号、原始输入、KJ。
2. 产品名称候选、品类、`tradeMode`。
3. 数量。
4. `priceCandidateStatus`。
5. `hasCostCandidate` / `hasQuoteCandidate`。
6. warnings。

Workbench staging 模式不得显示：

1. 具体价格。
2. 底价。
3. 毛利。
4. `FinanceApprovedPrice`。
5. 正式报价状态。
6. 可发客户状态。

如果查询无结果，显示：

```text
未找到财务确认的 staging 候选。
```

OEM / OE 输入仍显示：

```text
OEM 自动匹配暂未开放。
```

`not_finance_approved` 可以作为草稿候选，但必须显示：

```text
非财务批准价格，仅草稿候选。
```

008C 仍不保存输入、不保存输出、不导出 Excel / PDF、不生成报价草稿、不生成正式报价。

## Quote Task 008D｜Workbench input UX and draft preview builder

008D 将内部 `/export/quote-draft-workbench` 的输入体验调整为更接近业务员询价录入，但仍然只是 feature-gated 内部预览能力。

Workbench 支持：

1. 多行输入 `KJ + 数量 + 备注`。
2. 数量写法：`100pcs`、`100 pcs`、`*100`、`x 100`、`,`、`，`。
3. 缺少数量时保留预览行，并显示 `缺少数量` warning。
4. `tradeMode` 选择：`export_usd`、`domestic_cny`、`unknown`。
5. 数据源选择：`mock` 和 `finance_confirmed staging`。
6. 草稿候选预览表格：行号、原始输入、识别编码、数量、备注、销售模式、数据源、预览状态、KJ、产品名称、品类、价格候选状态和风险提示。

staging 模式继续受服务端 feature flag 控制：

```text
KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=false
```

规则：

1. 环境变量缺失或不是 `true` 时，视为关闭。
2. 不使用 `NEXT_PUBLIC_`，不暴露到浏览器。
3. production 默认关闭，本轮不修改 ECS `.env`。
4. flag 关闭时，Workbench 只能使用 mock catalog，staging 数据源 disabled。
5. flag 开启时，第一版仍仅 `super_admin` 可以只读查询 staging candidates。

预览状态：

1. `ready_for_draft_preview`：可生成草稿预览。
2. `not_found`：未找到候选。
3. `multiple_candidates`：多候选，需人工选择，不能自动取第一行。
4. `manual_review_required`：需人工确认。
5. `unsupported_oem`：OEM / OE 自动匹配暂未开放。
6. `missing_quantity`：缺少数量。
7. `staging_disabled`：staging 数据源未开放。
8. `error`：查询或预览构建失败。

价格和正式报价边界：

1. Workbench 不保存输入。
2. Workbench 不保存输出。
3. Workbench 不创建 `QuoteDraft` / `QuoteDraftLine`。
4. Workbench 不导出 Excel / PDF。
5. Workbench 不生成正式报价。
6. Workbench 不显示具体价格、底价或毛利。
7. Workbench 不返回 `FinanceApprovedPrice`、`officialQuote` 或 `sentToCustomer`。
8. `not_finance_approved` 只能显示为“非财务批准价格，仅草稿候选”，不能作为正式报价。
9. 水箱 / 中冷器候选继续保留多编码、多规格、多包装人工确认 warning。

## Quote Task 008E｜Workbench preview UI and exception states

008E 对内部 `/export/quote-draft-workbench` 的草稿候选预览做可读性整理，目标是让业务员能快速看懂“哪些行可预览、哪些行需要先处理”。

新增纯 domain helper：

```ts
summarizeExportQuoteDraftPreviewLines(lines)
```

该 helper 统计：

1. 总行数。
2. 可生成草稿预览。
3. 未找到候选。
4. 多候选，需选择。
5. 需人工确认。
6. 缺少数量。
7. OEM 暂未开放。
8. 非财务批准价格。

Workbench 展示：

1. 中文 preview status badge。
2. 草稿预览汇总。
3. 待处理事项。
4. 行级 warnings 的短 badge 展示。
5. 草稿预览表格继续展示行号、原始输入、识别编码、数量、备注、销售模式、数据源、预览状态、KJ、产品名称、品类、价格候选状态和风险提示。

待处理事项包含：

1. 有 N 行缺少数量，请补充数量。
2. 有 N 行未找到财务确认 staging 候选，请核对 KJ 或联系财务 / 技术。
3. 有 N 行多候选，需要选择正确 KJ。
4. 有 N 行 OEM 暂未开放，请先通过技术确认找到 KJ。
5. 有 N 行价格候选不是财务批准价格，不能直接发客户。

008E 仍保持：

1. Mock / staging 两种 sourceMode。
2. staging mode 受 `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT` 控制，production 默认关闭。
3. feature flag 关闭时，staging 数据源 disabled，且不调用 staging candidate action。
4. 不保存输入。
5. 不保存输出。
6. 不创建 `QuoteDraft` / `QuoteDraftLine`。
7. 不导出 Excel / PDF。
8. 不生成正式报价。
9. 不显示具体价格、底价、毛利、财务批准价格或可发客户状态。
