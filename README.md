# KingaOS

KingaOS 是坤江内部业务操作系统。当前多人共享 MVP / production-lite 基线使用 PostgreSQL + Prisma、服务端 session 和服务端权限校验。当前真实开放的业务功能仍然只有出口部客户档案。

## 当前技术栈

- Next.js 15
- React 18
- TypeScript
- npm
- Prisma
- PostgreSQL
- 服务端 session / httpOnly cookie
- 服务端权限校验
- Vitest
- Playwright
- Domain Action

localStorage 只保留为历史 demo / test adapter，不是 production path，不用于管理员试用版本，不用于业务员正式填写版本。

当前业务核心目录：

- `lib/honoa/**`

当前测试目录：

- `tests/domain/honoa/**`
- `tests/e2e/**`

## 当前开放功能

- 登录
- 退出
- super_admin 用户管理
- 权限管理
- 部门入口
- 出口部客户档案
- 出口部客户档案字段配置

出口部客户档案当前支持：

- 多个联系人，可设置主要联系人。
- 附件记录第一版支持附件链接和说明。
- 字段类型在 UI 中显示中文，内部仍保存 `text` / `textarea` / `number` / `date` / `select` / `boolean`。

## 当前未开放功能

- 出口部查询价格
- 国内部功能
- 技术部功能
- 财务部价格表设置
- 财务部上传价格表
- 财务部统一改价
- 报价
- 订单
- 完整 CRM
- 完整 ERP

## 当前阶段限制

- 当前多人版本默认使用 PostgreSQL + Prisma。
- 用户、权限、session、客户、字段配置、审计日志保存到 PostgreSQL。
- 客户联系人和附件元数据保存到 PostgreSQL。
- 附件第一版只保存附件链接和元数据，不把文件二进制或 base64 存入 PostgreSQL。
- 真实文件上传未来接入阿里云 OSS / 对象存储，不使用 ECS 本地磁盘作为长期正式附件存储。
- 不同电脑登录后应看到同一套数据库数据。
- 部署环境必须配置 `DATABASE_URL`、`DIRECT_URL` 和 `SESSION_SECRET`。
- 阿里云 ECS + RDS PostgreSQL 部署时，`DATABASE_URL` 和 `DIRECT_URL` 可以都使用 RDS 内网地址。
- SQLite 不能作为 production / admin trial / salesperson usage 默认数据库。
- localStorage 仅可作为 demo / test adapter，不用于 production。
- 当前不做完整 CRM、完整 ERP、报价、订单、财务真实价格、国内部客户档案、技术部产品库。

## 初始账号

初始 super_admin：

- 邮箱：`superadmin@kingaos.local`
- 密码：`roserose`

初始 admin：

- 邮箱：`admin@kingaos.local`
- 密码：`Kingaos@123456`

出口部测试账号：

- `export.manager@kingaos.local`
- `export.a@kingaos.local`
- `export.b@kingaos.local`

默认测试密码：

- `Kingaos@123456`

## 启动命令

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run build
npm start
```

本地开发：

```bash
npm install
npx prisma generate
npm run dev
npm run test
npm run test:e2e
npm run build
```

本地和部署环境都需要可用 PostgreSQL。Vercel / Railway / Render / Fly / VPS 等平台必须配置 PostgreSQL `DATABASE_URL`，不能使用 SQLite 文件数据库作为多人共享数据库。

部署到 Vercel / serverless 时，PostgreSQL 连接需要支持 pooling。可使用 Prisma Postgres、Prisma Accelerate、Neon pooled connection、Supabase pooler 或 PgBouncer。不要使用 SQLite 文件数据库作为多人共享数据库。

## 环境变量

复制 `.env.example` 并填入真实值：

```bash
DATABASE_URL="postgresql://kingaos_app:YOUR_PASSWORD@YOUR_RDS_INTERNAL_ENDPOINT:5432/kingaos?schema=public"
DIRECT_URL="postgresql://kingaos_app:YOUR_PASSWORD@YOUR_RDS_INTERNAL_ENDPOINT:5432/kingaos?schema=public"
SESSION_SECRET="replace-with-a-long-random-secret"
SESSION_COOKIE_SECURE="true"
NODE_ENV="production"
```

`.env` 不提交到 git。

正式 HTTPS 环境 `SESSION_COOKIE_SECURE` 必须为 `true`。如果临时只用 IP + HTTP 测试，可以设置为 `false`，测试完成后再改回 `true`。

## 文档

- [技术栈确认](./docs/01-confirmed-tech-stack.md)
- [架构执行基线](./docs/02-architecture-baseline.md)
- [模块边界和红线](./docs/03-module-boundaries-and-redlines.md)
- [当前持久化阶段](./docs/04-current-persistence-stage.md)
- [路线图和阶段门](./docs/05-roadmap-and-phase-gates.md)
- [多人部署说明](./docs/06-multiplayer-deploy-notes.md)
- [合并版基线](./docs/KingaOS_技术栈与架构执行基线_v1.md)
