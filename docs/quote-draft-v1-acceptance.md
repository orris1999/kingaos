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

### Finance staging 数据源候选

Quote Task 006A 定义了 staging 导入模型设计，详见 `docs/quote-source-staging-import-design.md`。staging 是 dry-run 和 Export 草稿消费之间的中间层，不是正式价格表。

Quote Task 006B 将该设计落为 metadata-only Prisma schema，仅新增 `QuoteSourceStagingBatch` 和 `QuoteSourceStagingRow` 两张 staging 元数据表。006B 不导入报价表、不保存具体金额、不新增 API / server action / UI，也不生成报价草稿或正式报价。

验收要求：

1. staging batch 的 `submittedByRole` 必须是 `finance`。
2. staging batch 的 `consumerDepartment` 可以是 `export`。
3. `finance_confirmed` 只表示财务确认这份表可作为草稿数据源候选，不等于财务批准价格。
4. staging row 只保留编码、产品候选信息、状态、visibility 和 warnings。
5. staging row 本阶段不包含具体金额字段。
6. `finance_only` 只给财务 / 管理层查看。
7. `export_draft_candidate` 可以作为出口部报价草稿候选，但仍然不是正式报价。
8. `internal_risk_only` 只能作为风险提示，不能进入报价草稿行。
9. 水箱 / 中冷器完整标准 KJ 唯一匹配可以是 `candidate`；基础 KJ 多候选、旧码 / 孚盟 / 鼎捷码、OEM 或特殊 sheet 命中必须是 `needs_manual_review` 或更严格状态。
10. 特殊包装及其他只能是 `addon_only`，不能作为产品标准报价行。
11. 任何 staging 数据进入正式报价前都必须后续接 FinancePricing。
12. Prisma schema 不得在 staging row 中保存具体金额、底价、毛利、财务批准价格或可发客户状态。
13. 006B migration 必须只新增 staging metadata 表、索引和约束，不修改现有客户、附件、收款账号或用户表。

### Export 消费 Finance-confirmed staging 候选

Quote Task 008A 定义 Export 侧读取 staging 候选的 read-only contract，详见 `docs/quote-draft-export-staging-consumption-design.md`。

Quote Task 008B 新增内部 repository `findExportQuoteDraftSourceCandidates`，仍不开放 UI、API route 或 server action，不写 production 数据。repository 只返回脱敏 `ExportQuoteDraftSourceCandidate`，不返回具体价格、底价、毛利或财务批准价格。

验收要求：

1. Export 只能消费 `batch.status = finance_confirmed` 的数据。
2. Export 只能消费 `row.visibility = export_draft_candidate`。
3. Export 只能消费 `row.rowStatus = candidate`。
4. `finance_only` / `internal_risk_only` 不得给 Export 读取。
5. `needs_manual_review` / `addon_only` / `blocked` / `ignored` 不得给 Export 读取。
6. `missing` / `requires_finance_review` 价格状态不得给 Export 读取。
7. `not_finance_approved` 可以作为草稿候选，但必须显示“不是正式报价 / 不是财务批准价格”。
8. Export 看到的是脱敏候选，不包含具体价格、底价、毛利、财务批准价格或可发客户状态。
9. 水箱 / 中冷器即使可消费，也必须保留多编码、多规格、多包装人工确认 warning。
10. 特殊包装及其他不能作为产品标准报价候选。
11. V1 仍然不生成正式报价，仍然不能发客户。
12. repository 查询必须要求 `kjCode` 或 `normalizedKjCode`。
13. repository `limit` 默认 20，最大 50。
14. repository 支持 `category` / `tradeMode` 过滤。
15. repository 不支持 OEM 自动匹配。
16. 鼎捷 / 孚盟查询后续单独设计，不在 008B 静默开放。

Quote Task 008C 允许内部 Workbench 在 feature flag 开启时只读查询 finance-confirmed staging candidates。

验收要求：

1. `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT` 缺失 / false 时，staging 数据源 disabled。
2. 不使用 `NEXT_PUBLIC_`。
3. production 默认关闭，本轮不修改 ECS `.env`。
4. flag 关闭时，Workbench 仍只使用 mock catalog。
5. flag 开启时，仅 `super_admin` 可以调用只读 staging candidate action。
6. action 不写数据库、不修改 batch / row、不保存输入或输出。
7. Workbench 仍不生成报价草稿、不生成正式报价、不导出 Excel / PDF。
8. Workbench staging 模式不显示具体价格、底价、毛利、财务批准价格或可发客户状态。
9. `not_finance_approved` 只能显示为非财务批准价格的草稿候选，不能作为正式报价。
10. OEM 自动匹配仍暂不支持。

Quote Task 008D 允许内部 Workbench 生成报价草稿候选预览，但仍不保存、不导出、不生成正式报价。

验收要求：

1. Workbench 支持 `KJ + 数量 + 备注` 多行输入。
2. Workbench 支持 `100pcs`、`100 pcs`、`*100`、`x 100`、`,`、`，` 等数量写法。
3. Workbench 支持 `tradeMode = export_usd / domestic_cny / unknown`。
4. Mock 模式继续可用。
5. Staging 模式继续受 `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT` 控制，缺失 / false 默认关闭。
6. feature flag 关闭时，staging 数据源 disabled，不能调用 staging candidate action。
7. feature flag 开启时，仅 `super_admin` 可以只读查询 staging candidates。
8. 缺少数量时必须生成 `missing_quantity` warning。
9. OEM / OE 输入必须生成 `unsupported_oem`，仍不自动匹配。
10. staging 未找到时显示 `not_found`。
11. staging 多候选时显示 `multiple_candidates`，不能自动选择第一条。
12. `not_finance_approved` 必须显示“非财务批准价格，仅草稿候选”，不能作为正式报价。
13. 水箱 / 中冷器候选必须保留多编码、多规格、多包装 warning。
14. Workbench 不保存输入、不保存输出。
15. Workbench 不创建 `QuoteDraft` / `QuoteDraftLine`。
16. Workbench 不导出 Excel / PDF。
17. Workbench 不生成正式报价，仍不能发客户。
18. Workbench 不显示具体价格、底价、毛利、财务批准价格或可发客户状态。

Quote Task 008E 整理内部 Workbench 的草稿预览 UI 和异常状态。

验收要求：

1. `summarizeExportQuoteDraftPreviewLines` 必须统计总行数。
2. summary 必须统计可生成草稿预览。
3. summary 必须统计未找到候选。
4. summary 必须统计多候选。
5. summary 必须统计需人工确认。
6. summary 必须统计缺少数量。
7. summary 必须统计 OEM 暂未开放。
8. summary 必须统计非财务批准价格。
9. Workbench 必须显示中文 preview status badge。
10. Workbench 必须显示结果汇总。
11. Workbench 必须显示待处理事项。
12. 行级 warnings 应以短 badge 或短句列表展示，不能堆成一大段。
13. feature flag 关闭时，staging 数据源 disabled，不能调用 staging candidate action。
14. Workbench 仍不保存输入、不保存输出。
15. Workbench 仍不创建 `QuoteDraft` / `QuoteDraftLine`。
16. Workbench 仍不导出 Excel / PDF。
17. Workbench 仍不生成正式报价，仍不能发客户。
18. Workbench 仍不显示具体价格、底价、毛利、财务批准价格或可发客户状态。

Quote Task 008F 允许内部 Workbench 在 feature flag 开启时导出当前页面草稿预览 Excel，但仍不是正式报价。

验收要求：

1. `KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL` 缺失 / false 时，导出按钮 disabled。
2. 不使用 `NEXT_PUBLIC_`。
3. production 默认关闭，本轮不修改 ECS `.env`。
4. flag 关闭时，页面显示“Excel 导出暂未开放”，不能触发导出。
5. flag 开启且已有 preview lines 时，可以浏览器本地生成草稿 Excel。
6. 没有 preview lines 时不能导出。
7. Excel 文件名必须包含“草稿”。
8. Excel 顶部必须包含“非正式报价”。
9. Excel 顶部必须包含“价格候选不是财务批准价格，不能直接发客户”。
10. Excel 只能导出当前页面预览结果。
11. Excel 不包含具体价格、底价、毛利、财务批准价格、正式报价状态或发送客户状态。
12. 导出不调用 server action。
13. 导出不新增 API route。
14. 导出不上传文件、不写数据库、不保存输入或输出。
15. Workbench 仍不创建 `QuoteDraft` / `QuoteDraftLine`。
16. Workbench 仍不生成正式报价、不生成正式 PDF、不能发客户。

Quote Task 008G 验收内部 UAT checklist 和 feature flag rollout runbook，不新增正式业务能力。

验收要求：

1. 必须新增内部 UAT checklist。
2. 必须新增 feature flag rollout runbook。
3. `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT` 缺失时默认 false。
4. `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=false` 时 false。
5. `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=true` 时 true。
6. `KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL` 缺失时默认 false。
7. `KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL=false` 时 false。
8. `KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL=true` 时 true。
9. 不使用 `NEXT_PUBLIC_`。
10. 不修改 ECS `.env`。
11. Mock preview 可以构建草稿 Excel rows。
12. Staging preview 可以用 local / test 脱敏 fixture 验证草稿候选 warning。
13. Excel 草稿必须包含非正式报价警示。
14. Excel 草稿必须包含价格候选不是财务批准价格的警示。
15. Excel 草稿不得包含具体价格、底价、毛利、财务批准价格、正式报价或发送客户状态。
16. 页面不得保存数据。
17. 页面不得新增 API route。
18. 不得新增 Prisma schema / migration。
19. 不得读取真实 Excel。
20. 不得导入报价表。
21. 不得写 production 数据。

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
