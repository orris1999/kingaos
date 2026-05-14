# KingaOS 版本更新日志

本文件记录 KingaOS 每次功能更新、修复、安全调整、数据结构变化和视觉基线调整。管理员页面 `/admin/changelog` 使用 `lib/honoa/shared/release-notes.ts` 展示同一批只读 release notes。

更新日志不使用数据库。本阶段采用文档和代码双轨维护：

- `docs/CHANGELOG.md`：给团队阅读，记录背景和规则。
- `lib/honoa/shared/release-notes.ts`：给管理员页面展示。

## 2026.05.14-04 Quote Task 009A Finance quote source upload pilot

- 类型：功能 / 数据
- 影响范围：财务部、报价表上传、OSS、Prisma schema、AuditLog
- Migration：additive
- 生产数据命令：待后续部署确认；本轮未运行 production migration
- 生产数据风险：低
- Release note id：`2026-05-14-04-finance-quote-source-upload-pilot`
- Commit：待填写

主要变化：

- 新增 `/finance/quote-source-upload` 和 Finance 首页“报价表上传” Pilot 入口，仅 `super_admin` 可访问。
- 新增 `QuoteSourceUpload` metadata-only Prisma model，用于记录上传文件名、大小、MIME、私有 OSS storageKey、上传人、adapterId / category 等信息。
- 上传文件只进入私有 OSS；数据库不保存 Excel 内容、KJ 行、OEM 行、价格、底价、毛利或财务批准价格。
- 新增上传 URL 生成和 metadata 保存 API route，并写入 `quote_source_upload.upload_url.generate` / `quote_source_upload.create` AuditLog。
- 本轮不解析 Excel、不导入价格、不创建 staging rows、不生成报价草稿、不生成正式报价。

## 2026.05.13-16 Quote Task 007C Finance staging 确认 UI wiring

- 类型：功能 / 安全
- 影响范围：财务部、报价表 staging、确认流程、feature flag
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：低
- Release note id：`2026-05-13-16-finance-staging-confirm-ui-wiring`
- Commit：待填写

主要变化：

- 新增服务端 feature flag `KINGA_ENABLE_FINANCE_STAGING_CONFIRM`，缺失或 `false` 时默认关闭，不使用 `NEXT_PUBLIC_`。
- 将 `/finance/quote-source-staging/[batchId]` 的确认区域接入 007B `confirmQuoteSourceStagingBatchAction`，但只有 feature flag 开启时才渲染可提交确认表单。
- feature flag 关闭时按钮继续 disabled，并显示“确认功能暂未开放”；ECS 默认不修改 `.env`，不启用该功能。
- 表单固定 `rowVisibilityPolicy = strict_candidate_only`，不提供 `include_manual_review` 选项；退回修正 / 取消仍 disabled。
- 继续明确 `finance_confirmed` 不等于财务批准价格，`export_draft_candidate` 仍不是正式报价。

## 2026.05.13-15 Quote Task 007B Finance staging 确认 server action

- 类型：安全 / 数据
- 影响范围：财务部、报价表 staging、确认流程、AuditLog
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：低
- Release note id：`2026-05-13-15-finance-staging-confirm-action`
- Commit：待填写

主要变化：

- 新增 `confirmQuoteSourceStagingBatchAction`，只允许 `super_admin` 调用，用于后续 Finance staging 确认流程。
- action 只允许 `strict_candidate_only`，拒绝 `include_manual_review`，不会把 `needs_manual_review` / `addon_only` / `blocked` / `ignored` 行自动给出口部消费。
- action 调用 existing staging confirmation domain，并写入 `AuditLog.action = quote_source_staging.finance_confirmed`。
- 本轮不启用 `/finance/quote-source-staging/[batchId]` 页面确认按钮，不新增 API route / Prisma schema / migration，不读取或导入报价表。
- 继续明确 `finance_confirmed` 不等于财务批准价格，`export_draft_candidate` 仍不是正式报价。

## 2026.05.13-14 Quote Task 007A Finance staging 只读页面

- 类型：功能 / UI
- 影响范围：财务部、报价表 staging、确认流程预览
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：无
- Release note id：`2026-05-13-14-finance-staging-readonly-page`
- Commit：待填写

主要变化：

- 新增 `/finance/quote-source-staging` 和 `/finance/quote-source-staging/[batchId]`，仅 `super_admin` 可访问，用于只读查看 Finance 报价表 staging 批次和行级 metadata。
- 页面展示 batch 基本信息、row 统计、出口部可消费预览、风险提示和禁用的确认 / 退回 / 取消按钮。
- 本轮不实现 server action / API route，不写数据库、不修改 batch status 或 row visibility，不展示具体金额、底价、毛利或财务批准价格字段。
- 继续明确 `finance_confirmed` 不等于财务批准价格，`export_draft_candidate` 仍不是正式报价。

## 2026.05.13-08 Quote Task 006B Finance quote source staging metadata schema

- 类型：数据 / 文档
- 影响范围：财务部、报价表 staging、报价草稿规划、Prisma schema
- Migration：additive
- 生产数据命令：未运行
- 生产数据风险：低
- Release note id：`2026-05-13-08-quote-source-staging-metadata-schema`
- Commit：待填写

主要变化：

- 新增 `QuoteSourceStagingBatch` / `QuoteSourceStagingRow` Prisma model，为未来 Finance 报价表 staging 导入保留 metadata-only 结构。
- staging metadata 只保存批次、结构识别、字段映射、行级状态、visibility 和 warnings，不保存具体金额、底价、毛利或财务批准价格。
- 新增 additive migration，仅创建 staging 表、索引和外键；不修改现有客户、附件、收款账号或用户表。
- 继续明确 `finance_confirmed` 不等于财务批准价格，`export_draft_candidate` 仍不是正式报价，正式报价必须后续接 FinancePricing。

## 2026.05.13-04 Quote Task 005A Finance 报价表 dry-run 页面

- 类型：功能 / 数据
- 影响范围：财务部、报价表 dry-run、报价草稿规划
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：无
- Release note id：`2026-05-13-04-finance-quote-source-dry-run-page`
- Commit：待填写

主要变化：

- 新增 `/finance/quote-source-dry-run`，仅 `super_admin` 可访问，用于 Finance 侧在浏览器本地选择 Excel 文件做结构识别。
- 页面复用报价表 adapter matcher，展示 sheet、表头候选、字段映射、warnings 和 submittedByRole / consumerDepartment 边界。
- 文件不上传服务器、不写数据库、不保存 dry-run 结果；检测到价格字段时只显示结构布尔信号，不显示真实价格明细。
- 页面继续强调报价表由财务提交和维护，出口部不能上传或维护价格表；dry-run 不生成报价草稿或正式报价。

## 2026.05.12-06 Quote Task 002B KJ 报价草稿 Workbench 可读性优化

- 类型：UI
- 影响范围：管理员后台、报价草稿规划、内部 mock workbench
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：无
- Release note id：`2026-05-12-06-quote-draft-workbench-readability`
- Commit：待填写

主要变化：

- 将报价草稿 workbench 的内部状态枚举显示为业务可读中文标签，例如 `KJ 已匹配`、`OEM 暂未开放`、`非财务批准价格`。
- 增加结果汇总、填入 mock 示例、清空和复制当前 mock 结果 JSON 的纯前端操作。
- 继续只使用 mock catalog，不读取真实报价表、不保存数据、不生成正式报价。

## 2026.05.12-05 Quote Task 002A KJ 报价草稿 Workbench（mock）

- 类型：功能 / UI
- 影响范围：管理员后台、报价草稿规划、内部 mock workbench
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：无
- Release note id：`2026-05-12-05-quote-draft-workbench-mock`
- Commit：待填写

主要变化：

- 新增 `/admin/quote-draft-workbench`，仅 `super_admin` 可访问，用于内部演示 KJ 报价草稿解析器。
- 页面使用 Quote Task 001C 的纯内存 parser / generator 和 mock catalog，不读取真实报价表、不保存数据。
- 页面醒目标注“不是正式报价、价格候选不是财务批准价格、不能发客户”。

## 2026.05.12-04 Quote Task 001C KJ 报价草稿解析器 dry-run 加固

- 类型：功能 / 数据
- 影响范围：报价草稿规划、KJ 输入解析、纯内存 dry-run、领域测试
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：无
- Release note id：`2026-05-12-04-quote-draft-parser-dry-run`
- Commit：待填写

主要变化：

- 增强 `parseQuoteDraftInput`，支持空格、逗号、中文逗号、`*`、`x` 等常见业务员粘贴格式。
- 增加缺少数量、数量异常、OEM 暂不支持、KJ 缺失 / 重复等更清晰的草稿 warning。
- 新增 `npm run quote-draft:dry-run`，只使用 mock 数据输出报价草稿候选，不读 Excel、不写数据库、不生成正式报价。

## 2026.05.12-03 Quote Task 001B KJ 报价草稿解析器纯内存原型

- 类型：功能 / 数据
- 影响范围：报价草稿规划、KJ 规范化、纯内存 parser、领域测试
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：无
- Release note id：`2026-05-12-03-quote-draft-parser-memory-prototype`
- Commit：待填写

主要变化：

- 新增 `lib/honoa/quote-draft/**` 纯内存 domain 原型，不接 UI、不接数据库、不导入报价表。
- 实现 KJ 规范化、批量输入解析和基于 mock catalog 的 KJ 精确匹配。
- 输出 `QuoteDraftLineCandidate`，明确 `priceCandidate` 只是价格候选，不是财务批准价格，也不会生成正式报价。

## 2026.05.12-02 Quote Task 001A KJ 报价草稿解析器技术设计

- 类型：文档 / 数据
- 影响范围：报价草稿规划、KJ 规范化、价格边界、测试验收
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：无
- Release note id：`2026-05-12-02-quote-draft-parser-design`
- Commit：待填写

主要变化：

- 新增 `docs/quote-draft-parser-design.md`，定义 KJ 规范化、 workbook / sheet adapter、报价草稿 DTO、异常状态和图片策略。
- 新增 `docs/quote-draft-v1-acceptance.md`，明确 V1 KJ 批量报价草稿验收标准。
- 更新 `docs/quote-draft-roadmap.md`，将下一步拆为纯内存 parser 原型，继续不导入生产数据库、不生成正式报价。

## 2026.05.12-01 Quote Task 000 报价表结构盘点

- 类型：文档 / 数据
- 影响范围：报价草稿规划、数据字典、架构边界
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：无
- Release note id：`2026-05-12-01-quote-draft-data-audit`
- Commit：待填写

主要变化：

- 只读盘点 8 个出口部成本报价表的 sheet、表头、字段结构和数据质量信号。
- 新增 `docs/quote-draft-data-audit.md`，记录 KJ / OEM / 成本 / 包装 / 状态等字段映射建议。
- 新增 `docs/quote-draft-roadmap.md`，明确下一阶段只做 `KJ / OEM 批量报价草稿生成器`，不做正式报价、不绕过 FinancePricing。

## 2026.05.07-13 附件字段 UI 去重与联系人页简化

- 类型：修复 / UI
- 影响范围：出口部客户档案、附件字段、联系人信息页
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：无
- Release note id：`2026-05-07-13-attachment-field-ui-dedup`
- Commit：待填写

主要变化：

- 字段型附件改为紧凑控件，默认只显示附件数量、附件列表和“上传文件 / 添加链接”入口。
- 通用客户附件区只展示没有字段归属的通用附件，避免联系人信息页重复出现完整上传表单。
- 新建客户时附件字段只提示保存后上传；客户详情页的附件字段只展示附件列表和下载 / 预览。

## 2026.05.07-12 管理员版本更新日志与 SaaS 视觉基线

- 类型：UI / 文档
- 影响范围：管理员后台、全局 UI、文档
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：无
- Commit：待填写

主要变化：

- 新增管理员只读版本更新日志页面 `/admin/changelog`。
- 管理员首页新增“版本更新日志”入口。
- 新增 `lib/honoa/shared/release-notes.ts` 供页面渲染。
- 建立每轮任务必须同步更新 changelog 的 prompt 模板。
- 建立 KingaOS 高端 B2B SaaS 视觉基线：深绿色主色、中性色背景、白色卡片、细边框、柔和阴影、统一圆角和间距。

## 2026.05.07-11 客户档案列表与表单 UI/UX 整理

- 类型：UI
- 影响范围：出口部客户档案、客户列表、客户表单
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：无
- Commit：`3df6d3b`

主要变化：

- 客户列表改为横向滚动表格，避免表头和操作逐字换行。
- 客户类型多选改为紧凑控件，选择后以标签展示。
- 新建 / 编辑客户页面整理为步骤卡片、两列基础信息布局和更清晰的只读 / 必填样式。

## 2026.05.07-10 财务账号变更影响提醒

- 类型：功能
- 影响范围：财务部收款账号管理、出口部客户档案
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：无
- Commit：`cd9600f`

主要变化：

- 财务收款账号列表和详情页显示使用客户数与有限客户摘要。
- 停用账号前提示受影响客户数量。
- 客户档案引用停用账号时显示提醒。
- 客户列表支持按默认收款方案状态筛选。

## 2026.05.07-09 字段配置增强

- 类型：功能
- 影响范围：字段配置、客户类型、附件字段
- Migration：additive
- 生产数据命令：运行 production migration
- 生产数据风险：低
- Commit：`1a55892`

主要变化：

- 字段配置新增多选、超链接和附件字段类型。
- 客户类型支持多选，旧 `Customer.customerType` 保留兼容。
- 下拉 / 多选选项支持内部说明。
- 附件字段复用 `CustomerAttachment` 和 OSS。

## 2026.05.07-08 客户字段修改历史去噪

- 类型：修复
- 影响范围：客户字段修改历史、生产数据安全
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：低
- Commit：待填写

主要变化：

- 修复 `未填写 → 未填写` 等无意义历史记录。
- 增加 dry-run 优先的历史 spam 清理脚本。
- 明确生产冒烟测试禁止修改真实客户。

## 2026.05.07-07 客户档案字段修改历史

- 类型：功能
- 影响范围：出口部客户档案、修改历史
- Migration：additive
- 生产数据命令：运行 production migration
- 生产数据风险：低
- Commit：待填写

主要变化：

- 关键系统字段、自定义字段和默认收款方案变化写入字段修改历史。
- 历史记录跟随客户查看权限，只用于内部追溯。
- 默认收款方案历史不记录完整银行账号全文。

## 2026.05.06-06 财务官方收款账号与客户默认收款方案

- 类型：功能
- 影响范围：财务部收款账号管理、出口部客户档案
- Migration：additive
- 生产数据命令：运行 production migration
- 生产数据风险：低
- Commit：待填写

主要变化：

- 财务部开放收款账号管理主数据入口。
- 客户档案可选择财务维护的默认收款方案。
- 业务员不能手填或修改银行账号明细。
- 停用账号后客户详情显示重新选择提醒。

## 2026.05.06-05 阿里云 OSS 客户附件上传

- 类型：功能
- 影响范围：客户附件、阿里云 OSS
- Migration：无
- 生产数据命令：未运行
- 生产数据风险：低
- Commit：待填写

主要变化：

- 客户附件支持私有 OSS Bucket 真实上传。
- 上传和下载 / 预览均由服务端生成短时预签名 URL。
- PostgreSQL 只保存附件元数据和 `storageKey`。

## 2026.05.06-04 客户名称防重复与重复客户审核

- 类型：数据
- 影响范围：出口部客户档案、重复客户审核
- Migration：additive
- 生产数据命令：运行 production migration
- 生产数据风险：中
- Commit：待填写

主要变化：

- 服务端规范化公司名称，阻止加点、加空格、大小写和全角半角绕过。
- 重复客户必须提交审核，通过后才允许例外建档。
- 提供历史客户 identity backfill 的 dry-run 优先脚本。

## 2026.05.06-03 国家 / 州省 / 城市联动选择

- 类型：功能
- 影响范围：出口部客户档案、地理数据
- Migration：additive
- 生产数据命令：运行 production migration
- 生产数据风险：低
- Commit：待填写

主要变化：

- 客户地址改为国家 / 地区、州 / 省、城市联动选择。
- 国家统一显示中文，地理数据通过服务端按需加载。
- 旧 `country` / `city` 字段继续兼容。

## 2026.05.06-02 多联系人、附件记录和字段类型中文化

- 类型：功能
- 影响范围：联系人、附件、字段配置
- Migration：additive
- 生产数据命令：运行 production migration
- 生产数据风险：低
- Commit：待填写

主要变化：

- 客户支持多个联系人并可设置主要联系人。
- 客户档案支持附件链接和附件元数据。
- 字段类型在 UI 中显示中文，内部枚举保持英文。

## 2026.05.05-01 客户档案 MVP

- 类型：功能
- 影响范围：管理员后台、出口部客户档案、权限
- Migration：additive
- 生产数据命令：运行 production migration
- 生产数据风险：中
- Commit：待填写

主要变化：

- 建立 KingaOS app shell、登录、用户管理和权限管理。
- 开放出口部客户档案列表、新建、详情、编辑和字段配置。
- 未开放模块保留入口并统一拦截。
