# Quote Task 003D｜财务报价表 dry-run 脱敏结构报告

日期：2026-05-12

本报告由 `npm run quote-source:dry-run -- --file ... --json` 对 8 份财务提交的报价表逐一执行本地 dry-run 后整理而成。dry-run 只读取显式指定文件的结构信息，包括文件名、文件类型、sheet 名称、used range、表头候选、adapter 匹配结果、字段映射和风险提示。

## 安全边界

- 报价表 / 成本表 / 价格候选数据由财务提交和维护。
- 出口部不能上传报价表，不能维护价格表，不能设置底价或毛利。
- 出口部只能消费财务提交的数据生成报价草稿。
- dry-run 不写数据库，不导入报价表，不生成报价草稿，不生成正式报价。
- 成本报价表只能作为 `priceCandidate` / `costCandidate` 来源候选，不是财务批准价格。
- 正式报价必须后续接入 FinancePricing。
- 本报告不包含具体 KJ 行、OEM 行、成本金额、报价金额、底价、毛利、客户价或完整 Excel 内容。

## 总览

| 文件 | adapterId | confidence | KJ | OEM/OE | 产品名称 | 成本候选列 | 报价候选列 | 包装列 | 图片策略 | V1 建议 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| 冷凝器成本报价表 | `condenser-cost-2026` | high | 是 | 否 | 是 | 是 | 否 | 是 | embedded_excel_image | 可进入后续 V1 KJ dry-run |
| 暖风成本报价表 | `heater-cost-2026` | high | 是 | 否 | 是 | 是 | 否 | 是 | none | 可进入后续 V1 KJ dry-run |
| 水箱成本报价表 | `radiator-cost-2026` | high | 是 | 是 | 是 | 是 | 否 | 是 | embedded_excel_image | 可进入 V1 但需重点处理复杂结构 |
| 蒸发器成本报价表 | `evaporator-cost-2026` | high | 是 | 否 | 是 | 是 | 否 | 是 | none | 可进入后续 V1 KJ dry-run |
| 中冷器成本报价表 | `intercooler-cost-2026` | high | 是 | 是 | 是 | 是 | 否 | 是 | embedded_excel_image | 可进入 V1 但需重点处理复杂结构 |
| 水室成本报价表 | `water-chamber-cost-2026` | high | 是 | 否 | 是 | 是 | 否 | 否 | none | 可进入后续 V1 KJ dry-run |
| 特殊包装及其他成本报价表 | `special-packaging-cost-2026` | high | 否 | 否 | 是 | 否 | 是 | 否 | none | 暂不进入产品 KJ V1；作为包装附加项候选 |
| 全铝自产机冷成本报价表 | `all-aluminum-oil-cooler-cost-2026` | high | 是 | 否 | 是 | 是 | 否 | 否 | none | 可进入 V1 但需单独产品线规则 |

## 单文件 dry-run 结构摘要

### 冷凝器成本报价表

- 文件名：`2026年5月11 出口部冷凝器成本报价表.xls`
- 文件类型：`xls`
- adapterId：`condenser-cost-2026`
- 匹配置信度：`high`
- submittedByRole：`finance`
- consumerDepartment：`export`
- sheet 数量：3
- 图片策略：`embedded_excel_image`
- 检测到 KJ 列：是
- 检测到 OEM / OE 列：否
- 检测到产品名称列：是
- 检测到成本候选列：是
- 检测到报价候选列：否
- 检测到包装列：是

Sheet / 表头候选：
- `Macro1`，usedRange `A2:A7`，表头候选：未识别
- `2026年冷凝器成本核算`，usedRange `A1:DA1813`，表头候选：KJ编码 / (孚盟)                 KJ-编码 / (ERP)        KJ-编码 / 鼎捷编码             (不保压) / 鼎捷编码             (保压) / 波距代码 / 波距 / 车型车系 / 芯体总成尺寸 / 纸箱尺寸(内尺寸) / 纸箱尺寸(外尺寸) / 2026.5.11出口成本 / 2026.5.11出口部内销成本 / 2026.4.10出口成本 / 2026.4.10出口部内销成本 / 备注
- `不能生产明细`，usedRange `A1:IV192`，表头候选：KJ编码 / KJ-编码 / 车型车系 / 芯体总成尺寸 / 备注

Mapped columns：
  - kjCode: KJ编码 / (孚盟)                 KJ-编码 / (ERP)        KJ-编码 / KJ-编码
  - erpCode: 鼎捷编码             (不保压) / 鼎捷编码             (保压)
  - productName: 车型车系
  - model: 车型车系
  - specification: 芯体总成尺寸 / 纸箱尺寸(内尺寸) / 纸箱尺寸(外尺寸) / 波距 / 波距代码
  - costPrice: 2026.5.11出口成本 / 2026.4.10出口成本 / 2026.5.11出口部内销成本 / 2026.4.10出口部内销成本
  - packaging: 纸箱尺寸(内尺寸) / 纸箱尺寸(外尺寸)
  - notes: 备注

Warnings：
  - 成本价不是财务批准价格，只能作为 priceCandidate，不能直接生成正式报价。
  - 报价表 / 成本表 / 价格候选数据必须由财务提交和维护，出口部不能上传或维护报价表。
  - Export 只能消费 dry-run / staging 结果生成报价草稿，不能维护价格表。
  - dry-run 不导入生产数据库，不自动批准价格，不生成正式报价。
  - Excel 嵌入图片不是稳定主图来源，后续需要 KJ 主图库。
  - OEM / OE 可能一对多，本阶段不做自动匹配。
  - 成本价不是财务批准价格，只能作为 priceCandidate。
  - 报价表由财务提交和维护，出口部不能上传或维护报价表。
  - 嵌入图片不是稳定主图来源。

Unsupported reasons：
  - 无

### 暖风成本报价表

- 文件名：`2026年5月11日 出口部暖风成本报价表.xls`
- 文件类型：`xls`
- adapterId：`heater-cost-2026`
- 匹配置信度：`high`
- submittedByRole：`finance`
- consumerDepartment：`export`
- sheet 数量：2
- 图片策略：`none`
- 检测到 KJ 列：是
- 检测到 OEM / OE 列：否
- 检测到产品名称列：是
- 检测到成本候选列：是
- 检测到报价候选列：否
- 检测到包装列：是

Sheet / 表头候选：
- `Macro1`，usedRange `A2:A7`，表头候选：未识别
- `2026年暖风成本核算`，usedRange `A1:EF300`，表头候选：KJ总编码 / 自产/外购 / KJ-编码 / KJ-编码    (ERP专用,目前公司生产的暖风都是波5产品) / KJ-编码(带弯管) / 鼎捷编码 / 鼎捷编码   (不带弯管) / 适用车型 / 车型类别 / 英文车型 / 芯体总成尺寸 / 纸箱尺寸(K=K) / 2026.5.11出口成本 / 2026.5.11出口部内销成本 / 2026.4.10出口成本 / 2026.4.10出口部内销成本 / 备注

Mapped columns：
  - kjCode: KJ总编码 / KJ-编码 / KJ-编码    (ERP专用,目前公司生产的暖风都是波5产品) / KJ-编码(带弯管)
  - erpCode: 鼎捷编码 / 鼎捷编码   (不带弯管)
  - productName: 适用车型 / 车型类别 / 英文车型
  - model: 适用车型 / 英文车型
  - specification: 芯体总成尺寸 / 纸箱尺寸(K=K)
  - category: 车型类别 / 自产/外购
  - costPrice: 2026.5.11出口成本 / 2026.4.10出口成本 / 2026.5.11出口部内销成本 / 2026.4.10出口部内销成本
  - packaging: 纸箱尺寸(K=K)
  - notes: 备注

Warnings：
  - 成本价不是财务批准价格，只能作为 priceCandidate，不能直接生成正式报价。
  - 报价表 / 成本表 / 价格候选数据必须由财务提交和维护，出口部不能上传或维护报价表。
  - Export 只能消费 dry-run / staging 结果生成报价草稿，不能维护价格表。
  - dry-run 不导入生产数据库，不自动批准价格，不生成正式报价。
  - Excel 嵌入图片不是稳定主图来源，后续需要 KJ 主图库。
  - OEM / OE 可能一对多，本阶段不做自动匹配。
  - 成本价不是财务批准价格，只能作为 priceCandidate。
  - 报价表由财务提交和维护，出口部不能上传或维护报价表。

Unsupported reasons：
  - 无

### 水箱成本报价表

- 文件名：`2026年5月11日 出口部水箱成本报价表.xlsx`
- 文件类型：`xlsx`
- adapterId：`radiator-cost-2026`
- 匹配置信度：`high`
- submittedByRole：`finance`
- consumerDepartment：`export`
- sheet 数量：5
- 图片策略：`embedded_excel_image`
- 检测到 KJ 列：是
- 检测到 OEM / OE 列：是
- 检测到产品名称列：是
- 检测到成本候选列：是
- 检测到报价候选列：否
- 检测到包装列：是

Sheet / 表头候选：
- `93it9k`，usedRange `A2:A7`，表头候选：未识别
- `2026年 水箱成本报价表`，usedRange `A1:BT8860`，表头候选：编码 / 旧 KJ.NO:   (孚盟编码) / 鼎捷编码             (不带水箱盖) / 鼎捷编码             (带水箱盖) / 车系 / PA/BA / 厚度PA/BA / 波距 / A/B / AT/MT / 车型 / 型号 / 规格 / 芯体 / 主板/水室 / 纸箱(内尺寸) / 2026.5.11出口成本报价 / 2026.5.11出口部内销成本报价 / 2026.4.10出口成本报价 / 2026.4.10出口部内销成本报价 / 备注 / 是否允限销 / 是否允限销备注 / 能否报价
- `不能生产`，usedRange `A1:W245`，表头候选：车系 / 厚度 / 波距 / AT/MT / 车型 / OEM / DPI / 规格 / 芯体 / 主板/水室 / 备注 / 编码
- `只做报价，不公布的报价表`，usedRange `A1:IR283`，表头候选：编码 / 旧 KJ.NO: / 原KJ.NO / 车系 / 厚度PA/BA / 波距 / A/B / AT/MT / 车型 / 型号 / OEM / DPI / 规格 / 芯体 / 主板/水室 / 纸箱(内尺寸) / 出口成本报价 / 出口部内销成本报价 / 2018.6.14出口成本报价 / 2018.6.14出口部内销成本报价 / 2018.6.2出口成本报价 / 2018.6.2出口部内销成本报价 / 备注 / 能否报价
- `徐芳芳 不保质，漏水不赔，需与客户说明情况`，usedRange `A1:CS22`，表头候选：原KJ.NO / 车系 / 厚度 / 波距 / A/B / AT/MT / 车型 / 型号 / OEM / DPI / 规格 / 芯体 / 主板/水室 / 纸箱(内尺寸) / 出口成本报价 / 出口部内销成本报价 / 2017-4出口成本报价 / 2017-4出口部内销成本报价 / 2016-12出口成本报价 / 2016-7-29出口成本报价 / 备注

Mapped columns：
  - kjCode: 编码
  - oldCode: 旧 KJ.NO:   (孚盟编码) / 原KJ.NO
  - erpCode: 鼎捷编码             (不带水箱盖) / 鼎捷编码             (带水箱盖)
  - fumacrmCode: 旧 KJ.NO:   (孚盟编码)
  - oemCode: OEM
  - model: 车系 / 车型 / 型号
  - specification: 规格 / 芯体 / 主板/水室 / 波距 / DPI / 厚度
  - category: PA/BA / 厚度PA/BA / A/B / AT/MT
  - costPrice: 2026.5.11出口成本报价 / 2026.4.10出口成本报价 / 2026.5.11出口部内销成本报价 / 2026.4.10出口部内销成本报价 / 出口成本报价 / 2017-4出口成本报价 / 2016-12出口成本报价 / 2016-7-29出口成本报价 / 出口部内销成本报价 / 2017-4出口部内销成本报价
  - packaging: 纸箱(内尺寸)
  - notes: 备注 / 是否允限销 / 是否允限销备注 / 能否报价

Warnings：
  - 成本价不是财务批准价格，只能作为 priceCandidate，不能直接生成正式报价。
  - 报价表 / 成本表 / 价格候选数据必须由财务提交和维护，出口部不能上传或维护报价表。
  - Export 只能消费 dry-run / staging 结果生成报价草稿，不能维护价格表。
  - dry-run 不导入生产数据库，不自动批准价格，不生成正式报价。
  - Excel 嵌入图片不是稳定主图来源，后续需要 KJ 主图库。
  - OEM / OE 可能一对多，本阶段不做自动匹配。
  - 成本价不是财务批准价格，只能作为 priceCandidate。
  - 报价表由财务提交和维护，出口部不能上传或维护报价表。
  - 水箱结构复杂，包含多个辅助 sheet、状态列、包装方案和公式列。
  - 嵌入图片不是稳定主图来源。

Unsupported reasons：
  - 无

### 蒸发器成本报价表

- 文件名：`2026年5月11日 出口部蒸发器成本报价表.xls`
- 文件类型：`xls`
- adapterId：`evaporator-cost-2026`
- 匹配置信度：`high`
- submittedByRole：`finance`
- consumerDepartment：`export`
- sheet 数量：2
- 图片策略：`none`
- 检测到 KJ 列：是
- 检测到 OEM / OE 列：否
- 检测到产品名称列：是
- 检测到成本候选列：是
- 检测到报价候选列：否
- 检测到包装列：是

Sheet / 表头候选：
- `Macro1`，usedRange `A2:A7`，表头候选：未识别
- `2026年蒸发器成本核算`，usedRange `A1:DX107`，表头候选：KJ总编码 / (孚盟)                 KJ-编码 / (ERP)        KJ-编码 / 鼎捷编码             (保压) / 波距代码 / 波距 / 车型车系 / 芯体总成尺寸 / 纸箱尺寸(内尺寸) / 纸箱尺寸(外尺寸) / 2026.5.11出口成本 / 2026.5.11出口部内销成本 / 2026.4.10出口成本 / 2026.4.10出口部内销成本 / 备注

Mapped columns：
  - kjCode: KJ总编码 / (孚盟)                 KJ-编码 / (ERP)        KJ-编码
  - erpCode: 鼎捷编码             (保压)
  - model: 车型车系
  - specification: 芯体总成尺寸 / 纸箱尺寸(内尺寸) / 纸箱尺寸(外尺寸) / 波距 / 波距代码
  - costPrice: 2026.5.11出口成本 / 2026.4.10出口成本 / 2026.5.11出口部内销成本 / 2026.4.10出口部内销成本
  - packaging: 纸箱尺寸(内尺寸) / 纸箱尺寸(外尺寸)
  - notes: 备注

Warnings：
  - 成本价不是财务批准价格，只能作为 priceCandidate，不能直接生成正式报价。
  - 报价表 / 成本表 / 价格候选数据必须由财务提交和维护，出口部不能上传或维护报价表。
  - Export 只能消费 dry-run / staging 结果生成报价草稿，不能维护价格表。
  - dry-run 不导入生产数据库，不自动批准价格，不生成正式报价。
  - Excel 嵌入图片不是稳定主图来源，后续需要 KJ 主图库。
  - OEM / OE 可能一对多，本阶段不做自动匹配。
  - 成本价不是财务批准价格，只能作为 priceCandidate。
  - 报价表由财务提交和维护，出口部不能上传或维护报价表。

Unsupported reasons：
  - 无

### 中冷器成本报价表

- 文件名：`2026年5月11日 出口部中冷器成本报价表.xlsx`
- 文件类型：`xlsx`
- adapterId：`intercooler-cost-2026`
- 匹配置信度：`high`
- submittedByRole：`finance`
- consumerDepartment：`export`
- sheet 数量：5
- 图片策略：`embedded_excel_image`
- 检测到 KJ 列：是
- 检测到 OEM / OE 列：是
- 检测到产品名称列：是
- 检测到成本候选列：是
- 检测到报价候选列：否
- 检测到包装列：是

Sheet / 表头候选：
- `93it9k`，usedRange `A2:A7`，表头候选：未识别
- `2026年 中冷器成本报价表`，usedRange `A1:AD59`，表头候选：编码 / 旧 KJ.NO:   (孚盟编码) / 鼎捷品号 / 车系 / PA/BA / 厚度PA/BA / 波距 / A/B / AT/MT / 车型 / 芯体 / 主板/水室 / 纸箱(内尺寸) / 2026.5.11出口成本报价 / 2026.5.11出口部内销成本报价 / 2026.4.10出口成本报价 / 2026.4.10出口部内销成本报价 / 备注 / 是否允限销 / 是否允限销备注
- `不能生产`，usedRange `A1:W36`，表头候选：车系 / 厚度 / 波距 / AT/MT / 车型 / OEM / DPI / 规格 / 芯体 / 主板/水室 / 备注 / 编码
- `只做报价，不公布的报价表`，usedRange `A1:IR283`，表头候选：编码 / 旧 KJ.NO: / 原KJ.NO / 车系 / 厚度PA/BA / 波距 / A/B / AT/MT / 车型 / 型号 / OEM / DPI / 规格 / 芯体 / 主板/水室 / 纸箱(内尺寸) / 出口成本报价 / 出口部内销成本报价 / 2018.6.14出口成本报价 / 2018.6.14出口部内销成本报价 / 2018.6.2出口成本报价 / 2018.6.2出口部内销成本报价 / 备注 / 能否报价
- `徐芳芳 不保质，漏水不赔，需与客户说明情况`，usedRange `A1:CS22`，表头候选：原KJ.NO / 车系 / 厚度 / 波距 / A/B / AT/MT / 车型 / 型号 / OEM / DPI / 规格 / 芯体 / 主板/水室 / 纸箱(内尺寸) / 出口成本报价 / 出口部内销成本报价 / 2017-4出口成本报价 / 2017-4出口部内销成本报价 / 2016-12出口成本报价 / 2016-7-29出口成本报价 / 备注

Mapped columns：
  - kjCode: 编码
  - oldCode: 旧 KJ.NO:   (孚盟编码) / 旧 KJ.NO: / 原KJ.NO
  - erpCode: 鼎捷品号
  - fumacrmCode: 旧 KJ.NO:   (孚盟编码)
  - oemCode: OEM
  - model: 车系 / 车型 / 型号
  - specification: 芯体 / 主板/水室 / 波距 / DPI / 规格 / 厚度
  - category: PA/BA / 厚度PA/BA / A/B / AT/MT
  - costPrice: 2026.5.11出口成本报价 / 2026.4.10出口成本报价 / 2026.5.11出口部内销成本报价 / 2026.4.10出口部内销成本报价 / 出口成本报价 / 2018.6.14出口成本报价 / 2018.6.2出口成本报价 / 出口部内销成本报价 / 2018.6.14出口部内销成本报价 / 2018.6.2出口部内销成本报价 / 2017-4出口成本报价 / 2016-12出口成本报价 / 2016-7-29出口成本报价 / 2017-4出口部内销成本报价
  - packaging: 纸箱(内尺寸)
  - notes: 备注 / 是否允限销 / 是否允限销备注 / 能否报价

Warnings：
  - 成本价不是财务批准价格，只能作为 priceCandidate，不能直接生成正式报价。
  - 报价表 / 成本表 / 价格候选数据必须由财务提交和维护，出口部不能上传或维护报价表。
  - Export 只能消费 dry-run / staging 结果生成报价草稿，不能维护价格表。
  - dry-run 不导入生产数据库，不自动批准价格，不生成正式报价。
  - Excel 嵌入图片不是稳定主图来源，后续需要 KJ 主图库。
  - OEM / OE 可能一对多，本阶段不做自动匹配。
  - 成本价不是财务批准价格，只能作为 priceCandidate。
  - 报价表由财务提交和维护，出口部不能上传或维护报价表。
  - 嵌入图片不是稳定主图来源。

Unsupported reasons：
  - 无

### 水室成本报价表

- 文件名：`2026年5月11日 水室成本报价表.xlsx`
- 文件类型：`xlsx`
- adapterId：`water-chamber-cost-2026`
- 匹配置信度：`high`
- submittedByRole：`finance`
- consumerDepartment：`export`
- sheet 数量：1
- 图片策略：`none`
- 检测到 KJ 列：是
- 检测到 OEM / OE 列：否
- 检测到产品名称列：是
- 检测到成本候选列：是
- 检测到报价候选列：否
- 检测到包装列：否

Sheet / 表头候选：
- `2026年5月水室成本报价表`，usedRange `A1:M7261`，表头候选：产品KJ编码 / 左/上水室品号 / 左/上水室品名 / 左/上水室规格 / 出口成本价(元/件) / 出口部内销成本价(元/件) / 右/下水室品号 / 右/下水室品名 / 右/下水室规格 / 备注

Mapped columns：
  - kjCode: 产品KJ编码
  - erpCode: 左/上水室品号 / 右/下水室品号
  - productName: 左/上水室品名 / 右/下水室品名
  - specification: 左/上水室规格 / 右/下水室规格
  - costPrice: 出口成本价(元/件) / 出口部内销成本价(元/件)
  - notes: 备注

Warnings：
  - 成本价不是财务批准价格，只能作为 priceCandidate，不能直接生成正式报价。
  - 报价表 / 成本表 / 价格候选数据必须由财务提交和维护，出口部不能上传或维护报价表。
  - Export 只能消费 dry-run / staging 结果生成报价草稿，不能维护价格表。
  - dry-run 不导入生产数据库，不自动批准价格，不生成正式报价。
  - Excel 嵌入图片不是稳定主图来源，后续需要 KJ 主图库。
  - OEM / OE 可能一对多，本阶段不做自动匹配。
  - 成本价不是财务批准价格，只能作为 priceCandidate。
  - 报价表由财务提交和维护，出口部不能上传或维护报价表。
  - 水室是左右件结构，不是通用整品报价主表。

Unsupported reasons：
  - 无

### 特殊包装及其他成本报价表

- 文件名：`2026年5月11日出口部特殊包装及其他成本报价表.xls`
- 文件类型：`xls`
- adapterId：`special-packaging-cost-2026`
- 匹配置信度：`high`
- submittedByRole：`finance`
- consumerDepartment：`export`
- sheet 数量：1
- 图片策略：`none`
- 检测到 KJ 列：否
- 检测到 OEM / OE 列：否
- 检测到产品名称列：是
- 检测到成本候选列：否
- 检测到报价候选列：是
- 检测到包装列：否

Sheet / 表头候选：
- `2026年5月特殊包装及其他成本报价表`，usedRange `A1:F33`，表头候选：名称 / 规格 / 新报价业务(在原水箱报价表增加) / 单位 / 备注

Mapped columns：
  - productName: 名称
  - specification: 规格
  - quotePrice: 新报价业务(在原水箱报价表增加)
  - unit: 单位
  - notes: 备注

Warnings：
  - 成本价不是财务批准价格，只能作为 priceCandidate，不能直接生成正式报价。
  - 报价表 / 成本表 / 价格候选数据必须由财务提交和维护，出口部不能上传或维护报价表。
  - Export 只能消费 dry-run / staging 结果生成报价草稿，不能维护价格表。
  - dry-run 不导入生产数据库，不自动批准价格，不生成正式报价。
  - Excel 嵌入图片不是稳定主图来源，后续需要 KJ 主图库。
  - OEM / OE 可能一对多，本阶段不做自动匹配。
  - 成本价不是财务批准价格，只能作为 priceCandidate。
  - 报价表由财务提交和维护，出口部不能上传或维护报价表。
  - 特殊包装及其他不能直接视为产品标准报价，只能作为包装附加项候选。
  - 该表没有稳定 KJ / OEM 主键，不适合产品自动匹配。

Unsupported reasons：
  - 无

### 全铝自产机冷成本报价表

- 文件名：`2026年月5月11日 全铝自产机冷成本报价表.xls`
- 文件类型：`xls`
- adapterId：`all-aluminum-oil-cooler-cost-2026`
- 匹配置信度：`high`
- submittedByRole：`finance`
- consumerDepartment：`export`
- sheet 数量：1
- 图片策略：`none`
- 检测到 KJ 列：是
- 检测到 OEM / OE 列：否
- 检测到产品名称列：是
- 检测到成本候选列：是
- 检测到报价候选列：否
- 检测到包装列：否

Sheet / 表头候选：
- `5月自产全铝机冷报价表`，usedRange `A1:I2948`，表头候选：主件品号 / 主件品名(KJ编码) / 主件规格 / 机冷品号 / 机冷品名 / 机冷规格 / 出口成本价(元/件) / 出口部内销成本价(元/件)

Mapped columns：
  - kjCode: 主件品名(KJ编码)
  - erpCode: 主件品号 / 机冷品号
  - productName: 主件品名(KJ编码) / 机冷品名
  - specification: 主件规格 / 机冷规格
  - costPrice: 出口成本价(元/件) / 出口部内销成本价(元/件)

Warnings：
  - 成本价不是财务批准价格，只能作为 priceCandidate，不能直接生成正式报价。
  - 报价表 / 成本表 / 价格候选数据必须由财务提交和维护，出口部不能上传或维护报价表。
  - Export 只能消费 dry-run / staging 结果生成报价草稿，不能维护价格表。
  - dry-run 不导入生产数据库，不自动批准价格，不生成正式报价。
  - Excel 嵌入图片不是稳定主图来源，后续需要 KJ 主图库。
  - OEM / OE 可能一对多，本阶段不做自动匹配。
  - 成本价不是财务批准价格，只能作为 priceCandidate。
  - 报价表由财务提交和维护，出口部不能上传或维护报价表。
  - 全铝自产机冷需要从品名中提取 KJ，可能需要单独产品线配置。

Unsupported reasons：
  - 无

## Adapter 覆盖和修正建议

1. 8 个文件均匹配到对应 adapter，匹配置信度均为 `high`。
2. 本轮已对 adapter / CLI 做小修：
   - 表头匹配支持日期前缀列名，例如 `2026.5.11出口成本`。
   - 移除通用 `quotePrice` 中的 `成本报价` 候选，避免把成本候选误判为正式报价候选。
   - 水箱 / 中冷器增加 `纸箱(内尺寸)` 包装列候选。
3. 冷凝器、暖风、蒸发器：KJ、产品/车型、成本候选和包装列结构可进入 V1 KJ dry-run，但需处理多个 KJ 编码来源。
4. 水箱、中冷器：KJ、OEM、成本候选和包装列均可识别，但 sheet 多、辅助表多、结构最复杂；进入 V1 前必须保留风险提示和人工复核。
5. 水室：KJ、左右件产品名称、成本候选可识别；适合 V1 的 KJ dry-run，但需要保留左右件结构说明。
6. 全铝自产机冷：KJ 候选藏在主件品名字段中，成本候选可识别；建议单独产品线规则后再进入 V1。
7. 特殊包装及其他：没有 KJ / OEM 主键，不适合进入产品 KJ 报价草稿 V1；只能作为包装附加项候选结构。

## 结论

- 当前 adapter 配置可以覆盖 8 份财务提交报价表的结构识别。
- dry-run 只确认结构可读和字段候选可映射，不代表价格可用，不代表财务批准。
- 下一步建议先做 Finance / FinancePricing 域的只读上传 dry-run 设计，不允许出口部上传或维护报价表。
