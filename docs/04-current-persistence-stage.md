# 04｜当前持久化阶段

确认日期：2026-05-05  
状态：POSTGRESQL_PRODUCTION_LITE_BASELINE

当前多人版本默认使用 PostgreSQL + Prisma。用户、权限、session、客户、字段配置和审计日志都保存到 PostgreSQL。

## 生产路径

- PostgreSQL 是 production / admin trial / salesperson usage 默认数据库。
- Prisma 是当前 ORM 和 migration 工具。
- `DATABASE_URL` 必须指向 PostgreSQL。阿里云 ECS + RDS 路线使用 RDS 内网地址。
- `DIRECT_URL` 可与 `DATABASE_URL` 相同，供 Prisma migration / seed 使用。
- 不同电脑登录后，应看到同一套数据库数据。
- 部署后执行 `npx prisma migrate deploy` 和 `npm run db:seed` 初始化结构和初始账号。

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
