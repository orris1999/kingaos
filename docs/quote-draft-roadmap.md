# Quote Draft Roadmap｜KJ / OEM 批量报价草稿生成器路线图

日期：2026-05-12

本路线图只面向报价草稿能力，不实现正式报价、订单、合同、价格审批或财务核价。本阶段报价表只能作为数据来源候选；009A 之后允许 Finance 上传文件 metadata 入库，009C 之后可在 feature flag 开启时对已上传文件做 metadata-only 结构 dry-run，009E 之后可在独立 feature flag 开启时把 completed dry-run 确认为 staging batch metadata，但仍不导入价格行、不保存金额、不生成正式报价。

## 领域归属和数据提交边界

- 报价草稿生成动作归出口部：出口部可以基于已准备好的 KJ / 数量 / 备注生成内部草稿候选。
- 报价表、成本表和价格候选数据提交归财务部：未来真实报价表上传入口应放在 Finance / FinancePricing 域，例如文档占位路径 `/finance/quote-source-tables`。
- 出口部不能上传报价表、维护价格表、设置底价或维护毛利规则。
- Workbench 当前只使用 mock catalog，不读取真实报价表、不接数据库、不保存数据。
- Quote Task 005A 新增 Finance 侧 `/finance/quote-source-dry-run` 内部页面，只在浏览器本地读取单个 Excel 文件的结构 metadata，并复用 adapter matcher 输出 sheet、表头候选、字段映射和风险提示。
- Finance dry-run 页面不上传文件、不写数据库、不保存结果、不生成报价草稿、不生成正式报价；检测到成本 / 报价列时只显示布尔信号，不显示具体价格金额。
- Quote Task 005C 定义 Finance dry-run 结果确认流程，详见 `docs/quote-source-dry-run-confirmation-flow.md`。dry-run 结果只能进入后续 staging 导入模型设计判断，不能直接给出口部消费；所有 dry-run 决策的 `canBeUsedByExportDraft` 都必须为 `false`。
- Quote Task 006A 设计 Finance 报价表 staging 导入模型，详见 `docs/quote-source-staging-import-design.md`。staging batch / row 只表示财务确认后的草稿数据源候选，不是正式价格表；本阶段不设计具体金额字段，仍不得绕过 FinancePricing。
- Quote Task 006B 将 staging 设计落到 metadata-only Prisma schema：只新增 `QuoteSourceStagingBatch` / `QuoteSourceStagingRow` 元数据表，不保存具体金额、不新增导入动作、不生成报价草稿、不生成正式报价。
- Quote Task 006G 只设计 Finance staging confirmation 的未来页面和 action contract，详见 `docs/quote-source-staging-confirmation-ui-contract.md`。未来页面归属 Finance，不放 Admin / Export；本轮不实现 UI、API route、server action，也不新增权限 seed。
- 正式价格必须后续接入 FinancePricing，报价草稿不能绕过财务确认。

## V1｜KJ 批量报价草稿

目标：让业务员上传或粘贴一批 KJ 编号，系统生成“报价草稿候选”，供人工核对。

### V1 数据源准入范围

Quote Task 003E 已根据 003D 的脱敏 dry-run 报告锁定 V1 数据源准入范围，详见 `docs/quote-draft-v1-source-readiness.md`。

V1 产品 KJ 草稿候选优先纳入：

- 冷凝器
- 暖风
- 蒸发器
- 水室
- 全铝自产机冷

水箱和中冷器主成本表可以进入 V1；它们不是整个品类都必须人工确认。完整标准 KJ 唯一匹配时可进入草稿，只有基础 KJ、多候选、旧码、鼎捷码、OEM、特殊 sheet、风险字段、包装规格不明确或 Excel 嵌入图等具体行级风险，才显示人工确认。会议确认后的详细规则见 `docs/quote-draft-radiator-intercooler-rules.md`：

- 主 sheet 可作为 V1 KJ 草稿候选来源。
- `不能生产`、`只做报价，不公布的报价表`、不保质漏水等辅助 sheet 不进入 V1 主草稿。
- `KJ-编码（标准编码）` 是 V1 标准 KJ；旧 KJ.NO / 孚盟编码和鼎捷编码保留。
- 基础 KJ 多候选时不能静默选择第一行。
- OEM / OE 自动匹配暂不开放。
- Excel 嵌入图片不是稳定主图来源。

特殊包装及其他不进入产品 KJ 报价草稿 V1，只作为包装 / 附加项候选。

建议范围：

1. 只支持 KJ 精确匹配。
2. 只接入结构较稳定的主成本 sheet。
3. 输出字段只包含草稿信息：KJ 编号、品类、车型 / 车系、规格 / 芯体 / 纸箱信息、成本候选字段名称、包装候选信息、风险状态、来源文件 / sheet / 行号。
4. 不输出正式报价单。
5. 不输出毛利。
6. 不自动给客户发送。
7. 不进入订单或合同。

V1 必须先做的数据准备：

- 定义各品类主 sheet。
- 定义各品类主 KJ 字段优先级。
- 建立 KJ 规范化规则。
- 对重复 KJ 输出冲突候选，不自动取第一条。
- 对不能生产 / 限销 / 风险备注输出明显提醒。
- 对水箱 / 中冷器区分产品规格字段、包装 / 体积字段、价格影响字段。
- V1 默认只取财务确认的最新有效日期价格列，历史日期价格列不作为默认候选。

### V1 source readiness gate

Quote Task 004A 将 003E-R 的准入结论固化为纯 domain 规则：

- `v1_auto_eligible`：冷凝器、暖风、蒸发器、水室、全铝自产机冷。可作为 V1 产品 KJ 草稿候选，但仍必须提示“价格候选不是财务批准价格，不能直接发客户”。
- `v1_eligible_with_conditions`：水箱、中冷器。品类可进入 V1，完整标准 KJ 唯一匹配可进入草稿；基础 KJ、多候选、旧码、鼎捷码、OEM、特殊 sheet、风险字段、包装规格不明确或 Excel 嵌入图时，行级显示“需人工确认”。
- `v1_manual_confirmation_required`：具体草稿行触发行级风险时使用，不代表整个水箱 / 中冷器品类不可进入 V1。
- `addon_only`：特殊包装及其他。只能作为包装 / 附加项候选，不能作为产品标准报价行。
- `deferred`：OEM 自动匹配、Excel 嵌入图片作为稳定主图、正式报价、价格审批、底价 / 毛利、自动发客户、历史日期价格列默认候选、风险 sheet 进入主草稿。

V1 草稿生成必须先经过 readiness gate，再输出草稿候选。这个 gate 只改变内部候选状态和 warnings，不生成正式报价、不保存数据库、不自动批准价格。

### Finance dry-run confirmation flow

Quote Task 005C 将 Finance dry-run 之后的确认流程固化为纯 domain 决策：

- `ready_for_staging_design`：结构满足 V1 条件，可以进入后续 staging 导入模型设计。
- `needs_finance_table_fix`：财务报价表缺 KJ、产品名称或当前有效价格候选列，需要财务修表后重新 dry-run。
- `needs_adapter_fix`：字段看起来齐全但 adapter 匹配置信度不足，需要技术补充 `fileNamePattern`、`sheetNameHint` 或 `columnMapping`。
- `addon_only`：特殊包装及其他只能作为包装 / 附加项候选，不能进入产品 KJ 报价草稿 V1。
- `blocked`：无法识别结构、文件类型不支持或存在阻断问题，不能进入下一步。
- `manual_review_required`：结构可能可继续，但需要财务 / 技术 / 产品资料人员人工确认。

无论 dry-run 决策状态如何，当前 dry-run 结果都不能直接给出口部生成报价草稿，因为还没有 staging 导入、财务确认和 FinancePricing 链路。

### Finance quote source staging design

Quote Task 006A 将 staging 作为 dry-run 和 Export 草稿消费之间的中间层：

- `QuoteSourceStagingBatch`：记录来源文件、adapter、品类、dry-run 决策状态、财务确认状态和 warnings。
- `QuoteSourceStagingRow`：记录 KJ 候选、产品展示信息、编码来源、行级状态、visibility 和 warnings。
- `QuoteSourceStagingVisibility`：区分 `finance_only`、`export_draft_candidate`、`internal_risk_only`。

staging 的边界：

- `submittedByRole` 必须是 `finance`。
- `consumerDepartment` 可以是 `export`。
- `finance_confirmed` 只表示财务确认这份表可作为草稿数据源候选，不等于财务批准价格。
- `export_draft_candidate` 仍然不是正式报价，不包含底价 / 毛利，不包含未经授权的成本明细。
- 本阶段不设计具体金额字段，只设计 `hasCostCandidate`、`hasQuoteCandidate` 和 `priceCandidateStatus`。
- 如果未来需要保存具体金额，必须进入 FinancePricing / 权限脱敏 / 审计 / 审批设计。

Quote Task 006B 只新增 staging metadata schema：

- `QuoteSourceStagingBatch` 保存来源文件、adapter、dry-run 决策、batch 状态、财务确认信息和 warnings。
- `QuoteSourceStagingRow` 保存编码候选、产品候选信息、结构布尔值、visibility、rowStatus 和 warnings。
- 006B 不保存具体金额，不保存底价 / 毛利，不保存财务批准价格，不新增 API / server action / UI，也不导入任何报价表。

Quote Task 006G 设计未来 Finance staging confirmation 页面和 action contract：

- 页面路径草案：`/finance/quote-source-staging` 和 `/finance/quote-source-staging/[batchId]`。
- 未来权限草案：`finance.quote_source_staging.view`、`finance.quote_source_staging.confirm`、`finance.quote_source_staging.cancel`、`finance.quote_source_staging.request_fix`。
- 本轮不新增 permission seed，不运行 `db:seed`。
- 未来 confirmation action 只允许 `strict_candidate_only`，不允许把 `needs_manual_review` 自动给出口部消费。
- confirmation result 不返回具体价格、底价、毛利或财务批准价格。
- 该 contract 仍不等于正式报价，也不绕过 FinancePricing。

### Export consumes finance-confirmed staging candidates

Quote Task 008A 设计 Export 侧如何读取财务已确认的 staging 候选数据，详见 `docs/quote-draft-export-staging-consumption-design.md`。

Export 只能消费：

- `batch.status = finance_confirmed`
- `row.visibility = export_draft_candidate`
- `row.rowStatus = candidate`
- `priceCandidateStatus = cost_candidate_available` / `quote_candidate_available` / `not_finance_approved`

Export 不能消费：

- `finance_only`
- `internal_risk_only`
- `needs_manual_review`
- `addon_only`
- `blocked`
- `ignored`
- `missing`
- `requires_finance_review`
- `batch.status != finance_confirmed`

Export 看到的仍然只是脱敏候选：

- 不展示具体价格。
- 不展示底价 / 毛利。
- 不展示财务批准价格。
- `not_finance_approved` 可以作为草稿候选，但必须继续提示不是正式报价。
- 正式报价仍必须后续接 FinancePricing。

Quote Task 008B 新增 Export 侧内部 repository：`findExportQuoteDraftSourceCandidates`。该 repository 仍只读，不新增 UI / API / server action，不写 production 数据：

- 只查询 `finance_confirmed + export_draft_candidate + candidate` rows。
- 只允许 `cost_candidate_available` / `quote_candidate_available` / `not_finance_approved` 作为草稿候选状态。
- 支持按 `standardKjCode`、`baseKjCode`、`oldKjNo` 查询。
- 支持 `category`、`tradeMode` 和 `limit` 过滤，`limit` 默认 20、最大 50。
- 查询结果必须经过 008A 的暴露判断和脱敏 mapping。
- OEM 自动匹配、鼎捷编码查询、孚盟编码查询和包装附加项消费仍暂缓。

Quote Task 008C 将 `/export/quote-draft-workbench` 接入 feature-gated staging candidates 模式：

- 新增服务端 flag `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT`，缺失 / false 默认关闭。
- 不使用 `NEXT_PUBLIC_`，不自动修改 ECS `.env`。
- flag 关闭时，Workbench 仍只能使用 mock catalog。
- flag 开启时，第一版仅 `super_admin` 可以通过只读 action 查询 `finance_confirmed + export_draft_candidate + candidate` rows。
- 查询结果仍是脱敏草稿候选，不显示具体价格、底价、毛利或财务批准价格。
- Workbench 不保存输入、不保存输出、不导出 Excel / PDF、不生成报价草稿、不生成正式报价。
- OEM 自动匹配仍暂不支持。

Quote Task 008D 继续优化内部 Workbench 的输入体验和草稿候选预览：

- 支持业务员常见输入：`KJ + 数量 + 备注`，包括 `100pcs`、`100 pcs`、`*100`、`x 100`、`,` 和 `，` 等数量写法。
- 支持 `tradeMode = export_usd / domestic_cny / unknown`。
- Mock 模式继续可用；staging 模式继续受 `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT` 控制，production 默认关闭。
- 预览表格显示行号、原始输入、识别编码、数量、备注、销售模式、数据源、预览状态、KJ、产品名称、品类、价格候选状态和风险提示。
- 缺少数量、未找到、多候选、OEM 暂不支持、非财务批准价格等状态都只作为草稿预览提示。
- Workbench 仍不保存输入、不保存输出、不创建 `QuoteDraft` / `QuoteDraftLine`、不导出 Excel / PDF、不生成正式报价。
- Workbench 仍不显示具体价格、底价、毛利或财务批准价格。

Quote Task 008E 对内部 Workbench 的草稿预览 UI 和异常状态做可读性整理：

- 新增 `summarizeExportQuoteDraftPreviewLines`，把总行数、可预览、未找到、多候选、需人工确认、缺数量、OEM 暂未开放和非财务批准价格统一成 summary。
- Workbench 展示中文 preview status badge、草稿预览汇总和“待处理事项”。
- 行级 warnings 改为短 badge 展示，避免风险提示堆成大段文字。
- 待处理事项覆盖缺数量、未找到财务确认 staging 候选、多候选、OEM 暂未开放和非财务批准价格。
- Staging mode 继续受 `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT` 控制，production 默认关闭。
- Workbench 仍不保存草稿、不保存输入 / 输出、不导出 Excel / PDF、不生成正式报价、不显示具体价格、底价、毛利或财务批准价格。

Quote Task 008F 为内部 Workbench 增加 feature-gated 草稿 Excel 导出：

- 新增服务端 flag `KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL`，缺失 / false 默认关闭。
- 不使用 `NEXT_PUBLIC_`，不自动修改 ECS `.env`，production 默认关闭。
- flag 关闭时，“导出草稿 Excel”按钮 disabled，并提示 Excel 导出暂未开放。
- flag 开启后，浏览器只导出当前页面内存中的草稿预览结果，不调用 server action、不新增 API route、不上传文件、不写数据库。
- 导出文件名包含“草稿”，Excel 顶部明确标注“询价 / 报价草稿”“非正式报价”“价格候选不是财务批准价格，不能直接发客户”。
- Excel 不包含具体价格、底价、毛利、财务批准价格、正式报价状态或发送客户状态。
- Workbench 仍不保存输入 / 输出、不创建 `QuoteDraft` / `QuoteDraftLine`、不生成正式报价、不生成正式 PDF、不发客户。

Quote Task 008G 只做内部 UAT checklist 和 feature flag rollout runbook：

- 新增 `docs/quote-draft-internal-uat-checklist.md`，用于业务员内部试用前检查。
- 新增 `docs/quote-draft-feature-flag-rollout-runbook.md`，用于人工开启 / 关闭 feature flags。
- 验证 `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT` 与 `KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL` 缺失 / false 默认关闭，true 仅在 local / test 中可用。
- 验证不使用 `NEXT_PUBLIC_`，不自动修改 ECS `.env`。
- 验证草稿 Excel 包含非正式报价警示，并且不包含具体价格、底价、毛利、财务批准价格或发送客户状态。
- 008G 不新增 UI / API / schema / migration，不启用 production feature flags，不写 production 数据。

Quote Task 008J 设计并实现出口部经理只读试用边界：

- 新增服务端 flag `KINGA_ENABLE_EXPORT_MANAGER_QUOTE_DRAFT_TRIAL`，缺失 / false 默认关闭。
- 不使用 `NEXT_PUBLIC_`，不自动修改 ECS `.env`，production 默认关闭。
- `super_admin` 仍可访问 Workbench。
- `department = export` 且 `role = manager` 的出口部经理仅在该 flag 开启时可访问 Workbench。
- 出口部经理只能使用 Mock 数据和草稿 Excel 导出；`KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT` 关闭时 staging 数据源仍 disabled。
- 普通出口部业务员、普通 admin、财务普通用户、国内部用户仍不可访问。
- Workbench 仍不保存输入 / 输出，不创建 `QuoteDraft` / `QuoteDraftLine`，不导入报价表，不生成正式报价，不发客户。

Quote Task 009A 新增 Finance 报价表文件上传试点，详见 `docs/quote-source-upload-pilot.md`：

- 新增 `/finance/quote-source-upload`，仅 `super_admin` 可用。
- 文件上传到私有 OSS，数据库只保存 `QuoteSourceUpload` 文件 metadata。
- metadata 只记录文件名、大小、MIME、OSS storageKey、上传人、adapterId / category 等，不保存价格、KJ 行、OEM 行或 Excel 内容。
- 009A 不解析 Excel，不导入 rows，不生成 staging batch / rows，不生成报价草稿，不生成正式报价。
- 上传报价表不等于导入价格，不等于 `FinanceApprovedPrice`，正式报价仍必须后续接 FinancePricing。

Quote Task 009C 在 009A 的上传 metadata 基础上新增 feature-gated uploaded file dry-run：

- 新增服务端 flag `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN`，缺失 / false 默认关闭，不使用 `NEXT_PUBLIC_`。
- dry-run 从私有 OSS 读取已上传文件，只识别 workbook metadata、sheet、表头候选、adapter 匹配、mappedColumns 和 warnings。
- dry-run metadata 写回 `QuoteSourceUpload`，但只保存结构摘要，不保存具体价格、KJ 行、OEM 行或完整 Excel 内容。
- dry-run 不创建 `QuoteSourceStagingBatch` / `QuoteSourceStagingRow`，不生成报价草稿，不生成正式报价。
- production 默认关闭，后续进入 staging 仍必须单独设计导入和财务确认流程。

Quote Task 009E 在 009C 的 uploaded file dry-run metadata 基础上新增 feature-gated dry-run confirmation：

- 新增服务端 flag `KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN_CONFIRM`，缺失 / false 默认关闭，不使用 `NEXT_PUBLIC_`。
- 只允许 `super_admin` 对 `uploadStatus = uploaded`、`dryRunStatus = completed`、已有 adapter / category / summary 且尚未确认的 upload 执行确认。
- 确认只创建 `QuoteSourceStagingBatch` metadata，并在 `QuoteSourceUpload` 写入 `stagingBatchId` 和确认人 / 确认时间，防止重复确认。
- 确认不创建 `QuoteSourceStagingRow`，不读取 Excel 行，不保存具体价格、KJ 行、OEM 行，不生成报价草稿或正式报价。
- production 默认关闭，后续行级导入 / staging rows 仍必须单独设计和验收。

Quote Task 009G 补充 Finance staging batch 后续查看和 row import precheck 设计：

- `/finance/quote-source-staging/[batchId]` 明确展示当前只有 staging batch metadata，尚未导入 staging rows。
- 页面解释 `manual_review_required` 不代表失败，而是进入行级导入设计前需要人工确认 adapter、category 和 dry-run warnings。
- 新增纯 domain precheck：`precheckQuoteSourceStagingRowImport`。
- precheck 只判断是否可以进入行级导入设计，`canImportRowsNow` 永远为 `false`。
- 本轮不新增 API route、server action、Prisma schema 或 migration。
- 本轮不创建 `QuoteSourceStagingRow`，不解析 Excel 行，不保存具体价格、KJ 行、OEM 行，不生成报价草稿或正式报价。

Quote Task 009H 补充 Finance row import mapper / parser 的 local / test DB 验证：

- 第一版只支持 `condenser-cost-2026 / 冷凝器`。
- mapper 将 workbook 行数据转换为 `CreateQuoteSourceStagingRowInput[]`。
- parser 只保留脱敏 row metadata；如果读到候选价格单元格，只记录 `hasCostCandidate` / `hasQuoteCandidate`，不保存金额。
- row visibility 默认 `finance_only`，`candidate` 不等于 `export_draft_candidate`。
- 本轮不新增 API route、server action、Prisma schema 或 migration。
- 本轮不写 production，不生成报价草稿，不生成正式报价。

## V2｜KJ / OEM 混合匹配

目标：在 KJ 精确匹配稳定后，把 OEM / OE 作为候选匹配能力接入。

建议范围：

1. OEM / OE 只做候选匹配，不做自动唯一命中。
2. 一个 OEM 对多个 KJ 时，必须显示候选列表。
3. 候选列表要展示 KJ、品类、车型、规格、来源 sheet 和风险备注。
4. 业务员或经理人工选择匹配项。
5. 系统记录匹配来源和人工选择人。

V2 暂不做：

- AI 图片识别匹配。
- OEM 自动唯一承诺。
- 未审核的跨品类自动匹配。

## V3｜财务核价审批接入

目标：报价草稿经过财务确认后，才能进入正式报价链路。

建议边界：

1. 草稿生成器只产生 `QuoteDraft`。
2. 财务确认后产生 `FinanceApprovedPrice` 快照。
3. 正式报价只能引用财务批准后的快照。
4. 销售不能直接改底价、成本价或毛利规则。
5. 销售不能绕过财务批准形成正式报价。

这保持 KingaOS 长期架构边界：

- 销售负责客户事实和商业动作。
- 财务负责价格事实和经营风险。
- 技术负责产品定义。

## 明确不做

本路线图不做：

- 自动正式报价系统。
- 图片识别报价。
- OEM 自动唯一匹配承诺。
- 绕过财务审批。
- 订单。
- 合同生成。
- 客户信息卡。
- 财务价格表上传生产化。
- 底价 / 毛利 / 财务核价实现。

## 下一步建议

Quote Task 003A 已建立报价表 workbook / sheet adapter 的结构配置和 dry-run summary 类型。Quote Task 003B 进一步补充了基于 mock workbook metadata 的 adapter matcher：先用文件名、文件类型、sheet 名称和 mock 表头做结构化匹配，不读取真实 Excel、不提取价格、不写生产库。Quote Task 003C 增加本地只读 CLI，用于显式指定单个 Excel 文件并输出结构摘要，不输出真实价格明细、不写数据库、不导入报价表。Quote Task 003D 对 8 份财务报价表执行本地 dry-run 并生成脱敏结构报告。Quote Task 003E 锁定了 V1 数据源准入范围和 adapter 修正清单。Quote Task 003E-R 固化了水箱 / 中冷器的会议确认规则。Quote Task 004A 将 V1 source readiness gate 编码为纯 domain 规则。Quote Task 004B-R 修正水箱 / 中冷器口径：品类是 `v1_eligible_with_conditions`，人工确认下沉到具体草稿行。Quote Task 005A 将 dry-run 能力放到 Finance 侧浏览器本地页面，继续不上传、不入库、不展示真实价格明细。Quote Task 005C 定义 dry-run 结果确认流程，明确哪些结果可进入 staging 设计、哪些需要财务修表、哪些需要 adapter 修正、哪些只能作为附加项，以及所有 dry-run 结果都不能直接给出口部消费。Quote Task 006A 设计 staging batch / row / visibility 的纯类型草案，继续不落库、不保存具体金额、不生成报价草稿。

下一步进入 V1 开发前，仍建议先完成以下准备：

1. 在 Finance / FinancePricing 域设计未来报价表提交入口，例如 `/finance/quote-source-tables`，先只做 dry-run。
2. dry-run 只读取 Excel 结构，不导入价格，不写生产 PostgreSQL。
3. 输出 adapter 匹配、sheet 检测、表头行、字段映射、缺失字段和风险提示。
4. 出口部继续只使用 dry-run / staging 结果生成报价草稿，不维护报价表。
5. 继续不做正式报价、财务批准价格、订单或合同。
6. 按 `docs/quote-draft-v1-source-readiness.md` 的 checklist 由财务、出口部、产品资料负责人分别确认 V1 数据源、价格字段含义、KJ 标准化和图片来源策略。
