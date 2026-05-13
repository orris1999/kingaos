export type ReleaseNoteCategory = "feature" | "fix" | "ui" | "security" | "data" | "docs";

export type ReleaseNote = {
  id: string;
  date: string;
  version: string;
  title: string;
  category: ReleaseNoteCategory;
  summary: string[];
  affectedAreas: string[];
  migration: "none" | "additive" | "destructive";
  productionDataCommand: "none" | "migration" | "seed" | "manual-data-script" | "other";
  productionDataRisk: "none" | "low" | "medium" | "high";
  commitHash?: string;
};

export const RELEASE_CATEGORY_LABELS: Record<ReleaseNoteCategory, string> = {
  feature: "功能",
  fix: "修复",
  ui: "UI",
  security: "安全",
  data: "数据",
  docs: "文档"
};

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    id: "2026-05-13-16-finance-staging-confirm-ui-wiring",
    date: "2026-05-13",
    version: "2026.05.13-16",
    title: "Quote Task 007C Finance staging 确认 UI wiring",
    category: "security",
    summary: [
      "新增服务端 feature flag KINGA_ENABLE_FINANCE_STAGING_CONFIRM，缺失或 false 时默认关闭，不使用 NEXT_PUBLIC_。",
      "将 /finance/quote-source-staging/[batchId] 的确认区域接入 007B confirm action，但只有 feature flag 开启时才渲染可提交确认表单。",
      "确认表单固定 strict_candidate_only，不提供 include_manual_review；退回修正 / 取消仍 disabled，ECS 默认不启用该功能。"
    ],
    affectedAreas: ["财务部", "报价表 staging", "确认流程", "feature flag"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "low",
    commitHash: "待填写"
  },
  {
    id: "2026-05-13-15-finance-staging-confirm-action",
    date: "2026-05-13",
    version: "2026.05.13-15",
    title: "Quote Task 007B Finance staging 确认 server action",
    category: "security",
    summary: [
      "新增 super_admin-only 的 confirmQuoteSourceStagingBatchAction，为后续 Finance staging 确认流程提供服务端写入动作。",
      "action 只允许 strict_candidate_only，拒绝 include_manual_review，不会把 needs_manual_review / addon_only / blocked / ignored 行自动给出口部消费。",
      "确认动作写入 quote_source_staging.finance_confirmed AuditLog；页面按钮仍未启用，不新增 API route / Prisma schema / migration，也不读取或导入报价表。"
    ],
    affectedAreas: ["财务部", "报价表 staging", "确认流程", "AuditLog"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "low",
    commitHash: "待填写"
  },
  {
    id: "2026-05-13-14-finance-staging-readonly-page",
    date: "2026-05-13",
    version: "2026.05.13-14",
    title: "Quote Task 007A Finance staging 只读页面",
    category: "feature",
    summary: [
      "新增 super_admin-only 的 /finance/quote-source-staging 和 /finance/quote-source-staging/[batchId]，用于只读查看 Finance 报价表 staging 批次和行级 metadata。",
      "页面展示 batch 基本信息、row 统计、出口部可消费预览、风险提示，以及禁用的确认 / 退回 / 取消按钮。",
      "本轮不实现 server action / API route，不写数据库、不修改 batch status 或 row visibility，不展示具体金额、底价、毛利或财务批准价格字段。"
    ],
    affectedAreas: ["财务部", "报价表 staging", "确认流程预览"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "none",
    commitHash: "待填写"
  },
  {
    id: "2026-05-13-08-quote-source-staging-metadata-schema",
    date: "2026-05-13",
    version: "2026.05.13-08",
    title: "Quote Task 006B Finance quote source staging metadata schema",
    category: "data",
    summary: [
      "新增 QuoteSourceStagingBatch / QuoteSourceStagingRow Prisma model，为未来 Finance 报价表 staging 导入保留 metadata-only 结构。",
      "staging metadata 只保存批次、结构识别、字段映射、行级状态、visibility 和 warnings，不保存具体金额、底价、毛利或财务批准价格。",
      "新增 additive migration，仅创建 staging 表、索引和外键；继续明确 finance_confirmed 不等于财务批准价格，export_draft_candidate 仍不是正式报价。"
    ],
    affectedAreas: ["财务部", "报价表 staging", "报价草稿规划", "Prisma schema"],
    migration: "additive",
    productionDataCommand: "none",
    productionDataRisk: "low",
    commitHash: "待填写"
  },
  {
    id: "2026-05-13-04-finance-quote-source-dry-run-page",
    date: "2026-05-13",
    version: "2026.05.13-04",
    title: "Quote Task 005A Finance 报价表 dry-run 页面",
    category: "feature",
    summary: [
      "新增 super_admin-only 的 /finance/quote-source-dry-run，用于 Finance 侧在浏览器本地识别 Excel 报价表结构。",
      "页面复用报价表 adapter matcher，展示 sheet、表头候选、字段映射、warnings 和 finance / export 边界。",
      "文件不上传服务器、不写数据库、不保存结果；检测到价格字段时只显示结构信号，不显示真实价格明细，也不生成报价草稿或正式报价。"
    ],
    affectedAreas: ["财务部", "报价表 dry-run", "报价草稿规划"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "none",
    commitHash: "待填写"
  },
  {
    id: "2026-05-12-06-quote-draft-workbench-readability",
    date: "2026-05-12",
    version: "2026.05.12-06",
    title: "Quote Task 002B KJ 报价草稿 Workbench 可读性优化",
    category: "ui",
    summary: [
      "将报价草稿 workbench 的内部状态枚举显示为业务可读中文标签。",
      "增加结果汇总、填入 mock 示例、清空和复制当前 mock 结果 JSON 的纯前端操作。",
      "继续只使用 mock catalog，不读取真实报价表、不保存数据、不生成正式报价。"
    ],
    affectedAreas: ["管理员后台", "报价草稿规划", "内部 mock workbench"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "none",
    commitHash: "待填写"
  },
  {
    id: "2026-05-12-05-quote-draft-workbench-mock",
    date: "2026-05-12",
    version: "2026.05.12-05",
    title: "Quote Task 002A KJ 报价草稿 Workbench（mock）",
    category: "feature",
    summary: [
      "新增 super_admin-only 的 /admin/quote-draft-workbench 内部页面。",
      "页面复用纯内存 parser / generator 和 mock catalog，不读取真实报价表、不保存数据。",
      "醒目标注结果只是报价草稿，不是正式报价，价格候选不是财务批准价格。"
    ],
    affectedAreas: ["管理员后台", "报价草稿规划", "内部 mock workbench"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "none",
    commitHash: "待填写"
  },
  {
    id: "2026-05-12-04-quote-draft-parser-dry-run",
    date: "2026-05-12",
    version: "2026.05.12-04",
    title: "Quote Task 001C KJ 报价草稿解析器 dry-run 加固",
    category: "feature",
    summary: [
      "增强 KJ 批量输入解析，支持空格、逗号、中文逗号、* 和 x 等常见粘贴格式。",
      "补充缺少数量、数量异常、OEM 暂不支持、KJ 缺失 / 重复等业务 warning。",
      "新增 quote-draft dry-run 脚本，只使用 mock 数据输出草稿候选，不读 Excel、不写数据库。"
    ],
    affectedAreas: ["报价草稿规划", "KJ 输入解析", "纯内存 dry-run", "领域测试"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "none",
    commitHash: "待填写"
  },
  {
    id: "2026-05-12-03-quote-draft-parser-memory-prototype",
    date: "2026-05-12",
    version: "2026.05.12-03",
    title: "Quote Task 001B KJ 报价草稿解析器纯内存原型",
    category: "feature",
    summary: [
      "新增 lib/honoa/quote-draft 纯内存 domain 原型，不接 UI / DB。",
      "实现 KJ 规范化、批量输入解析和 mock catalog KJ 精确匹配。",
      "输出 QuoteDraftLineCandidate，并把成本候选标记为非财务批准价格。"
    ],
    affectedAreas: ["报价草稿规划", "KJ 规范化", "纯内存 parser", "领域测试"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "none",
    commitHash: "待填写"
  },
  {
    id: "2026-05-12-02-quote-draft-parser-design",
    date: "2026-05-12",
    version: "2026.05.12-02",
    title: "Quote Task 001A KJ 报价草稿解析器技术设计",
    category: "docs",
    summary: [
      "定义 KJ 规范化规则、sourceCodeType 和主 KJ 字段优先级。",
      "设计 workbook / sheet adapter、报价草稿输入和候选 DTO、异常状态与人工处理提示。",
      "明确 priceCandidate 不是 FinanceApprovedPrice，V1 不生成正式报价、不导入生产数据库。"
    ],
    affectedAreas: ["报价草稿规划", "KJ 规范化", "价格边界", "测试验收"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "none",
    commitHash: "待填写"
  },
  {
    id: "2026-05-12-01-quote-draft-data-audit",
    date: "2026-05-12",
    version: "2026.05.12-01",
    title: "Quote Task 000 报价表结构盘点",
    category: "docs",
    summary: [
      "只读盘点 8 个出口部成本报价表的 sheet、表头、字段结构和数据质量信号。",
      "新增报价草稿数据字典，整理 KJ / OEM / 成本 / 包装 / 状态等字段映射建议。",
      "明确下一阶段只做 KJ / OEM 批量报价草稿生成器，不做正式报价、不绕过 FinancePricing。"
    ],
    affectedAreas: ["报价草稿规划", "数据字典", "架构边界"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "none",
    commitHash: "待填写"
  },
  {
    id: "2026-05-07-13-attachment-field-ui-dedup",
    date: "2026-05-07",
    version: "2026.05.07-13",
    title: "附件字段 UI 去重与联系人页简化",
    category: "fix",
    summary: [
      "字段型附件改为紧凑控件，默认只显示附件数量、列表和上传 / 添加链接入口。",
      "通用客户附件区过滤字段附件，避免联系人信息页重复出现完整上传表单。",
      "新建客户时附件字段只提示保存后上传，详情页只显示附件列表和下载 / 预览。"
    ],
    affectedAreas: ["出口部客户档案", "附件字段", "联系人信息页"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "none",
    commitHash: "待填写"
  },
  {
    id: "2026-05-07-12-admin-changelog-saas-visual-baseline",
    date: "2026-05-07",
    version: "2026.05.07-12",
    title: "管理员版本更新日志与 KingaOS SaaS 视觉基线",
    category: "ui",
    summary: [
      "新增管理员只读版本更新日志页面。",
      "建立每轮任务必须更新 CHANGELOG 和 release notes 的执行规则。",
      "统一深绿色、中性色、白色卡片、细边框、柔和阴影的 B2B SaaS 视觉基线。"
    ],
    affectedAreas: ["管理员后台", "文档", "全局 UI"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "none",
    commitHash: "待填写"
  },
  {
    id: "2026-05-07-11-customer-archive-ui-form-layout",
    date: "2026-05-07",
    version: "2026.05.07-11",
    title: "客户档案列表与表单 UI/UX 整理",
    category: "ui",
    summary: [
      "客户列表改为横向滚动表格，避免列名和操作逐字换行。",
      "客户类型多选改为紧凑控件并以标签展示。",
      "新建 / 编辑客户页面整理为步骤卡片、两列基础信息布局和更清晰的只读 / 必填样式。"
    ],
    affectedAreas: ["出口部客户档案", "客户列表", "客户表单"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "none",
    commitHash: "3df6d3b"
  },
  {
    id: "2026-05-07-10-receipt-account-impact-reminders",
    date: "2026-05-07",
    version: "2026.05.07-10",
    title: "财务账号变更影响提醒",
    category: "feature",
    summary: [
      "财务收款账号列表和详情页显示使用客户数与有限客户摘要。",
      "停用账号前提示受影响客户数量，客户档案引用停用账号时显示提醒。",
      "客户列表支持按默认收款方案状态筛选。"
    ],
    affectedAreas: ["财务部收款账号管理", "出口部客户档案"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "none",
    commitHash: "cd9600f"
  },
  {
    id: "2026-05-07-09-field-type-enhancements",
    date: "2026-05-07",
    version: "2026.05.07-09",
    title: "字段配置增强：多选 / 超链接 / 附件 / 内部说明",
    category: "feature",
    summary: [
      "字段配置新增多选、超链接和附件字段类型。",
      "客户类型支持多选并兼容旧单值 customerType。",
      "下拉 / 多选选项支持内部说明，附件字段复用 CustomerAttachment 与 OSS。"
    ],
    affectedAreas: ["出口部客户档案", "字段配置", "附件"],
    migration: "additive",
    productionDataCommand: "migration",
    productionDataRisk: "low",
    commitHash: "1a55892"
  },
  {
    id: "2026-05-07-08-history-spam-filter",
    date: "2026-05-07",
    version: "2026.05.07-08",
    title: "客户字段修改历史去噪",
    category: "fix",
    summary: [
      "修复未填写到未填写、空值到空值等无意义历史记录。",
      "增加 dry-run 优先的历史 spam 清理脚本。",
      "生产冒烟测试明确禁止修改真实客户。"
    ],
    affectedAreas: ["出口部客户档案", "修改历史", "生产数据安全"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "low",
    commitHash: "待填写"
  },
  {
    id: "2026-05-07-07-customer-field-history",
    date: "2026-05-07",
    version: "2026.05.07-07",
    title: "客户档案字段修改历史",
    category: "feature",
    summary: [
      "关键系统字段、自定义字段和默认收款方案变化写入字段修改历史。",
      "历史记录跟随客户查看权限，只用于内部追溯。",
      "默认收款方案历史不记录完整银行账号全文。"
    ],
    affectedAreas: ["出口部客户档案", "修改历史"],
    migration: "additive",
    productionDataCommand: "migration",
    productionDataRisk: "low",
    commitHash: "待填写"
  },
  {
    id: "2026-05-06-06-finance-receipt-accounts",
    date: "2026-05-06",
    version: "2026.05.06-06",
    title: "财务官方收款账号与客户默认收款方案",
    category: "feature",
    summary: [
      "财务部开放收款账号管理主数据入口。",
      "客户档案可选择财务维护的默认收款方案，业务员不能手填银行账号。",
      "停用账号后客户详情显示重新选择提醒。"
    ],
    affectedAreas: ["财务部收款账号管理", "出口部客户档案"],
    migration: "additive",
    productionDataCommand: "migration",
    productionDataRisk: "low",
    commitHash: "待填写"
  },
  {
    id: "2026-05-06-05-oss-attachments",
    date: "2026-05-06",
    version: "2026.05.06-05",
    title: "阿里云 OSS 客户附件上传",
    category: "feature",
    summary: [
      "客户附件支持私有 OSS Bucket 真实上传。",
      "上传和下载 / 预览均由服务端生成短时预签名 URL。",
      "PostgreSQL 只保存附件元数据和 storageKey，不保存二进制或 base64。"
    ],
    affectedAreas: ["出口部客户档案", "附件", "阿里云 OSS"],
    migration: "none",
    productionDataCommand: "none",
    productionDataRisk: "low",
    commitHash: "待填写"
  },
  {
    id: "2026-05-06-04-duplicate-customer-review",
    date: "2026-05-06",
    version: "2026.05.06-04",
    title: "客户名称防重复与重复客户审核",
    category: "data",
    summary: [
      "服务端规范化公司名称，阻止加点、加空格、大小写和全角半角绕过。",
      "重复客户必须提交审核，通过后才允许例外建档。",
      "提供历史客户 identity backfill 的 dry-run 优先脚本。"
    ],
    affectedAreas: ["出口部客户档案", "重复客户审核"],
    migration: "additive",
    productionDataCommand: "migration",
    productionDataRisk: "medium",
    commitHash: "待填写"
  },
  {
    id: "2026-05-06-03-customer-geo-selector",
    date: "2026-05-06",
    version: "2026.05.06-03",
    title: "国家 / 州省 / 城市联动选择",
    category: "feature",
    summary: [
      "客户地址改为国家 / 地区、州 / 省、城市联动选择。",
      "国家统一显示中文，地理数据通过服务端按需加载。",
      "保留旧 country / city 字段兼容，新增 code/name 字段。"
    ],
    affectedAreas: ["出口部客户档案", "客户表单", "地理数据"],
    migration: "additive",
    productionDataCommand: "migration",
    productionDataRisk: "low",
    commitHash: "待填写"
  },
  {
    id: "2026-05-06-02-contacts-attachments-field-labels",
    date: "2026-05-06",
    version: "2026.05.06-02",
    title: "多联系人、附件记录和字段类型中文化",
    category: "feature",
    summary: [
      "客户支持多个联系人并可设置主要联系人。",
      "客户档案支持附件链接和附件元数据。",
      "字段类型在 UI 中显示中文，内部枚举保持英文。"
    ],
    affectedAreas: ["出口部客户档案", "联系人", "附件", "字段配置"],
    migration: "additive",
    productionDataCommand: "migration",
    productionDataRisk: "low",
    commitHash: "待填写"
  },
  {
    id: "2026-05-05-01-customer-archive-mvp",
    date: "2026-05-05",
    version: "2026.05.05-01",
    title: "客户档案 MVP：登录、权限、出口部客户档案",
    category: "feature",
    summary: [
      "建立 KingaOS app shell、登录、用户管理和权限管理。",
      "开放出口部客户档案的列表、新建、详情、编辑和字段配置。",
      "未开放模块保留入口并统一拦截。"
    ],
    affectedAreas: ["管理员后台", "出口部客户档案", "权限"],
    migration: "additive",
    productionDataCommand: "migration",
    productionDataRisk: "medium",
    commitHash: "待填写"
  }
];

export const RELEASE_CATEGORY_FILTERS: Array<{ key: "all" | ReleaseNoteCategory; label: string }> = [
  { key: "all", label: "全部" },
  { key: "feature", label: RELEASE_CATEGORY_LABELS.feature },
  { key: "fix", label: RELEASE_CATEGORY_LABELS.fix },
  { key: "ui", label: RELEASE_CATEGORY_LABELS.ui },
  { key: "security", label: RELEASE_CATEGORY_LABELS.security },
  { key: "data", label: RELEASE_CATEGORY_LABELS.data },
  { key: "docs", label: RELEASE_CATEGORY_LABELS.docs }
];

export function isReleaseNoteCategory(value: string): value is ReleaseNoteCategory {
  return Object.prototype.hasOwnProperty.call(RELEASE_CATEGORY_LABELS, value);
}
