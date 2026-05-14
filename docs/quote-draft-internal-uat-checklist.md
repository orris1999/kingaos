# Quote Draft Internal UAT Checklist

日期：2026-05-13

本清单用于内部试用 `/export/quote-draft-workbench` 的询价 / 报价草稿预览和草稿 Excel 导出。当前能力仍不是正式报价，不保存草稿，不写数据库，不导入报价表，不发客户。

## 测试前准备

1. 只使用 mock catalog 或 local / test staging 数据。
2. 不使用真实客户数据。
3. 不读取真实报价表原文件。
4. 不导入报价表。
5. 不启用 production feature flags。
6. 不修改 ECS `.env`。
7. 不把导出的 Excel 草稿发客户。
8. 不把草稿候选当作财务批准价格。

## Feature Flags

production 默认保持关闭：

```text
KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=false
KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL=false
```

local / test 环境可按需打开：

```text
KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=true
KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL=true
```

要求：

1. flag 缺失时视为关闭。
2. flag 显式为 `false` 时关闭。
3. 只有显式为 `true` 时开启。
4. 不使用 `NEXT_PUBLIC_`。
5. 不自动修改 ECS `.env`。

## Mock 模式试用步骤

1. 登录 local / test 环境的 `super_admin`。
2. 打开 `/export/quote-draft-workbench`。
3. 数据源选择 `Mock 数据`。
4. 输入 mock KJ、数量和备注，例如：

```text
KJMOCK-COND-001 100pcs 客户要中性包装
```

如 UAT 环境额外准备了 `KJMOCK001`，也可以使用：

```text
KJMOCK001 100pcs
```

5. 选择销售模式：外销 USD、内销 CNY 或未指定。
6. 点击“生成草稿预览”。
7. 检查中文状态 badge 是否清楚展示。
8. 检查“待处理事项”是否提示缺数量、未找到、多候选、OEM 暂未开放或非财务批准价格。
9. 在 local / test 环境打开 `KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL=true` 后，点击“导出草稿 Excel”。
10. 检查文件名包含“草稿”。
11. 检查 Excel 顶部包含“非正式报价，仅供内部整理使用”。
12. 检查 Excel 顶部包含“价格候选不是财务批准价格，不能直接发客户”。
13. 检查 Excel 只包含当前页面预览结果。
14. 检查 Excel 不包含具体价格、底价或毛利。

## Staging 模式试用步骤

仅在 local / test DB 已准备脱敏 staging fixture 时执行。

1. 打开 `KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=true`。
2. 使用 `super_admin` 打开 `/export/quote-draft-workbench`。
3. 选择 `财务确认 staging 候选`。
4. 输入已准备的 test KJ。
5. 点击“生成草稿预览”。
6. 确认 `finance_confirmed + export_draft_candidate + candidate` 可以显示为草稿候选。
7. 确认 `needs_manual_review`、`addon_only`、`blocked`、`ignored` 不显示为可用候选。
8. 确认 `missing`、`requires_finance_review` 价格状态不显示为可用候选。
9. 确认 `not_finance_approved` 仍显示“非正式报价 / 非财务批准价格” warning。

如果 local / test DB 没有 staging fixture，则只执行 domain / action tests，不做浏览器 staging 选择验证。

## 需要记录的问题

1. KJ 未找到。
2. 多候选。
3. 水箱 / 中冷器需人工确认。
4. 缺少数量。
5. OEM 暂未开放。
6. 无价格候选。
7. 缺图。
8. Excel 导出格式问题。
9. warnings 不清楚或过长。
10. 销售模式选择不符合业务习惯。

记录问题时请包含：

1. 输入原文。
2. 选择的数据源。
3. 销售模式。
4. 页面显示状态。
5. 导出的 Excel 文件名。
6. 是否使用 mock 或 test staging 数据。

## 禁止事项

1. 不得把 Excel 草稿当正式报价发客户。
2. 不得用草稿作为财务批准价格。
3. 不得手动修改底价 / 毛利。
4. 不得上传真实报价表。
5. 不得导入真实报价表。
6. 不得创建真实客户或真实报价数据。
7. 不得在 production 启用 feature flags 做试验。
8. 不得把 `not_finance_approved` 理解为正式价格。

## Go / No-Go

Go 条件：

1. feature flags 缺失 / false 时页面保持安全关闭。
2. mock 模式可生成中文草稿预览。
3. Excel 草稿导出只包含当前页面预览结果。
4. Excel 明确标注非正式报价。
5. Excel 不包含具体价格、底价、毛利或财务批准价格。
6. staging 模式在 local / test 中只返回 finance-confirmed 可消费候选。

No-Go 条件：

1. 导出文件缺少非正式报价警示。
2. 导出文件出现具体价格、底价、毛利或财务批准价格。
3. feature flag 关闭时仍可导出或查询 staging。
4. 页面保存输入 / 输出或写数据库。
5. 普通用户可以启用 staging 查询或导出能力。
