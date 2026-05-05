# 07｜本地 PostgreSQL 与 CI 门禁

确认日期：2026-05-05  
状态：LOCAL_POSTGRES_AND_CI_BASELINE

KingaOS 的数据库改动必须先在本地 Docker PostgreSQL 验证，再由 GitHub Actions 自动验证，最后才允许部署到生产环境。

## 本地数据库

本地 Docker Compose 提供两套 PostgreSQL：

- `kingaos_dev`：开发数据库，宿主机端口 `5433`。
- `kingaos_test`：测试数据库，宿主机端口 `5434`。

启动：

```bash
npm run db:local:up
```

停止：

```bash
npm run db:local:down
```

查看日志：

```bash
npm run db:local:logs
```

## 本地开发流程

复制本地开发环境变量：

```bash
cp .env.local.example .env.local
```

启动本地 PostgreSQL 后，开发库执行 migration 和 seed：

```bash
npm run db:local:up
npm run db:dev:migrate
npm run db:dev:seed
npm run dev
```

`db:dev:migrate` 使用本地 `kingaos_dev`，允许在本地创建新的 Prisma migration。不要对生产数据库运行该命令。

## 本地测试流程

复制测试环境变量：

```bash
cp .env.test.example .env.test
```

测试库执行已存在 migration 和 seed：

```bash
npm run db:local:up
npm run db:test:migrate
npm run db:test:seed
npm run typecheck
npm run test
npm run build
```

`db:test:migrate` 使用 `prisma migrate deploy`，只应用已经提交的 migration，用来模拟 CI / production 的部署路径。

## GitHub Actions

每次 push 或 pull request 时，CI 会：

- 启动 PostgreSQL service。
- 执行 `npm ci`。
- 执行 `npx prisma validate`。
- 执行 `npx prisma generate`。
- 执行 `npx prisma migrate deploy`。
- 执行 `npm run db:seed`。
- 执行 `npm run typecheck`。
- 执行 `npm run test`。
- 执行 `npm run build`。

CI 不使用 SQLite，不使用 localStorage production path。

## Production 禁令

生产环境只允许：

```bash
npx prisma migrate deploy
npm run db:seed
npm run build
npm start
```

生产环境禁止：

```bash
npx prisma migrate reset
npx prisma db push --force-reset
npx prisma migrate dev
```

原因：

- `migrate reset` 会清空数据库。
- `db push --force-reset` 可能破坏现有数据。
- `migrate dev` 是开发命令，可能创建或修改 migration，不应直接对生产数据库执行。

生产部署前必须备份数据库，并确认 `DATABASE_URL` / `DIRECT_URL` 指向正确的 PostgreSQL 实例。
