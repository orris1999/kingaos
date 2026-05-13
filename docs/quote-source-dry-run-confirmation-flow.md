# Quote Task 005C｜Finance dry-run 结果确认流程

日期：2026-05-13

本文件定义 Finance 报价表 dry-run 后的确认流程。它只描述结构识别结果如何判断能否进入下一步 staging 导入模型设计，不导入报价表、不写数据库、不生成报价草稿、不生成正式报价。

## 业务边界

- 报价表 / 成本表 / 价格候选数据由财务提交和维护。
- 出口部不能上传报价表，不能维护价格表，不能设置底价或毛利。
- 出口部只能在后续消费财务确认后的 staging 结果生成报价草稿。
- dry-run 只是结构识别，不代表财务确认。
- dry-run 不生成报价草稿，不生成正式报价，不自动批准价格。
- 价格候选不是财务批准价格；正式报价必须后续接 FinancePricing。

## dry-run 决策状态

```ts
type QuoteSourceDryRunDecisionStatus =
  | "ready_for_staging_design"
  | "needs_finance_table_fix"
  | "needs_adapter_fix"
  | "addon_only"
  | "blocked"
  | "manual_review_required";
```

### ready_for_staging_design

结构满足 V1 条件，可以进入后续 staging 导入模型设计。

典型条件：

- `confidence = high`
- 检测到 KJ 列
- 检测到产品名称或可展示名称列
- 检测到成本候选列或报价候选列
- 不是特殊包装及其他
- 没有阻断性 unsupported reason

注意：

- 这不表示可以直接给出口部消费。
- 这不表示价格已经被财务批准。
- 后续仍需要 staging 导入模型、财务确认和 FinancePricing 链路。

### needs_finance_table_fix

财务报价表本身需要调整。典型情况：

- 缺少 KJ 列。
- 缺少产品名称列。
- 缺少当前有效成本候选列或报价候选列。

下一步：

- 请财务补充或确认 KJ 列。
- 请财务补充或确认产品名称列。
- 请财务确认当前有效价格候选列。
- 修正后重新执行 dry-run。

### needs_adapter_fix

报价表结构可能可用，但 adapter 配置需要补充。典型情况：

- `confidence = medium` 或 `low`
- 但 dry-run 已检测到 KJ、产品名称和价格候选核心字段

下一步：

- 补充 `fileNamePattern`。
- 补充 `sheetNameHint`。
- 补充 `columnMapping` 候选列名。
- 修正 adapter 后重新执行 dry-run。

### addon_only

只能作为包装 / 附加项候选，不能作为产品标准报价表。

适用：

- 特殊包装及其他。

规则：

- 不进入产品 KJ 报价草稿 V1。
- 可在未来单独设计包装 / 附加项 staging。
- 不得当作标准产品报价行。

### blocked

存在不允许进入下一步的问题。典型情况：

- 完全无法匹配 adapter。
- 文件类型未知或不支持。
- 无法识别报价表结构。
- 存在安全风险。

下一步：

- 停止进入 staging 设计。
- 由财务确认文件和表结构。
- 由技术确认是否需要新增 adapter。

### manual_review_required

结构可能可继续，但进入下一步前需要财务 / 技术 / 产品资料人员人工确认。

典型情况：

- dry-run warning 明确提示人工确认。
- 存在限销 / 风险字段。
- 存在特殊 sheet 或复杂结构但不属于明确可进入规则。

下一步：

- 先完成人工确认。
- 确认风险字段是否影响 V1 staging。
- 确认后再决定是否进入 staging 导入模型设计。

## 决策输入

决策输入只能包含结构摘要，不包含真实价格、真实 KJ 行、真实 OEM 行或完整 Excel 内容。

```ts
type QuoteSourceDryRunDecisionInput = {
  adapterId?: string;
  category?: string;
  confidence: "high" | "medium" | "low" | "none";
  hasKjColumn: boolean;
  hasOemColumn: boolean;
  hasProductNameColumn: boolean;
  hasCostCandidateColumn: boolean;
  hasQuoteCandidateColumn: boolean;
  hasPackagingColumn: boolean;
  warnings: string[];
  unsupportedReasons: string[];
};
```

## 决策输出

```ts
type QuoteSourceDryRunDecision = {
  status: QuoteSourceDryRunDecisionStatus;
  reasons: string[];
  nextActions: string[];
  canProceedToStagingDesign: boolean;
  canBeUsedByExportDraft: boolean;
  requiresFinanceConfirmation: boolean;
  requiresAdapterUpdate: boolean;
};
```

所有 dry-run 决策都必须满足：

```ts
canBeUsedByExportDraft = false
```

原因：

1. dry-run 只是结构识别。
2. dry-run 结果尚未进入 staging。
3. dry-run 结果尚未经过财务确认。
4. dry-run 不代表可被出口部直接用于报价草稿。

## 水箱 / 中冷器处理

水箱 / 中冷器不是整个品类阻断。

如果字段齐全、adapter 匹配充分：

- `status = ready_for_staging_design`
- `requiresFinanceConfirmation = true`
- `canProceedToStagingDesign = true`
- `canBeUsedByExportDraft = false`

原因：

- 主成本表可以进入 V1 staging 设计。
- 但 V1 需要行级人工确认规则。
- 基础 KJ、多候选、旧码、鼎捷码、OEM、特殊 sheet、风险字段或包装规格不明确时，具体行必须提示人工确认。

## 特殊包装及其他处理

特殊包装及其他：

- `status = addon_only`
- 不能作为产品标准报价表。
- 不能进入产品 KJ 报价草稿 V1。
- 未来可单独设计包装 / 附加项 staging。

## 什么可以进入 staging 导入模型设计

可以进入下一步 staging 设计的前提：

1. dry-run 状态为 `ready_for_staging_design`。
2. 核心字段齐全。
3. adapter 匹配充分。
4. 财务确认价格字段含义。
5. 继续明确价格候选不是财务批准价格。

进入 staging 设计仍然不等于：

- 导入生产库。
- 给出口部直接消费。
- 生成报价草稿。
- 生成正式报价。
- 自动批准价格。

## 仍然不能做

- 不做正式报价。
- 不做自动批准价格。
- 不做销售维护价格表。
- 不做底价 / 毛利。
- 不做订单。
- 不做合同。
- 不把 dry-run 结果直接给出口部消费。
- 不绕过 FinancePricing。
