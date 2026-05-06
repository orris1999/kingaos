# 04｜当前持久化阶段

确认日期：2026-05-05  
状态：POSTGRESQL_PRODUCTION_LITE_BASELINE

当前多人版本默认使用 PostgreSQL + Prisma。用户、权限、session、客户、客户联系人、客户附件元数据、字段配置、客户字段修改历史、财务官方收款账号和审计日志都保存到 PostgreSQL。真实附件文件保存到私有阿里云 OSS Bucket。
客户名称判重使用 `CustomerIdentity` 和 `CustomerDuplicateReviewRequest` 持久化，不能只靠前端校验或简单 `Customer.name unique`。

## 生产路径

- PostgreSQL 是 production / admin trial / salesperson usage 默认数据库。
- Prisma 是当前 ORM 和 migration 工具。
- `DATABASE_URL` 必须指向 PostgreSQL。阿里云 ECS + RDS 路线使用 RDS 内网地址。
- `DIRECT_URL` 可与 `DATABASE_URL` 相同，供 Prisma migration / seed 使用。
- 不同电脑登录后，应看到同一套数据库数据。
- 部署后自动流程只执行 `npx prisma migrate deploy`。`npm run db:seed` 必须单独执行，且只维护权限字典和缺失的系统字段定义，不创建/修改/删除用户，不创建/修改/删除客户。
- 默认账号初始化必须单独执行 `ALLOW_DEFAULT_USER_BOOTSTRAP=true npm run db:bootstrap-default-users`，且只允许首次 demo/dev 初始化或人工确认的空库初始化。生产环境还必须设置 `BOOTSTRAP_DEFAULT_USERS_CONFIRM=I_UNDERSTAND_THIS_CREATES_USERS`；如库内已有非默认用户，还必须设置 `BOOTSTRAP_NON_DEFAULT_USERS_CONFIRM=I_UNDERSTAND_THIS_DATABASE_ALREADY_HAS_USERS`。
- 生产环境只允许执行 `npx prisma migrate deploy` 应用已经提交的 migration。
- 生产环境禁止执行 `npx prisma migrate reset`、`npx prisma db push --force-reset`、`npx prisma migrate dev`。
- 生产部署禁止自动执行默认用户 bootstrap、客户 backfill 或任何会创建/修改业务数据的脚本。
- 客户国家 / 地区、州 / 省、城市同时保存 code 和 name：`countryCode`、`countryName`、`stateCode`、`stateName`、`cityName`。
- 国家 / 地区统一使用中文名称展示，并保存 `countryCode` 作为稳定查询值。
- 地址层级只做到国家 / 地区 → 州 / 省 → 城市，不做区县、街道或更细行政层级。
- 旧 `country` / `city` 字段继续保留兼容，详情和列表优先显示新字段，缺失时 fallback 到旧字段。
- 管理员可以修改自定义字段类型；系统字段类型默认锁定。
- 客户来源按自定义字段配置管理，可调整类型、分组、必填和选项；旧 `Customer.source` 字段继续保留兼容历史客户数据。
- 字段类型 UI 显示中文，内部值仍为 `text` / `textarea` / `number` / `date` / `select` / `boolean`。
- 修改自定义字段类型不会清空客户 `customFields` 历史值。
- 客户档案支持多个联系人，联系人数据保存到 `CustomerContact`。
- 客户档案支持附件记录，附件元数据保存到 `CustomerAttachment`。
- 财务官方收款账号保存到 `CompanyReceiptAccount`，属于财务维护的主数据。
- 客户默认收款方案只保存 `defaultReceiptAccountId` 引用及选择人、选择时间、备注，不把银行账号全文复制进 `Customer`。
- 业务员只能在客户档案中选择有效官方收款方案，不能手填银行账号；停用账号不能作为新的默认方案。
- 已引用停用账号的客户继续保留历史引用，并在详情页提示“当前默认收款账号已停用，请重新选择有效账号”。
- 未来合同可以从客户档案带出官方收款账号，但合同模块必须保存账号快照；当前阶段不做合同生成。
- 客户字段修改历史保存到 `CustomerFieldChangeHistory`，记录关键字段、自定义字段和默认收款方案的原值、新值、修改人和修改时间。
- 修改历史跟随客户查看权限：当前负责人可看自己客户历史，客户转给新负责人后新负责人可看过去历史，出口部经理 / 有全部客户查看权限的管理员可看出口部客户历史。
- 历史记录只用于内部追溯，不对外展示；本阶段不做字段回滚、版本恢复、联系人字段级历史或附件字段级历史。
- 默认收款方案历史只保存方案名称、账号编号和收款账号 ID，不保存完整银行账号全文。
- 客户附件支持 `storageProvider=aliyun_oss` 的真实文件上传；PostgreSQL 只保存 `storageKey`、MIME、大小、上传人等元数据。
- OSS Bucket 必须私有；上传使用服务端生成的短时 PUT 预签名 URL，下载 / 预览使用服务端生成的短时 GET 预签名 URL。
- 阿里云 AccessKey 只能在服务端 `.env` 使用，不能暴露到浏览器，不能使用 `NEXT_PUBLIC_*`。
- 新增附件不再使用旧“附件链接”提交入口；历史 `storageProvider=external_url` 附件仅保留兼容展示和下载。
- 附件类型配置保存在 `CustomerFieldConfig(moduleKey=export_customer_attachment, fieldKey=attachmentType)`，由拥有字段配置权限的管理员 / 超级管理员维护。
- 客户名称默认不允许重复。
- 系统会对客户名称执行规范化：trim、Unicode NFKC、转小写、删除空白、删除常见标点和符号。
- 加点、加空格、大小写变化、全角半角变化不能绕过重复客户检测。
- 重复客户必须提交业务经理 / 管理员审核；审核通过后才允许例外建档。
- 重复客户检测、提交审核、审核通过、审核拒绝和例外建档都会写入 `AuditLog`。
- 不把文件二进制或 base64 存入 PostgreSQL。
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
- GitHub Actions 每次 push 或 pull request 会启动 PostgreSQL，执行 `migrate deploy`、安全 `db:seed`、`typecheck`、`test`、`build`。CI 中的 `db:seed` 不能创建默认用户或客户。
- 数据库变更必须先本地 Docker PostgreSQL 验证，再通过 CI，最后才允许上生产。
