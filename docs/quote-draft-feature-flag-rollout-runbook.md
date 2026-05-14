# Quote Draft Feature Flag Rollout Runbook

日期：2026-05-13

本 runbook 只说明 `/export/quote-draft-workbench` 的内部试用 feature flags 如何人工开启和回退。当前 production 默认关闭；Codex 不自动修改 ECS `.env`，不启用 production feature flags。

## 当前状态

production 默认关闭：

```text
KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=false
KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL=false
KINGA_ENABLE_EXPORT_MANAGER_QUOTE_DRAFT_TRIAL=false
```

功能边界：

1. Workbench 只是询价 / 报价草稿预览。
2. Excel 导出仍是草稿，不是正式报价。
3. staging candidates 仍不是正式价格表。
4. `finance_confirmed` 不等于 FinanceApprovedPrice。
5. `export_draft_candidate` 仍然不是正式报价。
6. 正式报价必须后续接 FinancePricing。
7. 当前能力不保存草稿、不写数据库、不导入报价表。
8. 出口部经理试用必须由独立 flag 控制，不能和 Excel 导出 flag 绑定。

## 开启前条件

开启任一 flag 前必须确认：

1. 当前代码版本已部署。
2. Workbench 页面可访问，未登录访问仍跳转 `/login`。
3. `super_admin` local / test 验证已通过。
4. 所有导出文件都有“非正式报价”警示。
5. 所有导出文件都有“价格候选不是财务批准价格，不能直接发客户”警示。
6. 导出内容不包含具体价格、底价、毛利或财务批准价格。
7. 导出只使用当前页面预览结果。
8. 业务人员已阅读 `docs/quote-draft-internal-uat-checklist.md`。

如果要开启 staging 查询，还必须确认：

1. 财务 staging 数据已准备好。
2. staging batch 已经过 Finance dry-run 和确认流程。
3. `finance_confirmed + export_draft_candidate + candidate` 的 test 验证通过。
4. `needs_manual_review`、`addon_only`、`blocked`、`ignored` 不会暴露给出口部。
5. `missing`、`requires_finance_review` 价格状态不会暴露给出口部。
6. AuditLog / 只读查询边界已通过本地或 test 验证。

如果只开启 mock Excel 导出，可以不开启 staging 查询。

如果要开放出口部经理小范围试用，还必须确认：

1. `KINGA_ENABLE_EXPORT_MANAGER_QUOTE_DRAFT_TRIAL=true` 只用于经理试用。
2. 经理账号满足 `department = export` 且 `role = manager`。
3. 普通出口部业务员仍不可访问。
4. staging 查询仍保持关闭，除非另行完成真实 staging 数据源试用审批。
5. 经理试用只允许 Mock 数据、草稿预览和草稿 Excel 导出。

## 开启方式

必须由人工修改 ECS `.env`。

只开启草稿 Excel 导出：

```text
KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL=true
```

开放出口部经理 Mock 试用：

```text
KINGA_ENABLE_EXPORT_MANAGER_QUOTE_DRAFT_TRIAL=true
```

如需同时开启 staging candidates 查询：

```text
KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=true
```

修改后重启：

```bash
cd /opt/kingaos
pm2 restart kingaos --update-env
pm2 status
```

不要在开启 feature flag 时运行：

```bash
npx prisma migrate deploy
npm run db:seed
npm run db:bootstrap-default-users
npm run backfill
npm run cleanup:customer-history-spam:apply
```

## 关闭方式

将对应变量删除或改为：

```text
KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL=false
KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT=false
KINGA_ENABLE_EXPORT_MANAGER_QUOTE_DRAFT_TRIAL=false
```

然后重启：

```bash
cd /opt/kingaos
pm2 restart kingaos --update-env
pm2 status
```

关闭 feature flag 不需要数据库回滚，因为本功能不写库。

## 第一轮内部试用流程

1. 只允许 `super_admin` 操作。
2. 打开 `/export/quote-draft-workbench`。
3. 先用 `Mock 数据` 验证输入和 Excel 导出。
4. 输入 mock KJ、数量和备注。
5. 生成草稿预览。
6. 检查中文状态和待处理事项。
7. 导出草稿 Excel。
8. 检查文件名包含“草稿”。
9. 检查 Excel 警示和脱敏内容。
10. 如 staging flag 已开启，再切到 `财务确认 staging 候选` 做 local / test KJ 查询。
11. 记录未找到、多候选、缺数量、OEM 暂未开放和非财务批准价格问题。

## 出口部经理小范围试用流程

仅当 `KINGA_ENABLE_EXPORT_MANAGER_QUOTE_DRAFT_TRIAL=true` 时执行。

1. 只允许出口部经理账号访问。
2. 数据源必须保持 `Mock 数据`。
3. `财务确认 staging 候选` 必须 disabled。
4. 可以输入 KJ / 数量 / 备注并生成草稿预览。
5. 如 `KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL=true`，可以导出草稿 Excel。
6. 不保存草稿、不写数据库、不生成正式报价。
7. 普通出口部业务员仍不开放。

## 风险

1. 导出的仍是草稿，不是正式报价。
2. 草稿 Excel 不得发客户。
3. 草稿 Excel 不得作为财务批准价格。
4. `not_finance_approved` 可作为草稿候选，但不能作为正式报价。
5. `hasCostCandidate = true` 只表示存在成本候选，不显示金额。
6. `hasQuoteCandidate = true` 只表示存在报价候选，不显示金额。
7. staging 查询结果仍需人工核对业务语义。

## 回滚

1. 关闭 feature flag。
2. `pm2 restart kingaos --update-env`。
3. 不删除 batch / rows。
4. 不需要回滚数据库。
5. 如已导出草稿 Excel，通知内部试用人员废弃该草稿文件。

## Go / No-Go

Go 条件：

1. feature flag 关闭时功能不可用。
2. feature flag 开启后只允许 `super_admin`，或在经理试用 flag 开启时允许出口部经理使用 Mock 数据。
3. Excel 警示完整。
4. Excel 脱敏完整。
5. Workbench 不保存输入 / 输出。
6. Workbench 不写数据库。
7. 出口部经理不能使用 staging 数据源。

No-Go 条件：

1. 导出缺少非正式报价警示。
2. 导出出现具体价格、底价、毛利或财务批准价格。
3. 普通用户可访问 staging 查询或导出。
4. flag 关闭时仍可使用。
5. 需要导入真实报价表或修改 production 数据才能完成试用。
6. 普通出口部业务员可访问 Workbench。
