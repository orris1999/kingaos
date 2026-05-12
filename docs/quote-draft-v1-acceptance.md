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

V1 不验收：

- OEM 自动匹配。
- 图片识别。
- 正式报价生成。
- 财务审批。
- 订单 / 合同。
- 生产数据库导入。

## 功能验收

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

## 价格边界验收

1. 成本报价表价格只能输出到 `priceCandidate`。
2. `priceCandidate.sourceType` 必须是 `cost_candidate`、`quote_candidate` 或 `unknown`。
3. 成本候选必须标记为 `priceStatus = "not_finance_approved"` 或 `requires_finance_review`。
4. 输出结构中不得出现 `financeApprovedPrice` 字段。
5. 系统不得生成 `sent_to_customer` 状态。
6. 系统不得生成正式报价号。
7. 系统不得输出毛利、底价策略或销售可自行决策的财务规则。

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

No-Go 条件：

- 仍把成本候选误叫财务批准价。
- 仍会自动选择重复 KJ 的第一条。
- 仍会让 OEM 自动匹配生成唯一报价。
- 仍会输出正式报价或发送客户状态。

