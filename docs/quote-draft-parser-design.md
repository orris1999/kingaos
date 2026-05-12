# Quote Task 001A｜KJ 批量报价草稿解析器技术设计

日期：2026-05-12

本设计基于 `docs/quote-draft-data-audit.md` 和 `docs/quote-draft-roadmap.md`。本轮只做技术设计，不实现页面、不新增数据库模型、不导入报价表、不生成正式报价。

## 目标和边界

目标：

1. 定义 KJ 批量报价草稿解析器的输入、解析、匹配和输出结构。
2. 让后续 V1 可以基于 KJ 精确匹配生成“报价草稿候选”。
3. 对重复、缺失、不支持和风险状态给出明确人工处理提示。
4. 保持价格边界：成本候选不是财务批准价，报价草稿不是正式报价。

## 领域归属和报价表维护边界

- 报价草稿生成动作属于出口部业务动作，当前 canonical workbench 路径为 `/export/quote-draft-workbench`。
- 报价表 / 成本表 / 价格候选数据由财务部提交和维护，未来真实上传入口应进入 Finance / FinancePricing 域，文档占位路径为 `/finance/quote-source-tables`。
- 出口部只能使用财务提交的数据生成报价草稿，不能上传或维护价格表，不能设置底价、毛利或特殊折扣。
- 当前 Workbench 只使用 mock catalog，不读取真实报价表、不接数据库、不保存数据。
- 正式价格必须后续接入 `FinancePricing`，报价草稿不能直接生成正式报价或发客户。

不做：

- 不做报价页面。
- 不做报价草稿数据库模型。
- 不做产品主数据模型。
- 不做价格表模型。
- 不导入生产数据库。
- 不做 OEM 自动匹配。
- 不做图片识别。
- 不做正式报价审批。

## 领域命名

建议后续模块名：

`KJ / OEM 批量报价草稿生成器`

V1 实现范围只覆盖：

`KJ 批量报价草稿`

禁止命名为：

`自动正式报价系统`

## KJ 规范化规则

### 字段语义

```ts
type SourceCodeType =
  | "standard_kj"
  | "old_code"
  | "erp_code"
  | "fumacrm_code"
  | "unknown_code";

type NormalizedKjCode = {
  rawKjCode: string;
  standardKjCode: string;
  sourceCodeType: SourceCodeType;
};
```

### normalizeKjCode 规则

建议规则：

1. `trim` 前后空格。
2. 使用 Unicode `NFKC` 做全角 / 半角归一化。
3. 英文字母统一大写。
4. 删除无意义空格，包括普通空格、制表符和换行。
5. 中文括号、英文括号、冒号、说明性前缀不作为核心编码。
6. 保留核心字母、数字和必要连接符 `-`。
7. 连续连接符压缩为单个 `-`。
8. 去掉首尾连接符。
9. 如果原始字段中包含多个编码，只提取第一个明确 KJ 编码，其他编码进入 `alternateCodes`。

示例：

| 原始输入 | sourceCodeType | standardKjCode |
|---|---|---|
| ` KJ-80002 ` | `standard_kj` | `KJ-80002` |
| `ＫＪ－８０００２` | `standard_kj` | `KJ-80002` |
| `kj 80002` | `standard_kj` | `KJ-80002` |
| `KJ.NO: KJ-80002` | `old_code` | `KJ-80002` |
| `（ERP）KJ-80002-16A` | `erp_code` | `KJ-80002-16A` |

### sourceCodeType 判定建议

| 来源列名模式 | sourceCodeType |
|---|---|
| `KJ-编码（标准编码）`、`KJ编码`、`KJ号` | `standard_kj` |
| `旧 KJ.NO`、`原KJ.NO` | `old_code` |
| `（ERP）KJ-编码`、`ERP专用` | `erp_code` |
| `（孚盟）KJ-编码`、`旧 KJ.NO: (孚盟编码)` | `fumacrm_code` |
| 其他含 KJ 但来源不明 | `unknown_code` |

### 主 KJ 优先级

当同一行存在多个 KJ 候选字段时，建议优先级：

1. 标准编码：`standard_kj`
2. ERP 编码：`erp_code`
3. 孚盟 / CRM 编码：`fumacrm_code`
4. 旧编码：`old_code`
5. 未知编码：`unknown_code`

如果多个候选值指向不同标准 KJ，解析器不应自动选择，应输出 `ambiguous_kj`。

## Adapter / Sheet Config 结构

报价表结构差异较大，应通过配置适配每个品类，不要把列号写死在业务逻辑中。

```ts
type QuoteSourceWorkbookConfig = {
  id: string;
  category: QuoteProductCategory;
  filePattern: string;
  workbookKind: "cost_quote_table" | "packaging_addon" | "risk_reference";
  sheets: QuoteSourceSheetConfig[];
  notes?: string[];
};

type QuoteProductCategory =
  | "condenser"
  | "heater"
  | "radiator"
  | "evaporator"
  | "intercooler"
  | "water_tank"
  | "special_packaging"
  | "all_aluminum_oil_cooler";

type QuoteSourceSheetConfig = {
  id: string;
  sheetName: string;
  purpose: "primary_cost" | "not_producible" | "internal_quote_reference" | "risk_note" | "addon";
  headerRow: number;
  dataStartRow: number;
  columnMapping: QuoteColumnMapping;
  rowExtractionRule: QuoteRowExtractionRule;
  imageStrategy: QuoteImageStrategy;
  priceFieldStrategy: QuotePriceFieldStrategy;
  visibility: "sales_draft_allowed" | "internal_reference_only" | "blocked";
  notes?: string[];
};

type QuoteColumnMapping = {
  kjCode?: QuoteColumnRef;
  alternateKjCodes?: QuoteColumnRef[];
  oemCode?: QuoteColumnRef;
  productName?: QuoteColumnRef;
  vehicleModel?: QuoteColumnRef;
  categoryAttribute?: QuoteColumnRef;
  spec?: QuoteColumnRef[];
  packaging?: QuoteColumnRef[];
  quoteStatus?: QuoteColumnRef;
  internalNote?: QuoteColumnRef[];
  priceCandidates?: QuotePriceColumnRef[];
};

type QuoteColumnRef = {
  header: string;
  columnIndex?: number;
  required?: boolean;
  sourceCodeType?: SourceCodeType;
};

type QuotePriceColumnRef = QuoteColumnRef & {
  sourceType: "cost_candidate" | "quote_candidate" | "unknown";
  priceKind:
    | "export_cost"
    | "export_department_domestic_cost"
    | "packaging_addon"
    | "internal_reference"
    | "unknown";
  currencyPolicy: "explicit_column" | "config_default" | "unknown";
};

type QuoteRowExtractionRule = {
  skipEmptyKj: boolean;
  skipNotProducibleRows?: boolean;
  stopWhenConsecutiveEmptyRows?: number;
  duplicatePolicy: "emit_ambiguous" | "prefer_standard_kj" | "manual_review";
};

type QuoteImageStrategy = {
  mode: "none" | "embedded_only" | "future_product_image_library";
  exposeToDraft: boolean;
};

type QuotePriceFieldStrategy = {
  defaultPriceStatus: "not_finance_approved";
  exposeAmountToSalesDraft: boolean;
  requireFinanceReviewBeforeFormalQuote: true;
};
```

## 品类配置建议

| 品类 | 主 sheet | headerRow | dataStartRow | KJ 策略 | 图片策略 | 价格策略 |
|---|---|---:|---:|---|---|---|
| 冷凝器 | `2026年冷凝器成本核算` | 1 | 2 | 多 KJ 列，优先标准 / ERP / 孚盟 | `embedded_only` | 成本候选 |
| 暖风 | `2026年暖风成本核算` | 1 | 2 | `KJ总编码` 和多个 KJ-编码列 | `none` | 成本候选 |
| 水箱 | `2026年 水箱成本报价表` | 1 | 2 | 标准编码优先，旧编码作别名 | `embedded_only` | 成本候选，包装方案另列 |
| 蒸发器 | `2026年蒸发器成本核算` | 1 | 2 | 多 KJ 列，需冲突检查 | `none` | 成本候选 |
| 中冷器 | `2026年 中冷器成本报价表` | 1 | 2 | 标准编码优先，旧编码作别名 | `embedded_only` | 成本候选 |
| 水室 | `2026年5月水室成本报价表` | 2 | 3 | `产品KJ编码` 唯一性较好 | `none` | 左右水室成本候选 |
| 特殊包装及其他 | `2026年5月特殊包装及其他成本报价表` | 2 | 3 | 无稳定 KJ | `none` | 包装附加项候选 |
| 全铝自产机冷 | `5月自产全铝机冷报价表` | 2 | 3 | 从 `主件品名（KJ编码）` 提取 | `none` | 成本候选 |

辅助 sheet 规则：

- `不能生产`：只作为风险状态参考，不进入可报价主数据。
- `只做报价，不公布的报价表`：内部参考，默认 `visibility = "internal_reference_only"`。
- 不保质 / 漏水说明 sheet：风险备注，不应自动给客户展示。

## 报价草稿输入 DTO

```ts
type QuoteDraftInputLine = {
  rawInput: string;
  requestedCode: string;
  requestedCodeType: "kj" | "oem" | "oe" | "customer_part_no" | "unknown";
  quantity?: number;
  customerNote?: string;
};
```

说明：

- `rawInput` 保存用户原始输入。
- `requestedCode` 是解析出的主请求编码。
- V1 只处理 `requestedCodeType = "kj"`。
- `oem`、`oe` 在 V1 返回 `oem_not_supported_yet`，不做自动匹配。

## 报价草稿候选 DTO

```ts
type QuoteDraftLineCandidate = {
  lineNo: number;
  rawInput: string;

  matchStatus:
    | "matched_by_kj"
    | "kj_not_found"
    | "ambiguous_kj"
    | "matched_by_oem_candidate"
    | "oem_not_supported_yet"
    | "requires_technical_review";

  kjCode?: string;
  rawKjCode?: string;
  sourceCodeType?: SourceCodeType;

  productName?: string;
  category?: string;
  oemCodes?: string[];

  imageStatus: "available" | "missing" | "embedded_only" | "not_supported_yet";
  imageRef?: string;

  quantity?: number;
  unit?: string;

  priceStatus:
    | "candidate_cost_available"
    | "candidate_quote_available"
    | "missing"
    | "expired"
    | "requires_finance_review"
    | "not_finance_approved";

  priceCandidate?: {
    amount?: number;
    currency?: string;
    sourceFile?: string;
    sourceSheet?: string;
    sourceRow?: number;
    sourceType: "cost_candidate" | "quote_candidate" | "unknown";
  };

  warnings: string[];
};
```

命名红线：

- 不要把 `priceCandidate` 命名为 `financeApprovedPrice`。
- 不要把成本候选叫正式报价。
- 不要让销售直接拿 `priceCandidate` 发客户。

## 异常状态和人工处理提示

| 状态 | 触发条件 | 给业务员的提示 |
|---|---|---|
| `kj_not_found` | KJ 规范化后无匹配 | 未找到 KJ，请检查编码或提交人工确认。 |
| `ambiguous_kj` | 一个输入匹配多条候选 | 找到多个 KJ 候选，请人工选择。 |
| `oem_not_supported_yet` | 输入被识别为 OEM / OE | V1 暂不支持 OEM 自动匹配，请提供 KJ 或进入人工匹配。 |
| `matched_by_oem_candidate` | V2 后 OEM 命中候选 | 仅为候选匹配，需人工确认。 |
| `requires_technical_review` | 规格 / 品类 / 风险状态不明确 | 需要技术或业务经理确认产品定义。 |
| `missing_product_name` | 无产品名称或展示名无法生成 | 需要补充产品名称。 |
| `missing_image` | 无图片信息 | 草稿不带图片。 |
| `embedded_image_only` | 只有 Excel 嵌入图 | 图片未归档，不能作为稳定主图。 |
| `missing_price_candidate` | 成本候选为空 | 缺少价格候选，需人工确认。 |
| `unknown_price_type` | 价格列性质不明 | 价格字段性质不明，需财务确认。 |
| `cost_requires_finance_review` | 命中成本候选 | 疑似成本价，必须财务核价后才能正式报价。 |
| `not_producible` | 命中不能生产 sheet 或状态 | 当前 KJ 可能不能生产，不允许自动报价。 |
| `restricted_or_risk_note` | 命中限销 / 风险备注 | 存在限制或风险备注，需人工确认。 |

## 价格边界

1. 成本报价表里的价格只能进入 `priceCandidate`。
2. `priceCandidate` 不是 `FinanceApprovedPrice`。
3. 报价草稿不能直接变成正式报价。
4. 正式报价必须后续接入 `FinancePricing`。
5. `FinancePricing` 批准前，报价不能进入 `sent_to_customer`。
6. 销售不能根据成本候选自行决定底价、毛利或特殊折扣。
7. `只做报价，不公布的报价表` 默认只作为内部参考，不直接开放给销售端或客户。

这与 KingaOS 架构边界一致：销售负责客户事实和商业动作，财务负责价格事实和经营风险；报价和定价必须分开。

## 图片处理设计

V1 图片策略：

1. Excel 嵌入图片不作为稳定主图来源。
2. 如果检测到嵌入图，输出 `imageStatus = "embedded_only"`。
3. 如果没有图片，输出 `imageStatus = "missing"`。
4. 不做图片识别报价。
5. 不把 Excel 图片直接导入生产 OSS。
6. 后续需要单独建立 `KJ → 默认主图` 的产品图片库，再由技术或产品资料域维护。

## 解析流程

建议 V1 流程：

1. 读取用户输入行。
2. 解析 `requestedCodeType`。
3. 对 KJ 输入执行 `normalizeKjCode`。
4. 根据 workbook / sheet config 扫描候选主 sheet。
5. 按主 KJ 优先级匹配。
6. 如果无匹配，输出 `kj_not_found`。
7. 如果多匹配，输出 `ambiguous_kj` 和候选摘要。
8. 如果单匹配，组装 `QuoteDraftLineCandidate`。
9. 检查不能生产、限销、风险备注等辅助状态。
10. 将成本候选标记为 `not_finance_approved` / `requires_finance_review`。
11. 输出草稿候选，不写生产数据库。

## 测试计划

后续实现时至少覆盖：

1. KJ 精确匹配。
2. KJ 规范化匹配。
3. KJ 找不到。
4. KJ 重复。
5. 成本候选价格标记为 `not_finance_approved`。
6. 无图片时 `imageStatus = "missing"`。
7. Excel 嵌入图时 `imageStatus = "embedded_only"`。
8. 不支持 OEM 自动匹配时，状态为 `oem_not_supported_yet`。
9. 不把成本价输出为 `financeApprovedPrice`。
10. 不生成正式报价。
11. 不写入生产数据库。
12. 不读取未授权或被标记为不可公开的 sheet 作为销售可见信息。

## V1 实现建议顺序

1. 先做纯内存 parser，不接数据库。
2. 先支持 1 到 2 个结构较稳定的品类配置。
3. 输出 JSON 草稿候选和异常报告。
4. 用本地 fixture 测试，不使用生产报价表做仓库 fixture。
5. 完成 parser 后再讨论是否做内部页面或导入 staging。
