# Quote Source Upload Pilot｜财务报价表文件上传试点

日期：2026-05-14

本轮只实现 Finance 侧报价表文件上传和文件 metadata 记录。上传报价表不等于导入价格，不等于 `FinanceApprovedPrice`，也不会生成报价草稿或正式报价。

## 业务边界

- 报价表、成本表和价格候选数据由财务提交和维护。
- 出口部不能上传报价表，不能维护价格表。
- 当前页面仅 `super_admin` 可用；未来如果开放给财务人员，需要单独新增 `finance.quote_source_upload.manage` 权限和 seed。
- 上传文件只作为后续 dry-run / staging / Export 草稿消费链路的原始文件来源。
- 正式报价必须后续接 FinancePricing，不能由上传文件直接形成。

## 页面

- 路径：`/finance/quote-source-upload`
- Finance 首页入口：`报价表上传`
- 状态：`Pilot`

页面必须持续显示：

- 本页面只上传财务报价表文件。
- 当前不导入价格，不生成报价草稿，不生成正式报价。
- 上传文件不是财务批准价格，也不是正式价格表。
- 出口部不能上传或维护报价表。

## 文件范围

第一版只允许：

- `.xls`
- `.xlsx`

单文件上限：50MB。

不允许上传脚本、网页、可执行文件或其它非报价表文件。CSV 暂不开放。

## 存储和 metadata

文件上传到私有 OSS：

- OSS AccessKey 只在服务端使用。
- 不使用 `NEXT_PUBLIC_` OSS 变量。
- 不把文件保存到 PostgreSQL。
- 不把文件保存到 ECS 本地磁盘。
- 不把 base64 保存到数据库。

数据库只保存 `QuoteSourceUpload` 文件 metadata：

- 文件名、原始文件名、扩展名、MIME、大小。
- `storageProvider = aliyun_oss`
- OSS `storageKey`
- `uploadStatus = uploaded`
- 可选 `adapterId` / `category`
- `submittedByRole = finance`
- `consumerDepartment = export`
- 上传人和上传时间。
- notes / 脱敏 warnings。

数据库不保存：

- 价格金额。
- 成本价、报价价、底价、毛利。
- KJ 行数据。
- OEM 行数据。
- Excel 内容。
- staging batch / rows。
- QuoteDraft / QuoteDraftLine。

## API

本轮新增 Finance 上传 API route：

- `POST /api/finance/quote-source-upload/upload-url`
- `POST /api/finance/quote-source-upload`

两者都必须：

- 要求当前登录用户。
- 只允许 `super_admin`。
- 不新增 permission key。
- 不运行 seed。

`upload-url` 只生成私有 OSS PUT signed URL，不读取文件内容。

metadata 保存 route 只保存上传记录，不解析 Excel，不调用 dry-run，不创建 staging。

## AuditLog

写入：

- `quote_source_upload.upload_url.generate`
- `quote_source_upload.create`

metadata 允许包含：

- uploadId
- sourceFileName
- storageProvider
- storageKey
- fileSize
- uploadedByUserId

metadata 禁止包含：

- 价格。
- 底价。
- 毛利。
- Excel 行数据。

## 后续阶段

后续必须分阶段推进：

1. Finance dry-run 读取上传文件并做结构识别。
2. Finance staging batch / rows 生成。
3. Finance confirmation。
4. Export 只读消费 `finance_confirmed + export_draft_candidate` 脱敏候选。
5. FinancePricing 接入后才可能形成正式价格和正式报价。

009A 不实现上述任何导入、确认、报价或审批动作。
