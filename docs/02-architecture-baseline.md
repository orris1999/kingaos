# 02｜KingaOS 架构执行基线

KingaOS 是坤江内部业务操作系统，不是单独的客户档案小工具，不是完整 CRM，也不是完整 ERP。

## 当前真实开放范围

```text
KingaOS
└── 出口部
    └── 客户档案
```

今天真实开放：

- 登录
- 退出
- super_admin 用户管理
- 权限管理
- 出口部客户档案
- 出口部客户档案字段配置

## Next.js 职责

Next.js 只作为：

- app shell
- UI workbench
- 路由
- 页面渲染
- 表单入口

Next.js 不拥有业务事实。客户可见性、字段配置、用户权限等业务规则必须进入 `lib/honoa/**` 的 Domain Action / service。

## 当前持久化与权限

- PostgreSQL + Prisma 是当前多人共享 MVP 的默认持久化路径。
- 登录、退出、权限判断、用户管理、客户档案、字段配置必须在服务端执行。
- 浏览器不能依赖 localStorage 判断登录状态或权限。
- 用户 session 使用 httpOnly cookie，数据库只保存 session token hash。
- 客户编号由服务端生成，并由数据库 unique constraint 兜底。

## 业务核心

业务核心放在：

- `lib/honoa/auth/**`
- `lib/honoa/users/**`
- `lib/honoa/permissions/**`
- `lib/honoa/customers/**`
- `lib/honoa/field-config/**`
- `lib/honoa/finance-pricing/**`
- `lib/honoa/server/**`
- `lib/honoa/shared/**`

## 测试

领域测试放在：

- `tests/domain/honoa/**`

E2E / smoke 测试放在：

- `tests/e2e/**`
