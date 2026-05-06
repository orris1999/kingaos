# KingaOS

KingaOS 是坤江内部业务操作系统。当前多人共享 MVP / production-lite 基线使用 PostgreSQL + Prisma、服务端 session 和服务端权限校验。当前真实开放的业务功能以出口部客户档案为核心，并开放一个小型财务主数据入口：财务官方收款账号管理。

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
- 财务部官方收款账号管理

出口部客户档案当前支持：

- 国家 / 地区 → 州 / 省 → 城市联动选择，并保留手动输入城市 fallback。
- 新建 / 编辑客户采用分步骤填写，详情页采用分区 tab 展示。
- 多个联系人，可设置主要联系人。
- 客户附件支持阿里云 OSS 私有 Bucket 真实上传；上传和下载 / 预览都通过服务端生成短时预签名 URL，附件类型由管理员在字段配置页维护。
- 字段类型在 UI 中显示中文，内部仍保存 `text` / `textarea` / `number` / `date` / `select` / `boolean`。
- 管理员可以修改自定义字段类型；系统字段类型默认锁定，避免影响客户档案基础结构。
- 客户来源按自定义字段配置管理，可由管理员调整类型、分组、必填和选项；旧 `Customer.source` 字段保留兼容历史数据。
- 客户名称默认不允许重复；系统会做规范化判重，加点、加空格、大小写变化、全角半角变化不能绕过。
- 重复客户必须提交业务经理 / 管理员审核，审核通过后才允许例外建档，并写入 AuditLog。
- 客户档案可选择一个财务维护的官方默认收款方案；业务员只能选择，不能手填或修改银行账号明细。
- 财务停用官方收款账号后，已引用客户保留历史引用并显示停用提醒，新客户不能再选择该账号。
- 客户档案关键字段支持修改历史，记录修改人、修改时间、原值和新值。
- 修改历史跟随客户查看权限；客户转给新负责人后，新负责人可以看到该客户过去历史，出口部经理可以看到出口部客户历史。

## 当前未开放功能

- 出口部查询价格
- 国内部功能
- 技术部功能
- 财务部价格表设置
- 财务部上传价格表
- 财务部统一改价
- 合同生成
- 报价
- 订单
- 完整 CRM
- 完整 ERP

## 当前阶段限制

- 当前多人版本默认使用 PostgreSQL + Prisma。
- 用户、权限、session、客户、字段配置、审计日志保存到 PostgreSQL。
- 客户联系人和附件元数据保存到 PostgreSQL。真实附件文件保存在阿里云 OSS，PostgreSQL 不保存文件二进制或 base64。
- 客户身份保存到 `CustomerIdentity`，重复客户审核保存到 `CustomerDuplicateReviewRequest`。
- 官方收款账号保存到 `CompanyReceiptAccount`，客户档案只保存 `defaultReceiptAccountId` 引用，不复制银行账号全文。
- 财务修改官方收款账号后，客户档案展示的是最新账号状态；未来合同需要在合同模块保存账号快照，本阶段不做合同生成。
- 客户字段修改历史保存到 `CustomerFieldChangeHistory`，只用于内部客户档案追溯，不对外展示。
- 字段历史记录默认收款方案时只保存方案名称、账号编号和收款账号 ID，不保存完整银行账号全文。
- 规范化客户名称保存到 `normalizedCustomerName`，用于服务端重复客户检测。
- 国家 / 地区统一显示中文，国家、州 / 省、城市同时保存 code 和 name；旧 `country` / `city` 字段继续保留兼容。
- 地址层级只做到国家 / 地区 → 州 / 省 → 城市，不做区县、街道或更细行政层级。
- OSS Bucket 必须私有；AccessKey 只允许服务端使用，不能加 `NEXT_PUBLIC_`，不能暴露给浏览器。
- 浏览器只能拿到短时间有效的 PUT 上传 URL 和 GET 下载 / 预览 URL。
- 新增附件不再使用旧“附件链接”提交入口；历史外部链接附件仍保留兼容展示和下载。
- 不把文件二进制或 base64 存入 PostgreSQL，不使用 ECS 本地磁盘作为长期正式附件存储。
- 不同电脑登录后应看到同一套数据库数据。
- 部署环境必须配置 `DATABASE_URL`、`DIRECT_URL` 和 `SESSION_SECRET`。
- 阿里云 ECS + RDS PostgreSQL 部署时，`DATABASE_URL` 和 `DIRECT_URL` 可以都使用 RDS 内网地址。
- SQLite 不能作为 production / admin trial / salesperson usage 默认数据库。
- localStorage 仅可作为 demo / test adapter，不用于 production。
- 当前不做完整 CRM、完整 ERP、报价、订单、财务真实价格、国内部客户档案、技术部产品库。
- 当前不做字段回滚 / 版本恢复，不做联系人和附件的字段级历史；联系人和附件继续使用操作记录。

## 初始账号

初始账号只用于首次 demo / dev 初始化，不会在生产部署时自动创建。

首次初始化默认账号必须显式执行：

```bash
ALLOW_DEFAULT_USER_BOOTSTRAP=true npm run db:bootstrap-default-users
```

生产环境初始化默认账号还必须增加二次确认：

```bash
ALLOW_DEFAULT_USER_BOOTSTRAP=true \
BOOTSTRAP_DEFAULT_USERS_CONFIRM=I_UNDERSTAND_THIS_CREATES_USERS \
npm run db:bootstrap-default-users
```

如果数据库里已经存在任何非默认用户，bootstrap 会拒绝执行；除非额外设置 `BOOTSTRAP_NON_DEFAULT_USERS_CONFIRM=I_UNDERSTAND_THIS_DATABASE_ALREADY_HAS_USERS`。

生产部署中的 `npm run db:seed` 只维护系统权限字典和缺失的系统字段定义，不创建用户，不修改用户，不删除用户，不创建客户，不修改客户，不删除客户。

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
ALIYUN_OSS_REGION="oss-cn-guangzhou"
ALIYUN_OSS_BUCKET="kinga"
ALIYUN_OSS_ENDPOINT="https://oss-cn-guangzhou.aliyuncs.com"
ALIYUN_OSS_ACCESS_KEY_ID="replace-with-access-key-id"
ALIYUN_OSS_ACCESS_KEY_SECRET="replace-with-access-key-secret"
ALIYUN_OSS_UPLOAD_PREFIX="customers"
ALIYUN_OSS_SIGNED_URL_EXPIRES_SECONDS="600"
ALIYUN_OSS_MAX_FILE_SIZE_MB="20"
```

`.env` 不提交到 git。

OSS 生产建议使用 prod bucket，本地或测试环境建议使用单独的 dev bucket。所有 OSS 变量都必须只存在服务端 `.env`，不能写成 `NEXT_PUBLIC_*`。

正式 HTTPS 环境 `SESSION_COOKIE_SECURE` 必须为 `true`。如果临时只用 IP + HTTP 测试，可以设置为 `false`，测试完成后再改回 `true`。

## GitHub Actions

每次 push 或 pull request 时，GitHub Actions 会启动 PostgreSQL，执行 migration、安全 seed、typecheck、test 和 build。

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

## Production Data Safety

生产部署标准流程只能是：

```bash
cd /opt/kingaos
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart kingaos
```

如确需补系统权限或缺失系统字段配置，单独执行：

```bash
npm run db:seed
```

`db:seed` 只允许补系统字典，不能创建、更新、删除用户或客户。

客户身份 backfill 默认只 dry-run：

```bash
npm run backfill:customer-identities
```

真正执行必须显式确认：

```bash
BACKFILL_CONFIRM=I_UNDERSTAND_THIS_CHANGES_BUSINESS_DATA \
npm run backfill:customer-identities
```

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
- [生产数据安全](./docs/08-production-data-safety.md)
- [合并版基线](./docs/KingaOS_技术栈与架构执行基线_v1.md)
