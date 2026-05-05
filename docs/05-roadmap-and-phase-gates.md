# 05｜路线图和阶段门

## 当前阶段

目标：验证 KingaOS app shell、登录、权限、用户管理、出口部客户档案和字段配置。

技术：Next.js 15 + React 18 + TypeScript + npm + Prisma + PostgreSQL + 服务端 session / httpOnly cookie + 服务端权限校验 + Vitest + Playwright + Domain Action。

## 当前上线门

多人试用前必须满足：

1. `DATABASE_URL` 指向可用 PostgreSQL。
2. `SESSION_SECRET` 使用足够长的随机值。
3. `npx prisma migrate deploy` 执行成功。
4. `npm run db:seed` 执行成功。
5. `npm run typecheck`、`npm run test`、`npm run build` 通过。
6. super_admin 可用 `superadmin@kingaos.local / roserose` 登录。
7. 未开放模块只能显示入口或未开放页面，不能进入真实功能。

## 需要 ADR 的变化

- 更换 PostgreSQL / Prisma 之外的 production 数据库或 ORM。
- 引入 monorepo / Turborepo。
- 从 npm 迁移 pnpm 或 yarn。
- 升级 Next.js / React major。
- 实现真实 FinancePricing。
- 实现报价、订单、完整 CRM、完整 ERP。
