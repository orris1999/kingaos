# 05｜路线图和阶段门

## 当前阶段

目标：验证 KingaOS app shell、登录、权限、用户管理、出口部客户档案、客户多联系人、附件链接记录和字段配置。

技术：Next.js 15 + React 18 + TypeScript + npm + Prisma + PostgreSQL + 服务端 session / httpOnly cookie + 服务端权限校验 + Vitest + Playwright + Domain Action。

数据库变更门禁：先在本地 Docker PostgreSQL 验证，再通过 GitHub Actions，最后才允许部署生产。生产环境只允许 `npx prisma migrate deploy`，禁止 `npx prisma migrate reset`、`npx prisma db push --force-reset`、`npx prisma migrate dev`。

生产部署 seed 必须是安全 seed：不创建用户、不修改用户、不创建客户、不修改客户。默认用户 bootstrap、客户 backfill 只能人工显式执行，不能作为部署脚本的一部分。

## 当前上线门

多人试用前必须满足：

1. `DATABASE_URL` 指向可用 PostgreSQL。
2. `SESSION_SECRET` 使用足够长的随机值。
3. `npx prisma migrate deploy` 执行成功。
4. 生产安全 `npm run db:seed` 执行成功，且没有创建/修改用户或客户。
5. `npm run typecheck`、`npm run test`、`npm run build` 通过。
6. super_admin 可用 `superadmin@kingaos.local / roserose` 登录。
7. 未开放模块只能显示入口或未开放页面，不能进入真实功能。
8. GitHub Actions 已使用 PostgreSQL 完成 migration、seed、typecheck、test、build。

## 当前客户档案能力

- 国家 / 地区 → 州 / 省 → 城市联动选择，城市数据不完整时允许手动输入。
- 国家 / 地区统一显示中文；内部仍保存 `countryCode`。
- 地址不做区县、街道或更细行政层级。
- 新建 / 编辑客户采用分步骤填写：基础信息、联系人信息、公司信息、合作信息、附件与备注、确认并保存。
- 客户详情采用分区 tab 展示：基础信息、联系人、公司信息、合作信息、附件与备注、操作记录。
- 客户可以维护多个联系人，并设置一个主要联系人。
- 客户列表只展示主要联系人，如果没有主要联系人则展示第一个联系人。
- 客户附件第一版只支持附件链接和说明。
- 真实文件上传需要在后续对象存储阶段接入阿里云 OSS。
- 字段类型 UI 显示中文；内部值仍使用 `text` / `textarea` / `number` / `date` / `select` / `boolean`。
- 管理员可以修改自定义字段类型，系统字段类型默认锁定，修改类型不会清空历史 `customFields`。
- 客户名称默认不允许重复；服务端通过规范化名称阻止加点、加空格、大小写变化和全角半角变化绕过。
- 重复客户必须提交业务经理 / 管理员审核，审核通过后才允许例外建档，并保留 AuditLog。

## 需要 ADR 的变化

- 更换 PostgreSQL / Prisma 之外的 production 数据库或 ORM。
- 引入 monorepo / Turborepo。
- 从 npm 迁移 pnpm 或 yarn。
- 升级 Next.js / React major。
- 实现真实 FinancePricing。
- 实现报价、订单、完整 CRM、完整 ERP。
- 实现真实附件上传或引入对象存储。
- 更换地理数据源或对外分发地理数据库。
