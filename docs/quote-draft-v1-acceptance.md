# Quote Draft V1｜KJ 批量报价草稿验收标准

日期：2026-05-12

本文件定义后续 `KJ 批量报价草稿` V1 的验收标准。V1 不是正式报价系统，不接订单、不接合同、不接客户信息卡、不绕过财务核价。

## 范围

V1 只验收：

- KJ 输入解析。
- KJ 规范化。
- KJ 精确匹配。
- 报价草稿候选输出。
- 异常状态和人工处理提示。
- 价格候选边界标记。

V1 数据源准入以 `docs/quote-draft-v1-source-readiness.md` 为准：

- 冷凝器、暖风、蒸发器、水室、全铝自产机冷可作为 V1 产品 KJ 草稿数据源候选。
- 水箱、中冷器主成本表可进入 V1；完整标准 KJ 唯一匹配可进入草稿，具体行级风险再触发人工确认。
- 特殊包装及其他不进入产品 KJ V1，只作为包装 / 附加项候选。

水箱 / 中冷器详细规则以 `docs/quote-draft-radiator-intercooler-rules.md` 为准：

- 主 sheet 进入 V1 主草稿候选。
- `不能生产`、`只做报价，不公布的报价表`、不保质漏水等辅助 sheet 不进入 V1 主草稿。
- `KJ-编码（标准编码）` 是 V1 标准 KJ。
- 旧 KJ.NO / 孚盟编码、鼎捷编码（带水箱盖 / 不带水箱盖）必须保留。
- 基础 KJ 多候选时不能静默选择第一行。
- OEM / OE 自动匹配暂不开放。

V1 不验收：

- OEM 自动匹配。
- 图片识别。
- 正式报价生成。
- 财务审批。
- 订单 / 合同。
- 生产数据库导入。

## 功能验收

### Source Readiness Gate

V1 草稿生成必须先执行 source readiness gate。gate 结果只用于内部草稿候选和 warnings，不代表正式报价资格：

| readiness | 品类 / 能力 | V1 行为 |
|---|---|---|
| `v1_auto_eligible` | 冷凝器、暖风、蒸发器、水室、全铝自产机冷 | 可作为 V1 产品 KJ 草稿候选，但仍提示价格候选不是财务批准价格，不能直接发客户。 |
| `v1_eligible_with_conditions` | 水箱、中冷器 | 主成本表可进入 V1；完整标准 KJ 唯一匹配可进入草稿，基础 KJ、多候选、旧码、鼎捷码、OEM、特殊 sheet、风险字段或包装规格不明确时才行级人工确认。 |
| `v1_manual_confirmation_required` | 具体行级风险 | 该行需要人工确认，不代表整个品类不能进入 V1。 |
| `addon_only` | 特殊包装及其他 | 只作为包装 / 附加项候选，不能作为产品标准报价行。 |
| `deferred` | OEM 自动匹配、Excel 嵌入图片主图、正式报价、价格审批、底价 / 毛利、自动发客户、历史日期价格列默认候选、风险 sheet 进入主草稿 | V1 暂缓；必须提示人工确认或另立任务。 |

验收要求：

1. 冷凝器、暖风、蒸发器、水室、全铝自产机冷输出 `v1Readiness = "v1_auto_eligible"`。
2. 水箱、中冷器品类输出 `v1Readiness = "v1_eligible_with_conditions"`。
3. 水箱 / 中冷器完整标准 KJ 唯一匹配时，`requiresManualConfirmation = false`，并显示可进入 V1 草稿。
4. 基础 KJ、多候选、旧码、鼎捷码、OEM、特殊 sheet、风险字段、包装规格不明确或 Excel 嵌入图时，该行 `requiresManualConfirmation = true`。
5. 特殊包装及其他输出 `v1Readiness = "addon_only"`，且不能作为 V1 产品标准报价行。
6. 未知品类输出 `deferred` 或 `requires_technical_review` warning。
7. readiness gate 不写数据库、不读取 Excel、不导入报价表、不生成正式报价。

### Finance dry-run 结果确认

Quote Task 005C 定义了 dry-run 结果进入 staging 设计前的确认流程，详见 `docs/quote-source-dry-run-confirmation-flow.md`。该流程不导入报价表、不写数据库、不生成报价草稿、不生成正式报价。

dry-run 决策状态：

| status | 含义 | V1 处理 |
|---|---|---|
| `ready_for_staging_design` | 结构满足 V1 条件，可以进入后续 staging 导入模型设计。 | 可以进入 staging 设计，但不能直接给出口部消费。 |
| `needs_finance_table_fix` | 财务报价表缺 KJ、产品名称或当前有效价格候选列。 | 财务修表后重新 dry-run。 |
| `needs_adapter_fix` | 字段齐全但 adapter 匹配置信度不足。 | 技术补充 fileNamePattern、sheetNameHint 或 columnMapping 后重新 dry-run。 |
| `addon_only` | 只能作为包装 / 附加项候选。 | 不能进入产品 KJ 报价草稿 V1。 |
| `blocked` | 无法识别结构、文件类型不支持或存在阻断问题。 | 停止进入下一步。 |
| `manual_review_required` | 结构可能可继续，但需要人工确认。 | 财务 / 技术 / 产品资料人员确认后再决定下一步。 |

验收要求：

1. `confidence = high` 且 KJ、产品名称、价格候选列齐全时，可输出 `ready_for_staging_design`。
2. 缺 KJ、缺产品名称或缺价格候选列时，必须输出 `needs_finance_table_fix`。
3. `confidence = medium` 或 `low` 但核心字段齐全时，必须输出 `needs_adapter_fix`。
4. 特殊包装及其他必须输出 `addon_only`。
5. 水箱 / 中冷器字段齐全时可以输出 `ready_for_staging_design`，但必须 `requiresFinanceConfirmation = true`。
6. 所有 dry-run 决策都必须 `canBeUsedByExportDraft = false`。
7. dry-run 决策不能包含真实价格、真实 KJ 行、真实 OEM 行或完整 Excel 内容。
8. dry-run 决策不能出现正式报价、发送客户或财务批准价状态。

1. 用户输入 `KJ-80002` 这类标准 KJ 时，系统能按规范化后的 KJ 查找候选。
2. 用户输入含前后空格、全角字符、大小写差异或无意义空格的 KJ 时，系统能归一为同一 `standardKjCode`。
3. 找到唯一 KJ 时，输出 `matchStatus = "matched_by_kj"`。
4. 找不到 KJ 时，输出 `matchStatus = "kj_not_found"`，并提示人工检查。
5. 匹配到多个候选时，输出 `matchStatus = "ambiguous_kj"`，不自动取第一条。
6. 输入被识别为 OEM / OE 时，V1 输出 `matchStatus = "oem_not_supported_yet"`。
7. 草稿行必须带来源信息：source file、sheet、row。
8. 如果命中不能生产、限销或风险备注，必须输出 warning。
9. 如果无图片，输出 `imageStatus = "missing"`。
10. 如果只有 Excel 嵌入图片，输出 `imageStatus = "embedded_only"`。
11. 水箱 / 中冷器命中时，必须输出多编码、多包装、多规格或需人工确认的 warning。
12. 特殊包装及其他不能作为产品 KJ 行输出，只能作为包装 / 附加项候选。
13. 水箱 / 中冷器命中辅助 sheet 风险时，不自动生成主报价草稿，必须提示人工确认。
14. 数量字段必须保留；数量缺失时输出 `缺少数量` warning。

## 价格边界验收

1. 成本报价表价格只能输出到 `priceCandidate`。
2. `priceCandidate.sourceType` 必须是 `cost_candidate`、`quote_candidate` 或 `unknown`。
3. 成本候选必须标记为 `priceStatus = "not_finance_approved"` 或 `requires_finance_review`。
4. 输出结构中不得出现 `financeApprovedPrice` 字段。
5. 系统不得生成 `sent_to_customer` 状态。
6. 系统不得生成正式报价号。
7. 系统不得输出毛利、底价策略或销售可自行决策的财务规则。
8. 水箱 / 中冷器的 `2026.5.11出口成本报价` 和 `2026.5.11出口部内销成本报价` 只能作为外销 / 内销成本候选。
9. 历史日期价格列不作为 V1 默认报价候选。

## 数据安全验收

1. V1 不写生产 PostgreSQL。
2. V1 不运行 Prisma migration。
3. V1 不运行 `db:seed`、bootstrap、backfill 或 cleanup apply。
4. V1 不把报价表原文件提交到 GitHub。
5. V1 不把成本价明细长表写进 docs。
6. V1 不把 Excel 图片导入生产 OSS。

## 技术验收

1. Parser 核心逻辑放在 `lib/honoa/**`，页面不拥有业务事实。
2. Workbook / sheet / column 映射通过配置驱动。
3. KJ 规范化函数必须有单元测试。
4. Sheet adapter 必须有 fixture 或 mock 测试。
5. 异常状态必须有单元测试。
6. TypeScript 类型必须明确区分：
   - `QuoteDraftLineCandidate`
   - `priceCandidate`
   - `FinanceApprovedPrice`
7. `npm run typecheck` 通过。
8. `npm run test` 通过。
9. `npm run build` 通过。

## 人工验收样例

后续 V1 实现后，用本地 dev / staging 数据测试：

1. 输入一个存在的标准 KJ，得到一个草稿候选。
2. 输入同一 KJ 的大小写 / 全角 / 空格变体，得到同一匹配。
3. 输入不存在的 KJ，得到 `kj_not_found`。
4. 输入会产生多候选的 KJ，得到 `ambiguous_kj`。
5. 输入 OEM 编号，得到 `oem_not_supported_yet`。
6. 命中成本候选时，页面或输出明确提示“需财务确认”。
7. 输出中不出现正式报价、财务批准价或发送客户状态。

## Go / No-Go

Go 条件：

- KJ 精确匹配稳定。
- 重复和缺失状态清楚。
- 价格边界清楚。
- 不写生产数据。
- V1 数据源已按 003E 准入范围确认。
- 财务已确认进入 V1 的价格字段只作为 `priceCandidate` / `costCandidate` 候选。
- 水箱 / 中冷器已按 003E-R 规则确认主 sheet、编码优先级、辅助 sheet 边界和价格日期规则。

No-Go 条件：

- 仍把成本候选误叫财务批准价。
- 仍会自动选择重复 KJ 的第一条。
- 仍会让 OEM 自动匹配生成唯一报价。
- 仍会输出正式报价或发送客户状态。
- 仍把特殊包装及其他当作产品 KJ 标准报价。
- 仍允许出口部上传或维护报价表。
