# Codex 任务 Prompt 模板

每一轮 KingaOS 任务都必须先确认范围和边界，再执行代码、测试和报告。除非用户明确要求，不能自动 push、不能自动部署 ECS、不能运行生产数据库命令。

## 固定边界

真实开放范围当前只围绕：

- KingaOS → 管理员后台
- KingaOS → 出口部 → 客户档案
- KingaOS → 财务部 → 收款账号管理

默认不要做：

- 供应商
- 报价
- 订单
- 合同
- 客户信息卡
- 价格查询真实功能
- 财务价格表
- 上传价格表
- 统一改价
- 国内部客户档案
- 技术部产品库
- 完整 CRM / ERP

默认不要运行：

- production migration
- `npm run db:seed`
- `npm run db:bootstrap-default-users`
- `npm run backfill`
- `npm run cleanup:customer-history-spam:apply`
- `npx prisma migrate reset`
- `npx prisma db push --force-reset`
- production `npx prisma migrate dev`

## 版本更新日志要求

本轮如果修改了任何代码、页面、文档、配置、测试或部署流程，必须同步更新：

1. `docs/CHANGELOG.md`
2. `lib/honoa/shared/release-notes.ts`

更新日志必须包含：

- 日期
- 更新编号
- 更新类型
- 影响范围
- 主要变化
- 是否有 migration
- 是否运行生产数据命令
- 是否涉及生产数据风险

最终报告必须说明：

1. 是否已更新 `docs/CHANGELOG.md`。
2. 是否已更新 `lib/honoa/shared/release-notes.ts`。
3. 本轮新增的 release note id。
4. 如果没有更新，必须说明原因。

如果本轮有用户可见变化但没有更新版本日志，则本轮不能视为完成。
