# KingaOS 技术栈与架构执行基线 v1

确认日期：2026-05-05

本合并版引用：

- [01-confirmed-tech-stack.md](./01-confirmed-tech-stack.md)
- [02-architecture-baseline.md](./02-architecture-baseline.md)
- [03-module-boundaries-and-redlines.md](./03-module-boundaries-and-redlines.md)
- [04-current-persistence-stage.md](./04-current-persistence-stage.md)
- [05-roadmap-and-phase-gates.md](./05-roadmap-and-phase-gates.md)
- [06-multiplayer-deploy-notes.md](./06-multiplayer-deploy-notes.md)
- [07-local-postgres-and-ci.md](./07-local-postgres-and-ci.md)
- [08-production-data-safety.md](./08-production-data-safety.md)

硬口径摘要：

```text
Next.js 15 + React 18 + TypeScript + npm + Vitest + Playwright
Prisma + PostgreSQL + server session/httpOnly cookie + server-side permission + Domain Action
业务核心：lib/honoa/**
测试：tests/domain/honoa/** 和 tests/e2e/**
production/admin trial/salesperson usage 默认走 PostgreSQL，不走 localStorage 或 SQLite。
本地 Docker PostgreSQL：kingaos_dev:5433，kingaos_test:5434。
GitHub Actions 每次 push / pull request 自动执行 migration、seed、typecheck、test、build。
生产环境只允许 npx prisma migrate deploy，禁止 migrate reset / db push --force-reset / migrate dev。
生产 db:seed 必须是安全 seed，不创建/修改/删除用户，不创建/修改/删除客户。
默认用户 bootstrap 和客户 backfill 必须人工显式执行，不能放进部署脚本；backfill 默认 dry-run，写入必须强确认。
```

当前真实开放范围：

```text
KingaOS -> 登录 / 权限 / 用户管理 / 出口部 -> 客户档案
KingaOS -> 财务部 -> 收款账号管理（小型财务主数据入口）
```

出口部客户档案当前包括：

- 客户基础资料。
- 国家 / 地区 → 州 / 省 → 城市联动选择，国家统一显示中文，地理数据通过服务端 API 按需加载。
- 地址层级不做区县、街道或更细行政层级。
- 新建 / 编辑客户分步骤填写，详情页分区 tab 展示。
- 页面统一显示“公司名称”，内部字段仍使用 `Customer.name`；旧 `Customer.companyName` 只保留兼容，不在公司信息里重复填写。
- `已归档` 在 UI 上显示为“资料已完善”，不代表客户停止合作。
- 必填字段有红色 `*`、浅色底和“必填”标识；只读字段有灰底和“只读”/“系统生成”提示。
- 客户列表使用横向滚动表格和固定最小宽度，避免表头、操作列和多选值被压缩成逐字换行。
- 新建 / 编辑客户采用步骤卡片和两列基础信息布局；客户类型多选使用紧凑控件，选择结果以标签展示。
- 默认收款方案详情是财务维护、业务只读；列表中只显示方案名、账号编号和有效 / 已停用状态。
- 新建客户时附件需要保存后上传，保存后在详情 / 编辑页面继续添加附件。
- 多联系人维护，支持主要联系人。
- 阿里云 OSS 私有 Bucket 附件上传；附件字段也支持添加外部附件链接，历史附件链接保留兼容。
- 附件类型由管理员 / 超级管理员在字段配置页维护。
- 字段配置，字段类型 UI 显示中文，内部值保持英文枚举：`text` / `textarea` / `number` / `date` / `select` / `multiselect` / `boolean` / `url` / `attachment`。
- 客户类型支持多选，旧单值 `Customer.customerType` 继续保留兼容，新字段 `Customer.customerTypes` 保存多个业务属性。
- 字段配置支持多选、超链接和附件字段；下拉 / 多选选项可以配置内部说明，内部说明只在填写页面显示，不进入详情页或未来对外客户信息卡。
- 附件字段复用 `CustomerAttachment` 和 OSS 上传能力，`customFields` 只保存附件 ID 引用，不保存文件二进制、base64 或临时 uploadUrl。
- 自定义字段允许管理员修改字段类型，系统字段类型默认锁定，修改类型不会清空历史客户 `customFields`。
- 客户来源按自定义字段配置管理，旧 `Customer.source` 字段保留兼容。
- 公司名称默认不允许重复；服务端按内部 `Customer.name` 的规范化名称判重，加点、加空格、大小写和全角半角变化不能绕过。
- 重复客户必须提交业务经理 / 管理员审核，审核通过后才允许例外建档，并写入 AuditLog。
- 客户默认收款方案：业务员只能选择财务维护的有效官方账号，不能手填银行账号。
- 字段修改历史：关键字段、自定义字段和默认收款方案变化写入 `CustomerFieldChangeHistory`，记录谁改的、何时改、原值和新值。
- 修改历史跟随客户查看权限；客户转给新负责人后，新负责人可以看到该客户过去历史，出口部经理可以看到出口部客户历史。
- 修改历史只用于内部，不对外展示；当前不做字段回滚、版本恢复或联系人字段级历史。附件字段只记录附件数量 / 引用变化，不记录文件内容或临时 URL。
- 默认收款方案历史不保存完整银行账号全文，只保存方案名称、账号编号和收款账号 ID。

财务官方收款账号当前包括：

- `CompanyReceiptAccount` 主数据，由财务 / 授权管理员维护。
- 客户档案只保存默认收款方案引用，不复制银行账号全文。
- 停用账号不能作为新的默认收款方案；已引用客户保留历史引用并显示停用提醒。
- 财务账号详情页显示当前引用该账号的客户摘要；停用账号前提示受影响客户数量。
- 系统不会自动清空或自动替换客户默认收款方案；批量替换账号不在当前范围。
- 提供 `formatReceiptAccountForContract` helper 作为未来合同格式参考，但当前不做合同生成、不做订单、不做完整财务系统。

地理数据红线：

- 当前数据源为 `@countrystatecity/countries`，License 为 `ODbL-1.0`。
- 前端不能直接 import 全量地理数据包。
- 城市数据必须按国家 / 州省懒加载，避免把全量城市数据打进客户端 bundle。
- 如未来对外分发或再发布衍生数据库，需要复核 ODbL attribution / share-alike / keep open 要求。

附件红线：

- 不把文件二进制存入 PostgreSQL。
- 不把 base64 存入 PostgreSQL。
- 不把 ECS 本地磁盘作为长期正式附件存储。
- PostgreSQL 只保存附件元数据和 OSS `storageKey`。
- OSS Bucket 必须私有，上传和下载 / 预览都通过服务端生成短时预签名 URL。
- 阿里云 AccessKey 只允许服务端使用，不能暴露到前端。

FinancePricing 当前只保留入口、权限和架构红线，不实现真实功能。
