# 04｜当前持久化阶段

确认日期：2026-05-05  
状态：POSTGRESQL_PRODUCTION_LITE_BASELINE

当前多人版本默认使用 PostgreSQL + Prisma。用户、权限、session、客户、客户联系人、客户附件元数据、字段配置和审计日志都保存到 PostgreSQL。
客户名称判重使用 `CustomerIdentity` 和 `CustomerDuplicateReviewRequest` 持久化，不能只靠前端校验或简单 `Customer.name unique`。

## 生产路径

- PostgreSQL 是 production / admin trial / salesperson usage 默认数据库。
- Prisma 是当前 ORM 和 migration 工具。
- `DATABASE_URL` 必须指向 PostgreSQL。阿里云 ECS + RDS 路线使用 RDS 内网地址。
- `DIRECT_URL` 可与 `DATABASE_URL` 相同，供 Prisma migration / seed 使用。
- 不同电脑登录后，应看到同一套数据库数据。
- 部署后执行 `npx prisma migrate deploy` 和 `npm run db:seed`。其中 `db:seed` 是生产安全 seed，只维护权限字典和缺失的系统字段定义，不创建用户，不修改用户，不修改客户。
- 默认账号初始化必须单独执行 `ALLOW_DEFAULT_USER_BOOTSTRAP=true npm run db:bootstrap-default-users`，且只允许首次 demo/dev 初始化或人工确认的空库初始化。
- 生产环境只允许执行 `npx prisma migrate deploy` 应用已经提交的 migration。
- 生产环境禁止执行 `npx prisma migrate reset`、`npx prisma db push --force-reset`、`npx prisma migrate dev`。
- 生产部署禁止自动执行默认用户 bootstrap、客户 backfill 或任何会创建/修改业务数据的脚本。
- 客户国家 / 地区、州 / 省、城市同时保存 code 和 name：`countryCode`、`countryName`、`stateCode`、`stateName`、`cityName`。
- 国家 / 地区统一使用中文名称展示，并保存 `countryCode` 作为稳定查询值。
- 地址层级只做到国家 / 地区 → 州 / 省 → 城市，不做区县、街道或更细行政层级。
- 旧 `country` / `city` 字段继续保留兼容，详情和列表优先显示新字段，缺失时 fallback 到旧字段。
- 管理员可以修改自定义字段类型；系统字段类型默认锁定。
- 字段类型 UI 显示中文，内部值仍为 `text` / `textarea` / `number` / `date` / `select` / `boolean`。
- 修改自定义字段类型不会清空客户 `customFields` 历史值。
- 客户档案支持多个联系人，联系人数据保存到 `CustomerContact`。
- 客户档案支持附件记录，附件元数据保存到 `CustomerAttachment`。
- 当前附件第一版使用附件链接，`storageProvider=external_url`。
- 客户名称默认不允许重复。
- 系统会对客户名称执行规范化：trim、Unicode NFKC、转小写、删除空白、删除常见标点和符号。
- 加点、加空格、大小写变化、全角半角变化不能绕过重复客户检测。
- 重复客户必须提交业务经理 / 管理员审核；审核通过后才允许例外建档。
- 重复客户检测、提交审核、审核通过、审核拒绝和例外建档都会写入 `AuditLog`。
- 不把文件二进制或 base64 存入 PostgreSQL。
- 未配置阿里云 OSS / 对象存储前，不做真实文件上传。
- 不使用 ECS 本地磁盘作为长期正式附件存储。

## 地理数据来源

- 数据包：`@countrystatecity/countries`
- License：`ODbL-1.0`
- 使用方式：只在服务端 route handler / server adapter 中按需读取，前端通过 `/api/geo/countries`、`/api/geo/states`、`/api/geo/cities` 懒加载。
- 前端不直接 import 该 server-side 数据包，也不一次性加载全部城市数据。
- 如未来对外分发、公开数据或再发布衍生数据库，需要按 ODbL 的 attribution、share-alike、keep open 要求做法务复核。

## Session

- 登录成功后写入 httpOnly cookie。
- production HTTPS 环境 cookie 使用 `secure`。
- `SESSION_COOKIE_SECURE=true` 表示强制 secure cookie；临时 IP + HTTP 测试可设为 `false`，正式上线必须为 `true`。
- `SameSite` 使用 `Lax`。
- 数据库只保存 `sessionTokenHash`，不保存明文 session token。
- logout 后当前 session 写入 `revokedAt`。
- 停用用户后不能继续访问内部页面。

## 密码

- 数据库保存 `passwordHash`。
- 当前 MVP 使用 Node `crypto.pbkdf2` hash。
- 不允许明文、base64 或普通 sha256 存储密码。

## localStorage

localStorage 只保留为历史 demo / test adapter：

- 不用于 production。
- 不用于管理员试用版本。
- 不用于业务员正式填写版本。
- 不作为多人共享数据源。

历史 demo / test adapter 可以用于快速领域测试，但线上页面和服务端 action 必须走 PostgreSQL + Prisma。

## SQLite

SQLite 只能作为本地开发、demo adapter 或 test adapter 的临时选择，不能作为 production-lite 默认，也不能写成多人上线方案。

## 本地 PostgreSQL 与 CI

- 本地 Docker Compose 提供 `kingaos_dev` 和 `kingaos_test` 两套 PostgreSQL。
- `kingaos_dev` 暴露在本机端口 `5433`，用于开发 migration。
- `kingaos_test` 暴露在本机端口 `5434`，用于测试已提交 migration。
- GitHub Actions 每次 push 或 pull request 会启动 PostgreSQL，执行 `migrate deploy`、安全 `db:seed`、测试用户 bootstrap、`typecheck`、`test`、`build`。
- 数据库变更必须先本地 Docker PostgreSQL 验证，再通过 CI，最后才允许上生产。
