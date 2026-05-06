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
```

出口部客户档案当前包括：

- 客户基础资料。
- 国家 / 地区 → 州 / 省 → 城市联动选择，国家统一显示中文，地理数据通过服务端 API 按需加载。
- 地址层级不做区县、街道或更细行政层级。
- 新建 / 编辑客户分步骤填写，详情页分区 tab 展示。
- 多联系人维护，支持主要联系人。
- 阿里云 OSS 私有 Bucket 附件上传，附件链接 fallback 继续保留。
- 字段配置，字段类型 UI 显示中文，内部值保持英文枚举。
- 自定义字段允许管理员修改字段类型，系统字段类型默认锁定，修改类型不会清空历史客户 `customFields`。
- 客户来源按自定义字段配置管理，旧 `Customer.source` 字段保留兼容。
- 客户名称默认不允许重复；服务端按规范化名称判重，加点、加空格、大小写和全角半角变化不能绕过。
- 重复客户必须提交业务经理 / 管理员审核，审核通过后才允许例外建档，并写入 AuditLog。

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
