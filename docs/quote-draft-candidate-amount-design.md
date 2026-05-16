# Quote Task 009M｜Candidate Amount Design For Real Staging Quote Draft

日期：2026-05-15

本文件只设计“候选金额”如何进入后续 staging / quote draft preview。009M 不读取真实报价表，不解析真实 Excel 金额，不保存金额，不新增 Prisma schema / migration，不生成 `QuoteDraft` / `QuoteDraftLine`，不生成正式报价。

## 业务边界

1. 5 月报价表价格可以作为有效候选价格来源。
2. 候选金额不是 `FinanceApprovedPrice`。
3. 候选金额不是正式报价。
4. 候选金额不能直接发客户。
5. 出口部不能上传报价表，也不能维护价格表。
6. 出口部不能决定底价、毛利或财务批准价格。
7. 正式报价必须后续接 FinancePricing / 财务审批 / 价格快照。
8. `finance_approved` 之前，正式 Quotation 不能发客户。

报价动作和价格决策必须分开：销售侧可以生成询价 / 报价草稿，但价格事实、底价、毛利、正式批准价必须归 FinancePricing / 财务审批 / 价格快照。

## 候选金额不是正式价格

`candidateAmount` 只表示“从财务报价表 / staging / 财务复核流程中识别到一个可讨论的金额候选”。它不表示：

1. `FinanceApprovedPrice`。
2. `approvedPrice`。
3. `officialQuote`。
4. `sentToCustomer`。
5. 可以跳过 FinancePricing。
6. 可以由出口部维护或修改。

009M 的 domain type 固定：

```ts
type QuoteCandidateAmountPolicy = {
  tradeMode: "export_usd" | "domestic_cny" | "unknown";
  source: "finance_quote_source_staging" | "manual_finance_review" | "future_finance_pricing";
  visibility: "finance_only" | "export_draft_visible" | "masked_for_export";
  status: "candidate_available" | "missing" | "requires_finance_review" | "not_finance_approved";
  currency?: "USD" | "CNY";
  isFinanceApprovedPrice: false;
  canBeSentToCustomer: false;
  requiresFinancePricing: true;
  warnings: string[];
};
```

注意：该类型不定义具体金额字段，不定义 `amount`、`unitPrice`、`costPrice`、`quotePrice`、`financeApprovedPrice`、`approvedPrice`、`officialQuote` 或 `sentToCustomer`。

## 外销 / 内销候选列规则

### `export_usd`

外销 / 境外收美金 / 有退税场景使用：

```text
2026.5.11出口成本报价
```

该列只作为外销 USD 候选金额来源：

1. 币种：`USD`。
2. 状态默认：`candidate_available`。
3. 不是 `FinanceApprovedPrice`。
4. 不是正式报价。
5. 不能直接发客户。
6. 后续仍必须进入 FinancePricing / 财务审批。

### `domestic_cny`

内销 / 收人民币场景使用：

```text
2026.5.11出口部内销成本报价
```

该列只作为内销 CNY 候选金额来源：

1. 币种：`CNY`。
2. 状态默认：`candidate_available`。
3. 不是 `FinanceApprovedPrice`。
4. 不是正式报价。
5. 不能直接发客户。
6. 后续仍必须进入 FinancePricing / 财务审批。

### `unknown`

`unknown` 不自动选择金额候选：

1. 不自动选外销候选列。
2. 不自动选内销候选列。
3. 不返回币种。
4. 状态为 `requires_finance_review`。
5. 页面应提示选择外销 USD 或内销 CNY。

历史日期列不进入默认候选。后续如果需要历史价格对比，必须单独设计来源列、版本、可见性、审计和财务确认规则。

## 权限与脱敏规则

### `finance_only`

财务 / `super_admin` 可见完整候选金额。出口部不可见。

适用：

1. 刚从报价表解析出来但尚未确认可展示的候选金额。
2. 有风险 warning 的金额候选。
3. 需要财务复核来源列或币种的候选金额。

### `masked_for_export`

出口部只看到：

1. 有候选金额。
2. 币种。
3. 需要财务确认。
4. 非正式报价 warning。

出口部看不到具体金额。该模式用于让销售知道“财务数据存在，但还不能展示金额”。

### `export_draft_visible`

后续可以给出口部在草稿中看到候选金额，但必须同时显示强警示：

1. 非正式报价。
2. 不是财务批准价格。
3. 不能直接发客户。
4. 需要后续 FinancePricing / 财务确认。

`export_draft_visible` 仍然不是正式报价，也不能跳过正式报价审批。

## 未来保存候选金额时必须记录

如果未来进入金额入库，必须新增独立 schema / migration / 审计设计，并至少记录：

1. `sourceUploadId`
2. `stagingBatchId`
3. `stagingRowId`
4. `sourceColumnName`
5. `sourceColumnDate`
6. `tradeMode`
7. `currency`
8. `amountVisibility`
9. `confirmedByFinanceUserId`
10. `confirmedAt`
11. `auditLogId`

009M 不实现这些字段。

## 未来 AuditLog action

候选金额进入系统后，建议使用独立 AuditLog action：

1. `quote_candidate_amount.imported`
2. `quote_candidate_amount.visibility_changed`
3. `quote_candidate_amount.export_visible_enabled`
4. `quote_candidate_amount.finance_review_required`

AuditLog metadata 不得包含底价、毛利、完整 Excel 行、signed URL、AccessKey 或数据库连接串。

## 与 009L 的关系

009L 已证明 Export Workbench 能只读消费真实 `finance_confirmed + export_draft_candidate` staging rows，并生成不带金额的草稿预览 / 草稿 Excel。

009M 只定义下一步金额候选的边界：

1. 不改变 009L 的 no-price UAT 结果。
2. 不把金额写入当前 staging rows。
3. 不把金额加到 Excel。
4. 不保存 `QuoteDraft` / `QuoteDraftLine`。
5. 不生成正式报价。

## 后续阶段建议

下一阶段如要实现金额候选，建议拆成独立任务：

1. Finance-only amount import design：只在 local/test 验证候选金额解析，不给出口部看。
2. Amount storage migration：独立 schema，先做加法迁移和生产备份。
3. Finance amount review UAT：财务确认来源列、币种和可见性。
4. Masked export UAT：出口部只看到“有候选金额 / 币种 / 需确认”。
5. Export draft visible UAT：在强警示下展示候选金额，但仍不生成正式报价。
6. FinancePricing design：正式价格事实和可发客户报价必须在这里完成。

## Quote Task 009N storage schema

009N 只建立候选金额 storage schema，不导入真实金额，不读取真实 Excel，不把金额展示给出口部。

新增独立 Prisma model：

```text
QuoteCandidateAmount
```

设计规则：

1. 使用独立表，不把金额字段塞进 `QuoteSourceStagingRow`。
2. 使用 `stagingBatchId`、`stagingRowId` 和可选 `sourceUploadId` 记录来源链路。
3. 使用 `sourceColumnName` 和 `sourceColumnDate` 记录未来来源列，但本轮不写真实来源列数据。
4. 使用 `candidateValue` 存储候选值；该字段不是 `costPrice`、不是 `quotePrice`、不是正式报价字段。
5. 默认 `visibility = finance_only`。
6. 默认 `status = not_finance_approved`。
7. 默认 `isFinanceApprovedPrice = false`。
8. 默认 `canBeSentToCustomer = false`。
9. 默认 `requiresFinancePricing = true`。

009N 不新增 API route、server action、UI 页面或导入脚本。后续如果要导入真实候选金额，必须单独做 feature-gated action、权限、AuditLog 和 UAT。

## Quote Task 009O local/test importer

009O 新增候选金额 importer 和 repository，但只允许 local/test DB 写入。本轮不读取真实 Excel，不导入 production，不开放 API route / server action / UI 页面，不让出口部看到金额。

第一版只支持：

1. `adapterId = condenser-cost-2026`
2. `category = 冷凝器`

来源列规则：

| tradeMode | sourceColumnName | sourceColumnDate | currency |
|---|---|---|---|
| `export_usd` | `2026.5.11出口成本报价` | `2026.5.11` | `USD` |
| `domestic_cny` | `2026.5.11出口部内销成本报价` | `2026.5.11` | `CNY` |
| `unknown` | 不自动选择 | 不自动选择 | 不自动选择 |

009O 明确不导入 `2026.4.10` 等历史日期列作为默认候选。

写入 `QuoteCandidateAmount` 时仍固定边界：

1. `visibility = finance_only`
2. `status = not_finance_approved`
3. `source = finance_quote_source_staging`
4. `isFinanceApprovedPrice = false`
5. `canBeSentToCustomer = false`
6. `requiresFinancePricing = true`

repository 写入必须通过 local/test guard：

1. `NODE_ENV=production` 拒绝。
2. production-like / RDS URL 拒绝。
3. 数据库名必须包含 dev / test / verify / local。
4. 同一个 `stagingRowId + tradeMode + sourceColumnName + sourceColumnDate` 不允许重复导入。

009O 不写真实 AuditLog。后续 production 导入必须单独接 `quote_candidate_amount.imported`，且 metadata 只能包含 batch / row / source column / tradeMode / currency / visibility / status 等脱敏字段，不得包含 `candidateValue`、底价、毛利或完整 Excel 行。

## Quote Task 009P local/test import action

009P 新增 feature-gated candidate amount import action / route，但 production 默认关闭。本轮只在 local/test DB 验证，不写 production 数据，不新增 UI，不让出口部看到金额。

Feature flag：

```text
KINGA_ENABLE_FINANCE_QUOTE_CANDIDATE_AMOUNT_IMPORT=false
```

规则：

1. 缺失或非 `true` 时默认关闭。
2. 只允许 `super_admin` 调用。
3. 第一版只支持 `condenser-cost-2026 / 冷凝器`。
4. 只处理 `finance_confirmed` batch。
5. 只处理 `export_draft_candidate` 且 `rowStatus=candidate` 的 rows。
6. `needs_manual_review` rows 不导入候选金额。
7. `export_usd` 导入 USD 候选金额，来源列仍是 `2026.5.11出口成本报价`。
8. `domestic_cny` 导入 CNY 候选金额，来源列仍是 `2026.5.11出口部内销成本报价`。
9. `unknown` 不导入金额。
10. `2026.4.10` 等旧日期列不导入。

action result 和 AuditLog metadata 只返回脱敏统计，不返回 `candidateValue`，也不返回 `costPrice`、`quotePrice`、`unitPrice`、`amount`、`financeApprovedPrice`、底价、毛利、完整 Excel 行、signed URL 或 AccessKey。

009P 仍固定：

1. `QuoteCandidateAmount.visibility = finance_only`
2. `QuoteCandidateAmount.status = not_finance_approved`
3. `isFinanceApprovedPrice = false`
4. `canBeSentToCustomer = false`
5. `requiresFinancePricing = true`

009P 不生成 `QuoteDraft` / `QuoteDraftLine`，不生成正式报价。production 导入需要 009Q 单独做受控 production write path 和 UAT。

## Quote Task 009Q controlled production guard

009Q 只修复 / 确认 candidate amount import 的受控 production 写入通道，不执行 production import，不启用 production feature flag。

production candidate amount import 必须走 controlled path：

1. repository 默认 production guard 保留，缺少 controlled option 时仍拒绝 production 写入。
2. controlled option 必须显式传入 `productionWriteReason = finance_quote_candidate_amount_import_uat`。
3. 只有 `quote-candidate-amount-import` action 可以传入该 option。
4. action 必须先完成 feature flag、`super_admin`、`finance_confirmed` batch、`export_draft_candidate` rows、upload/storageKey、tradeMode 和 importer 输出校验。
5. `unknown` 不允许进入 production import。
6. repository 写入前再次复核 `visibility = finance_only`、`status = not_finance_approved`、`isFinanceApprovedPrice = false`、`canBeSentToCustomer = false`、`requiresFinancePricing = true`。

AuditLog `quote_candidate_amount.imported` 只允许写脱敏统计，不得包含 `candidateValue`、真实金额、底价、毛利、完整 Excel 行、signed URL 或 AccessKey。

009Q 不生成 `QuoteDraft` / `QuoteDraftLine`，不生成正式报价。真正 production UAT 留到 009R。
