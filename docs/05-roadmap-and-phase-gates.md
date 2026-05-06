# 05｜路线图和阶段门

## 当前阶段

目标：验证 KingaOS app shell、登录、权限、用户管理、出口部客户档案、客户多联系人、OSS 附件记录、字段配置、客户字段修改历史，以及财务维护官方收款账号、客户选择默认收款方案这一小型主数据闭环。

技术：Next.js 15 + React 18 + TypeScript + npm + Prisma + PostgreSQL + 服务端 session / httpOnly cookie + 服务端权限校验 + Vitest + Playwright + Domain Action。

数据库变更门禁：先在本地 Docker PostgreSQL 验证，再通过 GitHub Actions，最后才允许部署生产。生产环境只允许 `npx prisma migrate deploy`，禁止 `npx prisma migrate reset`、`npx prisma db push --force-reset`、`npx prisma migrate dev`。

生产部署 seed 必须是安全 seed：不创建、修改、删除用户；不创建、修改、删除客户。默认用户 bootstrap、客户 backfill 只能人工显式执行，不能作为部署脚本的一部分。Backfill 默认必须 dry-run，写入前必须强确认。

## 当前上线门

多人试用前必须满足：

1. `DATABASE_URL` 指向可用 PostgreSQL。
2. `SESSION_SECRET` 使用足够长的随机值。
3. `npx prisma migrate deploy` 执行成功。
4. 如需补系统字典，生产安全 `npm run db:seed` 单独执行成功，且没有创建/修改/删除用户或客户。
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
- 客户附件使用阿里云 OSS 私有 Bucket 真实上传，PostgreSQL 只保存元数据。
- 新增附件不再使用旧附件链接提交入口；历史附件链接数据保留兼容。
- 附件类型由管理员 / 超级管理员在字段配置页维护。
- 字段类型 UI 显示中文；内部值仍使用 `text` / `textarea` / `number` / `date` / `select` / `boolean`。
- 管理员可以修改自定义字段类型，系统字段类型默认锁定，修改类型不会清空历史 `customFields`。
- 客户来源作为自定义配置字段管理，仍保留旧 `Customer.source` 兼容历史数据。
- 客户名称默认不允许重复；服务端通过规范化名称阻止加点、加空格、大小写变化和全角半角变化绕过。
- 重复客户必须提交业务经理 / 管理员审核，审核通过后才允许例外建档，并保留 AuditLog。
- 客户可以选择一个财务维护的默认收款方案；业务员只能选择有效方案，不能手填银行账号。
- 财务可以维护官方收款账号、启用 / 停用账号；停用账号保留历史引用，并在客户详情提示重新选择。
- 当前只提供未来合同输出格式 helper，不做合同生成、不做订单、不做完整财务系统。
- 关键字段、自定义字段和默认收款方案变化会写入客户字段修改历史。
- 修改历史跟随客户查看权限，客户转给新负责人后新负责人可以看到过去历史；历史记录只给内部人员查看。
- 当前不做字段回滚 / 版本恢复，也不做联系人或附件字段级历史。

## 需要 ADR 的变化

- 更换 PostgreSQL / Prisma 之外的 production 数据库或 ORM。
- 引入 monorepo / Turborepo。
- 从 npm 迁移 pnpm 或 yarn。
- 升级 Next.js / React major。
- 实现真实 FinancePricing。
- 实现报价、订单、完整 CRM、完整 ERP。
- 实现合同生成、合同快照或收款账号进入合同自动出具流程。
- 更换地理数据源或对外分发地理数据库。
