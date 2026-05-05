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

- 国家 / 地区 → 州 / 省 → 城市联动选择，并保留手动输入城市 fallback。
- 新建 / 编辑客户采用分步骤填写，详情页采用分区 tab 展示。
- 多个联系人，可设置主要联系人。
- 附件记录第一版支持附件链接和说明。
- 字段类型在 UI 中显示中文，内部仍保存 `text` / `textarea` / `number` / `date` / `select` / `boolean`。
- 管理员可以修改自定义字段类型；系统字段类型默认锁定，避免影响客户档案基础结构。
- 客户名称默认不允许重复；系统会做规范化判重，加点、加空格、大小写变化、全角半角变化不能绕过。
- 重复客户必须提交业务经理 / 管理员审核，审核通过后才允许例外建档，并写入 AuditLog。

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
- 客户身份保存到 `CustomerIdentity`，重复客户审核保存到 `CustomerDuplicateReviewRequest`。
- 规范化客户名称保存到 `normalizedCustomerName`，用于服务端重复客户检测。
- 国家 / 地区统一显示中文，国家、州 / 省、城市同时保存 code 和 name；旧 `country` / `city` 字段继续保留兼容。
- 地址层级只做到国家 / 地区 → 州 / 省 → 城市，不做区县、街道或更细行政层级。
- 附件第一版只保存附件链接和元数据，不把文件二进制或 base64 存入 PostgreSQL。
- 真实文件上传未来接入阿里云 OSS / 对象存储，不使用 ECS 本地磁盘作为长期正式附件存储。
- 不同电脑登录后应看到同一套数据库数据。
- 部署环境必须配置 `DATABASE_URL`、`DIRECT_URL` 和 `SESSION_SECRET`。
- 阿里云 ECS + RDS PostgreSQL 部署时，`DATABASE_URL` 和 `DIRECT_URL` 可以都使用 RDS 内网地址。
- SQLite 不能作为 production / admin trial / salesperson usage 默认数据库。
- localStorage 仅可作为 demo / test adapter，不用于 production。
- 当前不做完整 CRM、完整 ERP、报价、订单、财务真实价格、国内部客户档案、技术部产品库。

## 初始账号

初始账号只用于首次 demo / dev 初始化，不会在生产部署时自动创建。

首次初始化默认账号必须显式执行：

```bash
ALLOW_DEFAULT_USER_BOOTSTRAP=true npm run db:bootstrap-default-users
```

生产部署中的 `npm run db:seed` 只维护系统权限字典和缺失的系统字段定义，不创建用户，不修改用户，不修改客户。

默认 super_admin：

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

## 本地 PostgreSQL 开发和测试

KingaOS 支持本地 Docker PostgreSQL。以后数据库改动先在本地验证，再进入 GitHub Actions，最后才上生产。

本地数据库：

- `kingaos_dev`：开发数据库，端口 `5433`。
- `kingaos_test`：测试数据库，端口 `5434`。

启动本地数据库：

```bash
npm run db:local:up
```

开发库 migration / seed：

```bash
cp .env.local.example .env.local
npm run db:dev:migrate
npm run db:dev:seed
npm run db:dev:bootstrap
```

测试库 migration / seed：

```bash
cp .env.test.example .env.test
npm run db:test:migrate
npm run db:test:seed
npm run db:test:bootstrap
```

本地数据库命令只用于开发和测试，不代表生产部署已经完成。

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

## GitHub Actions

每次 push 或 pull request 时，GitHub Actions 会启动 PostgreSQL，执行 migration、安全 seed、测试用户 bootstrap、typecheck、test 和 build。

CI 流程使用 `npx prisma migrate deploy`，模拟 production 的安全 migration 路径。

## Production Migration 安全红线

生产环境只允许执行：

```bash
npx prisma migrate deploy
```

生产环境禁止执行：

```bash
npx prisma migrate reset
npx prisma db push --force-reset
npx prisma migrate dev
```

`migrate reset` 和 `db push --force-reset` 会带来清库或破坏正式数据风险；`migrate dev` 只允许用于本地开发数据库。

部署脚本不得自动执行默认用户 bootstrap、客户 backfill 或任何会创建/修改业务数据的脚本。这些脚本只能在明确确认、备份和人工审查后单独执行。

## 地理数据

国家 / 州 / 省 / 城市数据通过服务端 API 按需读取，不在 client component 中直接 import 全量数据，也不把全量城市数据一次性打进前端 bundle。

- 数据包：`@countrystatecity/countries`
- 上游项目：`countrystatecity-countries`
- License：`ODbL-1.0`
- 当前使用方式：内部业务系统按需查询展示；如未来对外分发、公开数据或再发布衍生数据库，需要按 ODbL 要求做 attribution / share-alike / keep open 复核。

## 文档

- [技术栈确认](./docs/01-confirmed-tech-stack.md)
- [架构执行基线](./docs/02-architecture-baseline.md)
- [模块边界和红线](./docs/03-module-boundaries-and-redlines.md)
- [当前持久化阶段](./docs/04-current-persistence-stage.md)
- [路线图和阶段门](./docs/05-roadmap-and-phase-gates.md)
- [多人部署说明](./docs/06-multiplayer-deploy-notes.md)
- [本地 PostgreSQL 与 CI 门禁](./docs/07-local-postgres-and-ci.md)
- [合并版基线](./docs/KingaOS_技术栈与架构执行基线_v1.md)
