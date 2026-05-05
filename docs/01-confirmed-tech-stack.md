# 01｜KingaOS 已确认技术栈

确认日期：2026-05-05  
状态：LOCKED_FOR_CURRENT_PHASE

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

## 当前不使用

- 不接 Drizzle
- 不接 Supabase
- 不接 MySQL
- 不使用 SQLite 作为 production / admin trial / salesperson usage 默认数据库
- 不使用 localStorage 作为 production / admin trial / salesperson usage 数据源
- 不做 monorepo
- 不做 Turborepo
- 不迁移 pnpm
- 不迁移 yarn
- 不随意升级 Next / React
- 不引入微服务或 Kubernetes

## 包管理器

必须使用 npm。不要使用 pnpm 或 yarn。仓库只保留 `package-lock.json`，不得新增 `pnpm-lock.yaml` 或 `yarn.lock`。

## 当前代码分层

- `app/**`：route、app shell、页面入口。
- `components/**`：UI 展示和交互组合。
- `lib/honoa/**`：KingaOS 业务核心、domain types、domain actions、repository adapter、boundary contracts。
- `prisma/**`：PostgreSQL schema、migration、seed。
- `tests/domain/honoa/**`：领域测试、contract tests、cross-slice boundary tests。
- `tests/e2e/**`：Playwright smoke tests。

Next.js 不拥有业务事实；页面不能直接读写持久化数据，也不能绕过 domain action、服务端权限校验或 Prisma-backed service。
