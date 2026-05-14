# Quote Draft Manager Trial UAT Report

日期：2026-05-14

## 测试范围

本次 UAT 只验证出口部经理内部试用边界：

1. Mock 数据源。
2. 询价 / 报价草稿预览。
3. 草稿 Excel 导出。
4. 不启用真实 finance-confirmed staging 数据源。
5. 不启用 Finance staging confirm。
6. 不保存草稿，不写业务数据，不导入报价表，不生成正式报价。

## 测试环境

环境：production / ECS

代码版本：

```text
6ddac4d762ca5dba9b8cdebe0dabe1d89dd05243
```

测试账号角色：

```text
email: test1@manager
department: export
role: manager
isActive: true
```

本报告不记录密码、session token、数据库连接串、真实客户信息、真实报价表内容、真实价格、底价或毛利。

## Feature Flag 状态

已开启：

```text
KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL=true
KINGA_ENABLE_EXPORT_MANAGER_QUOTE_DRAFT_TRIAL=true
```

保持关闭或缺失：

```text
KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=false
KINGA_ENABLE_FINANCE_STAGING_CONFIRM=false
```

## UAT 用例结果

| 用例 | 结果 | 说明 |
| --- | --- | --- |
| 只读账号确认 | 通过 | `test1@manager` 是启用的出口部经理账号，符合 `department=export && role=manager`。 |
| 登录 | 通过 | 指定出口部经理账号可登录。登录只产生允许范围内的 session / lastLoginAt。 |
| 打开 `/export/quote-draft-workbench` | 通过 | 出口部经理可直接打开 Workbench。 |
| 经理内部试用提示 | 通过 | 页面显示“当前为出口部经理内部试用，仅开放 Mock 数据和草稿 Excel 导出”。 |
| 非正式报价警示 | 通过 | 页面保留“不会生成正式报价”“价格候选不是财务批准价格”“不能发客户”等警示。 |
| 财务维护边界 | 通过 | 页面保留“报价表 / 成本表 / 价格候选数据由财务提交和维护”。 |
| Mock 数据源 | 通过 | Mock 数据源可用。 |
| staging 数据源 | 通过 | 财务确认 staging 候选保持 disabled，不可用。 |
| 草稿预览 | 通过 | 可输入 mock KJ 示例并生成草稿候选预览。 |
| 草稿 Excel 导出按钮 | 通过 | 按钮可用。 |
| Excel 文件名 | 通过 | 导出文件名包含“草稿”。 |
| Excel 非正式报价警示 | 通过 | 导出内容包含“非正式报价”。 |
| Excel 脱敏 | 通过 | 导出内容不包含具体价格、底价、毛利、FinanceApprovedPrice、officialQuote 或 sentToCustomer。 |
| 普通出口部业务员边界 | 通过 | 已部署访问条件仍要求 `super_admin` 或开启经理试用 flag 后的 `department=export && role=manager`；普通出口部业务员不满足该条件。本轮未用普通业务员登录，避免产生额外 session。 |

## 问题分级

### Blocker

未发现。

### P1

未发现。

### P2

1. 出口部首页的 Workbench 入口卡片仍显示“内部原型，暂仅 super_admin 可访问 / 暂未开放”。经理可通过直达 `/export/quote-draft-workbench` 正常访问，但首页入口文案会造成试用困惑。建议后续小补丁把该入口文案按 `KINGA_ENABLE_EXPORT_MANAGER_QUOTE_DRAFT_TRIAL` 更新为“经理内部试用”。

### Enhancement

1. 后续如需开放真实 staging 数据源，应单独开启 `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT` 并完成 finance-confirmed staging 数据验收。
2. 后续如需开放给指定业务员，应单独设计业务员试用边界，不要复用经理试用 flag。
3. 后续正式报价仍必须接 FinancePricing / 财务审批 / 价格快照。

## Go / No-Go 判断

继续出口部经理内部试用：建议继续。

理由：

1. Mock 数据、草稿预览、草稿 Excel 导出均通过。
2. staging 数据源仍关闭。
3. Finance staging confirm 仍关闭。
4. Excel 草稿保留非正式报价和非财务批准价格警示。
5. 未发现 Blocker 或 P1。

是否建议开放给指定业务员：暂不建议。

原因：

1. 本轮只验证出口部经理边界。
2. 普通业务员试用需要单独 flag 或权限边界。
3. 不能让销售侧把草稿当成正式报价或定价依据。

是否建议关闭 manager trial flag：不建议关闭。

当前建议保持：

```text
KINGA_ENABLE_EXPORT_MANAGER_QUOTE_DRAFT_TRIAL=true
KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL=true
KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=false
KINGA_ENABLE_FINANCE_STAGING_CONFIRM=false
```

## 禁止事项执行确认

1. 没有导入报价表。
2. 没有读取真实报价表。
3. 没有创建测试客户。
4. 没有创建测试报价。
5. 没有保存报价草稿。
6. 没有生成正式报价。
7. 没有运行 migration / seed / bootstrap / backfill / cleanup apply。
8. 没有修改客户数据或业务数据。
