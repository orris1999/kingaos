# 06｜多人部署说明

KingaOS 当前多人共享 MVP 默认使用 PostgreSQL + Prisma。阿里云 ECS + RDS PostgreSQL 上线前必须配置真实 PostgreSQL `DATABASE_URL`，并在目标环境执行 migration 和 seed。

## 必需环境变量

```bash
DATABASE_URL="postgresql://kingaos_app:YOUR_PASSWORD@YOUR_RDS_INTERNAL_ENDPOINT:5432/kingaos?schema=public"
DIRECT_URL="postgresql://kingaos_app:YOUR_PASSWORD@YOUR_RDS_INTERNAL_ENDPOINT:5432/kingaos?schema=public"
SESSION_SECRET="replace-with-a-long-random-secret"
SESSION_COOKIE_SECURE="true"
NODE_ENV="production"
```

`.env` 不能提交到 git。`.env.example` 只能放占位值，不能放真实密码。

## 部署命令

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run build
npm start
```

如果 `DATABASE_URL` 仍是占位值，不能宣称已经完成真实 PostgreSQL migration / seed，也不能宣称已经完成多人部署验证。

`npm run db:seed` 是生产安全 seed：只维护权限字典和缺失的系统字段定义，不创建用户、不修改用户、不修改客户。

默认用户初始化不是部署步骤。只有首次空库初始化或 demo/dev 初始化时，才允许人工显式执行：

```bash
ALLOW_DEFAULT_USER_BOOTSTRAP=true npm run db:bootstrap-default-users
```

部署脚本禁止自动执行默认用户 bootstrap、客户 backfill 或任何会创建/修改业务数据的脚本。

生产环境 migration 只允许使用：

```bash
npx prisma migrate deploy
```

生产环境禁止使用：

```bash
npx prisma migrate reset
npx prisma db push --force-reset
npx prisma migrate dev
```

部署生产前建议先备份数据库。所有数据库结构变更必须先在本地 Docker PostgreSQL 和 GitHub Actions 中通过。

## Serverless 连接池

阿里云 ECS + RDS PostgreSQL 路线下，应用运行、migration 和 seed 都可以走 RDS 内网地址，因此 `DATABASE_URL` 与 `DIRECT_URL` 可以相同。

部署到 Vercel 或其他 serverless 环境时，`DATABASE_URL` 使用 pooled connection，`DIRECT_URL` 使用 direct connection。PostgreSQL 连接需要支持 pooling。可选方案：

- Prisma Postgres
- Prisma Accelerate
- Neon pooled connection
- Supabase pooler
- PgBouncer

不要使用 SQLite 文件数据库作为 production、admin trial 或 salesperson usage 的多人共享数据库。

## Cookie Secure

正式 HTTPS 环境必须设置：

```bash
SESSION_COOKIE_SECURE="true"
```

如果临时只用 IP + HTTP 测试，可以设置：

```bash
SESSION_COOKIE_SECURE="false"
```

正式上线前必须改回 `true`。

## 当前上线前检查

- `npx prisma validate`
- `npx prisma generate`
- `npx prisma migrate deploy`
- `npm run db:seed`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Playwright smoke test 需要可访问的真实数据库和浏览器二进制：

```bash
npx playwright install chromium
npm run test:e2e
```
