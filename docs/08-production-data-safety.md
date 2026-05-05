# 08｜生产数据安全

这份文档是 KingaOS 的生产数据保护红线。它优先于临时部署习惯。

## 正式业务数据

以下数据属于正式业务数据，不能被 seed 或部署脚本自动创建、更新、删除：

- `User`
- `Customer`
- `CustomerContact`
- `CustomerAttachment`
- 由客户档案产生的客户资料、联系人、附件、客户身份、重复客户审核记录

## Seed 红线

`npm run db:seed` 只允许维护系统级字典：

- `Permission`
- 缺失的系统 `CustomerFieldConfig`
- 未来明确归类为系统字典的数据

`npm run db:seed` 禁止：

- 创建、更新、删除用户
- 创建、更新、删除客户
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
- 不修改客户名称

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
