# Quote Task 007D｜Finance staging confirmation rollout runbook

日期：2026-05-13

本 runbook 只用于 Finance staging confirmation feature flag 的验证和生产启用预案。当前 production 默认关闭，不在本轮启用，不修改 ECS `.env`，不写 production 数据。

## 当前状态

Feature flag：

```text
KINGA_ENABLE_FINANCE_STAGING_CONFIRM
```

规则：

1. 缺失时视为关闭。
2. `false` 时关闭。
3. 只有 `true` 时开启。
4. 不使用 `NEXT_PUBLIC_` 前缀。
5. 只由 server component 读取，不暴露给浏览器运行时。
6. 当前 production 不自动启用。

关闭时 `/finance/quote-source-staging/[batchId]` 仍是只读页面：

1. 确认按钮 disabled。
2. 页面显示确认功能未启用。
3. 不渲染可提交 form。
4. 不调用 `confirmQuoteSourceStagingBatchAction`。
5. 不写数据库。

## 开启前条件

开启 production feature flag 前必须全部满足：

1. 当前代码版本已部署到 ECS。
2. Production 中已有真实 staging batch。
3. 该 staging batch 已经过 Finance dry-run 和 staging 结构确认。
4. staging batch 当前 status 为 `dry_run_passed`。
5. super_admin 已明确知道本次确认动作的业务含义。
6. AuditLog 可用，且 `quote_source_staging.finance_confirmed` 可以写入。
7. 已确认确认动作不会生成正式报价、不会导入报价表、不会保存具体价格。
8. 已确认 `finance_confirmed` 不等于 FinanceApprovedPrice。
9. 已确认 `export_draft_candidate` 仍然不是正式报价。

## 开启方式

必须由人工在 ECS 上操作，不允许 Codex 自动修改 ECS `.env`。

1. 登录 ECS。
2. 编辑 `/opt/kingaos/.env`。
3. 设置：

```bash
KINGA_ENABLE_FINANCE_STAGING_CONFIRM=true
```

4. 重启应用：

```bash
cd /opt/kingaos
pm2 restart kingaos --update-env
pm2 status
```

5. 确认 `kingaos` 为 `online`。

不要运行：

```bash
npx prisma migrate deploy
npm run db:seed
npm run db:bootstrap-default-users
npm run backfill
npm run cleanup:customer-history-spam:apply
npx prisma migrate reset
npx prisma db push --force-reset
npx prisma migrate dev
```

## 关闭方式

1. 登录 ECS。
2. 编辑 `/opt/kingaos/.env`。
3. 删除 `KINGA_ENABLE_FINANCE_STAGING_CONFIRM`，或改为：

```bash
KINGA_ENABLE_FINANCE_STAGING_CONFIRM=false
```

4. 重启应用：

```bash
cd /opt/kingaos
pm2 restart kingaos --update-env
pm2 status
```

关闭 feature flag 不删除 batch / rows，不修改已存在的 AuditLog。

## 第一单操作流程

开启后第一单只允许 super_admin 操作。

1. 打开 `/finance/quote-source-staging`。
2. 进入目标 batch 详情页。
3. 核对 batch 基本信息：
   - 文件名。
   - adapterId。
   - 品类。
   - dry-run decision。
   - 当前 status。
   - `submittedByRole = finance`。
   - `consumerDepartment = export`。
4. 核对 row 统计：
   - candidate。
   - needs_manual_review。
   - addon_only。
   - blocked。
   - ignored。
5. 核对出口部可消费预览。
6. 核对 warnings：
   - 成本价不是财务批准价格。
   - `finance_confirmed` 不等于 FinanceApprovedPrice。
   - `export_draft_candidate` 不是正式报价。
   - `needs_manual_review` 默认不会给出口部消费。
   - `addon_only` / `blocked` / `ignored` 不会给出口部消费。
7. 填写可选 `confirmationNote`。
8. 勾选风险确认。
9. 点击“我已确认以上风险，确认进入草稿候选”。
10. 确认后检查：
    - batch status = `finance_confirmed`。
    - `confirmedBy` / `confirmedAt` 已写入。
    - 只有符合条件的 candidate 行变成 `export_draft_candidate`。
    - `needs_manual_review` / `addon_only` / `blocked` / `ignored` 未自动给出口部消费。
    - `missing` / `requires_finance_review` 价格状态未自动给出口部消费。
    - AuditLog action = `quote_source_staging.finance_confirmed`。
    - AuditLog metadata 不含具体价格、底价、毛利、FinanceApprovedPrice、officialQuote 或 sentToCustomer。

## 确认后的数据语义

`finance_confirmed` 只表示：

1. 财务确认该 staging batch 可以作为报价草稿候选数据源。
2. 符合条件的 candidate 行可以成为 `export_draft_candidate`。

它不表示：

1. FinanceApprovedPrice。
2. 正式价格表。
3. 正式报价。
4. 可直接发客户。
5. 底价批准。
6. 毛利批准。
7. 特殊价格批准。

`not_finance_approved` 行可以作为报价草稿候选，但仍然不是正式报价，必须后续接 FinancePricing。

## 风险与回滚

主要风险：

1. 财务确认动作被误解为正式价格批准。
2. `export_draft_candidate` 被误解为正式报价。
3. 未人工确认的复杂行被错误给出口部消费。
4. AuditLog 不可用导致确认动作缺少留痕。

回滚方式：

1. 立即关闭 `KINGA_ENABLE_FINANCE_STAGING_CONFIRM`。
2. `pm2 restart kingaos --update-env`。
3. 不删除 batch / rows。
4. 不手工修改 row visibility。
5. 如需取消 batch，后续必须单独实现 cancel action，并保留 AuditLog。

本 runbook 不允许通过数据库脚本直接改状态、删数据或清空表。
