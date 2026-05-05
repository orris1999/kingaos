# KingaOS 技术栈与架构执行基线 v1

确认日期：2026-05-05

本合并版引用：

- [01-confirmed-tech-stack.md](./01-confirmed-tech-stack.md)
- [02-architecture-baseline.md](./02-architecture-baseline.md)
- [03-module-boundaries-and-redlines.md](./03-module-boundaries-and-redlines.md)
- [04-current-persistence-stage.md](./04-current-persistence-stage.md)
- [05-roadmap-and-phase-gates.md](./05-roadmap-and-phase-gates.md)
- [06-multiplayer-deploy-notes.md](./06-multiplayer-deploy-notes.md)

硬口径摘要：

```text
Next.js 15 + React 18 + TypeScript + npm + Vitest + Playwright
Prisma + PostgreSQL + server session/httpOnly cookie + server-side permission + Domain Action
业务核心：lib/honoa/**
测试：tests/domain/honoa/** 和 tests/e2e/**
production/admin trial/salesperson usage 默认走 PostgreSQL，不走 localStorage 或 SQLite。
```

当前真实开放范围：

```text
KingaOS -> 登录 / 权限 / 用户管理 / 出口部 -> 客户档案
```

出口部客户档案当前包括：

- 客户基础资料。
- 国家 / 地区 → 州 / 省 / 地区 → 城市联动选择，地理数据通过服务端 API 按需加载。
- 新建 / 编辑客户分步骤填写，详情页分区 tab 展示。
- 多联系人维护，支持主要联系人。
- 附件链接记录，暂不做真实文件上传。
- 字段配置，字段类型 UI 显示中文，内部值保持英文枚举。

地理数据红线：

- 当前数据源为 `@countrystatecity/countries`，License 为 `ODbL-1.0`。
- 前端不能直接 import 全量地理数据包。
- 城市数据必须按国家 / 州省懒加载，避免把全量城市数据打进客户端 bundle。
- 如未来对外分发或再发布衍生数据库，需要复核 ODbL attribution / share-alike / keep open 要求。

附件红线：

- 不把文件二进制存入 PostgreSQL。
- 不把 base64 存入 PostgreSQL。
- 不把 ECS 本地磁盘作为长期正式附件存储。
- 真实上传后续接入阿里云 OSS / 对象存储。

FinancePricing 当前只保留入口、权限和架构红线，不实现真实功能。
