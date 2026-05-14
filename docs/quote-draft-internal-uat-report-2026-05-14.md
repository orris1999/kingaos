# Quote Draft Internal UAT Report

日期：2026-05-14

测试时间：2026-05-14 10:18 CST

测试环境：production / ECS / `super_admin`

本报告只记录 `/export/quote-draft-workbench` 的内部 UAT。测试范围仅限 Mock 数据源、询价 / 报价草稿预览和草稿 Excel 导出；未读取真实报价表，未导入报价表，未创建测试客户或测试报价，未保存草稿，未生成正式报价。

## 当前 Feature Flags

已开启：

```text
KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL=true
```

保持关闭或缺失默认关闭：

```text
KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=false
KINGA_ENABLE_FINANCE_STAGING_CONFIRM=false
```

本轮没有修改 ECS `.env`，仅验证 008H 已开启的 Excel 草稿导出 flag。

## UAT 用例结果

### 用例 1：页面安全提示

结果：通过。

页面顶部保留以下边界提示：

1. 非正式报价。
2. 价格候选不是财务批准价格。
3. 不能直接发客户。
4. 报价表 / 成本表 / 价格候选数据由财务提交和维护。
5. 出口部不能上传或维护价格表。

### 用例 2：Mock 基础输入

输入：

```text
KJMOCK001 100pcs
KJMOCK002*200
KJMOCK-MISSING 50
16400-XXXXX 300
UNKNOWN123
```

结果：通过。

验证结果：

1. 能生成草稿预览。
2. 预览状态为中文。
3. 页面显示结果汇总。
4. 页面显示待处理事项。
5. OEM 输入显示“暂未开放”。
6. 未找到项显示清楚。
7. 风险提示包含非正式报价 / 非财务批准价格边界。

说明：当前 mock catalog 的正式示例编码是 `KJMOCK-COND-001`、`KJMOCK-RAD-PA16-A` 等；`KJMOCK001` / `KJMOCK002` 这类简写会按未找到候选展示，未发现安全边界问题。

### 用例 3：数量和备注

输入：

```text
KJMOCK001
KJMOCK002 200 客户要中性包装
KJMOCK003, 50, 急单
```

结果：通过。

验证结果：

1. 缺少数量时显示 warning。
2. `200` 和 `50` 能识别为数量。
3. `客户要中性包装` 和 `急单` 备注能保留。
4. 包装相关备注没有自动计算价格。

### 用例 4：销售模式

分别测试：

1. 外销 USD / `export_usd`
2. 内销 CNY / `domestic_cny`
3. 未指定 / `unknown`

结果：通过。

验证结果：

1. 预览表格显示销售模式。
2. 草稿 Excel 包含销售模式。
3. 切换销售模式不会显示具体价格、底价或毛利。

### 用例 5：Excel 导出

结果：通过。

验证结果：

1. 有预览行时，导出草稿 Excel 按钮可用。
2. 清空预览后，导出按钮 disabled，并提示暂无可导出内容。
3. 导出文件名包含“草稿”，例如 `KingaOS-询价报价草稿-20260514-1018.xlsx`。
4. Excel 顶部包含 `KingaOS 询价 / 报价草稿`。
5. Excel 顶部包含“非正式报价”。
6. Excel 顶部包含“价格候选不是财务批准价格，不能直接发客户”。
7. Excel 包含 warnings / 待处理事项。
8. Excel 未发现具体价格、底价、毛利。
9. Excel 未发现 `FinanceApprovedPrice`、`officialQuote`、`sentToCustomer`。
10. 未出现“正式报价单 / Official Quote / Sales Quote”命名或文案。

### 用例 6：Feature flag 边界

结果：通过。

验证结果：

1. `KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL=true`。
2. `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT` 当前未启用，缺失时默认 false。
3. `KINGA_ENABLE_FINANCE_STAGING_CONFIRM` 当前未启用，缺失时默认 false。
4. Excel 导出可用。
5. 财务确认 staging 候选数据源仍 disabled。
6. Finance staging confirmation 不可用。

## 发现的问题

### Blocker

无。

### P1

无。

### P2

无。

### Enhancement

1. 建议在下一轮给出口部经理试用前，统一 UAT 文档和页面示例里的 mock 编码，优先使用当前 mock catalog 已存在的 `KJMOCK-COND-001`、`KJMOCK-RAD-PA16-A`、`KJMOCK-RAD-BASE-001` 等，减少 `KJMOCK001` 简写被误解为系统失败的可能。
2. 如要开放给出口部经理，需要单独设计只读访问边界；当前页面仍是 `super_admin` only。

## 分级结论

| 级别 | 是否发现 | 结论 |
|---|---:|---|
| Blocker | 否 | 无阻断问题。 |
| P1 | 否 | 无影响内部试用的严重问题。 |
| P2 | 否 | 无必须先修的体验问题。 |
| Enhancement | 是 | 示例编码和经理访问边界可后续优化。 |

## Go / No-Go

继续 `super_admin` 内部试用：建议继续。

开放给出口部经理小范围试用：有条件建议。当前页面仍是 `super_admin` only，不建议直接绕过权限开放；建议下一步只做经理只读访问边界，并继续保持：

1. 只开放 Mock 数据源。
2. 只开放草稿预览和草稿 Excel 导出。
3. staging 数据源仍关闭。
4. 不保存草稿。
5. 不生成正式报价。
6. 不允许发客户。

是否建议关闭 Excel 导出 flag：不建议关闭。当前 UAT 未发现 Excel 安全边界失败。

## 安全边界确认

本轮 UAT：

1. 没有导入报价表。
2. 没有读取真实报价表。
3. 没有创建测试客户。
4. 没有创建测试报价。
5. 没有运行 migration / seed / bootstrap / backfill / cleanup apply。
6. 没有保存输入或输出。
7. 没有生成正式报价。
8. 没有修改业务数据；仅产生允许范围内的 `super_admin` 登录会话。
