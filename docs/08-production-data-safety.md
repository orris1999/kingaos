# 08｜生产数据安全

这份文档是 KingaOS 的生产数据保护红线。它优先于临时部署习惯。

## 正式业务数据

以下数据属于正式业务数据，不能被 seed 或部署脚本自动创建、更新、删除：

- `User`
- `Customer`
- `CustomerContact`
- `CustomerAttachment`
- `CustomerFieldChangeHistory`
- `CompanyReceiptAccount`
- 由客户档案产生的客户资料、联系人、附件、客户身份、重复客户审核记录
- 客户字段修改历史，包括关键字段、自定义字段和默认收款方案的历史值
- 财务维护的官方收款账号、客户默认收款方案引用和相关审计记录

客户附件真实文件保存在私有阿里云 OSS Bucket。PostgreSQL 只保存附件元数据，例如 `storageProvider`、`storageKey`、MIME、文件大小、上传人和软删除时间。

自定义附件字段也必须复用 `CustomerAttachment`。`customFields` 只能保存附件 ID 引用，`CustomerAttachment.fieldKey` / `fieldLabel` 记录字段归属；禁止把文件二进制、base64、OSS PUT uploadUrl 或 GET downloadUrl 写入客户字段值、修改历史或审计元数据。

附件安全红线：

- 不把文件二进制存进 PostgreSQL。
- 不把 base64 存进 PostgreSQL。
- 不把正式附件长期存在 ECS 本地磁盘。
- 不把 OSS 临时 uploadUrl / downloadUrl 存入 PostgreSQL。
- AccessKey 只能在服务端 `.env` 使用，不能暴露给浏览器。
- OSS Bucket 必须私有。
- 上传使用服务端生成的短时 PUT 预签名 URL。
- 下载 / 预览使用服务端生成的短时 GET 预签名 URL。
- `.env`、`.env.local`、`.env.production` 禁止提交。

## Seed 红线

`npm run db:seed` 只允许维护系统级字典：

- `Permission`
- 缺失的系统 `CustomerFieldConfig`
- 未来明确归类为系统字典的数据

`npm run db:seed` 禁止：

- 创建、更新、删除用户
- 创建、更新、删除客户
- 创建、更新、删除财务官方收款账号
- 创建、更新、删除客户字段修改历史，除非它是客户编辑事务自然产生的记录
- 删除正式业务数据
- `deleteMany`
- `truncate`
- `DROP`
- 清空或重写客户字段值

## 默认用户 Bootstrap

默认用户初始化只允许用于首次初始化空系统或明确批准的 demo/dev 环境。

默认拒绝执行：

```bash
npm run db:bootstrap-default-users
```

必须显式确认：

```bash
ALLOW_DEFAULT_USER_BOOTSTRAP=true npm run db:bootstrap-default-users
```

生产环境还必须增加第二个确认变量：

```bash
ALLOW_DEFAULT_USER_BOOTSTRAP=true \
BOOTSTRAP_DEFAULT_USERS_CONFIRM=I_UNDERSTAND_THIS_CREATES_USERS \
npm run db:bootstrap-default-users
```

如果数据库里已经存在任何非默认用户，bootstrap 会拒绝执行。只有在人工确认这是有意操作后，才允许增加额外确认：

```bash
BOOTSTRAP_NON_DEFAULT_USERS_CONFIRM=I_UNDERSTAND_THIS_DATABASE_ALREADY_HAS_USERS
```

默认用户 bootstrap 禁止放入 deploy、postinstall、build、start 或自动化部署脚本。

## Backfill 红线

Backfill 属于业务数据修改，必须先 dry-run。

默认命令只检查，不写数据库：

```bash
npm run backfill:customer-identities
```

真正执行必须显式确认：

```bash
BACKFILL_CONFIRM=I_UNDERSTAND_THIS_CHANGES_BUSINESS_DATA \
npm run backfill:customer-identities
```

Backfill 必须：

- 执行前输出预计影响数量
- 执行后输出实际影响数量
- 幂等
- 不删除客户
- 不清空字段
- 不修改客户负责人
- 不修改真实客户的公司名称 / 内部 `Customer.name`

## Production Migration

生产环境只允许：

```bash
npx prisma migrate deploy
```

生产环境禁止：

```bash
npx prisma migrate reset
npx prisma db push --force-reset
npx prisma migrate dev
```

部署前建议备份数据库。结构迁移必须先通过本地 PostgreSQL 和 GitHub Actions，再上生产。

## 安全部署流程

生产部署标准流程：

```bash
cd /opt/kingaos
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart kingaos
```

`npm run db:seed` 不属于每次部署的自动步骤。如确需补系统权限或系统字段配置，应单独执行，并确认该命令不触碰正式业务数据。

财务官方收款账号只能通过应用内权限页面维护，不允许通过 seed、bootstrap、backfill 或部署脚本自动创建示例账号。停用账号只做状态变更，不物理删除历史引用；已引用客户需要在页面提示重新选择有效账号。

客户字段修改历史只由服务端客户编辑事务生成，不允许前端提交旧值伪造历史。历史记录不保存完整银行账号全文，不对外展示，不用于字段回滚或版本恢复。

客户字段修改历史必须去噪：

- `null`、`undefined`、空字符串、纯空格字符串都视为同一个“未填写”状态。
- `未填写 -> 未填写` 不允许写入历史。
- 用户打开编辑页但没有实际修改字段时，不允许新增历史记录。
- 自定义字段只有真实值变化时才记录；未填写字段、停用字段不写历史。
- 默认收款方案按 `receiptAccountId` 比较，不按显示文本比较。

生产冒烟测试默认只做只读检查，例如登录页、列表页、详情页、权限页是否可访问。禁止为了验证部署而修改真实客户字段、写入 `部署验证xxxx`、创建测试客户、创建测试用户、创建测试收款账号或创建测试附件。如必须验证写入链路，只能使用本地 dev 数据库、staging 数据库，或经人工确认的专用测试客户。

客户历史垃圾清理必须先 dry-run：

```bash
npm run cleanup:customer-history-spam:dry-run
```

真正删除精确 spam 记录必须显式确认：

```bash
CLEANUP_CUSTOMER_HISTORY_SPAM_CONFIRM=I_UNDERSTAND_THIS_DELETES_SPAM_HISTORY \
npm run cleanup:customer-history-spam:apply
```

cleanup 只允许清理以下明确 spam：

- old/new 归一化后完全相等的历史。
- oldDisplayValue 和 newDisplayValue 都是“未填写”的历史。
- 明确包含“部署验证”字样的历史。

cleanup 不属于部署流程，不允许自动运行。
