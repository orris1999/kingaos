# 03｜模块边界和架构红线

## 职责边界

- 销售负责客户事实和商业动作。
- 财务负责价格事实、成本核价、底价、毛利和经营风险。
- 技术负责产品定义、图纸、BOM、工艺和文控。
- 采购 / 生产 / 库存未来提供成本和交付依据。

## FinancePricing 红线

- FinancePricing 必须独立建域。
- Quotation 只能使用财务批准后的价格快照。
- Sales 不能自己设置底价。
- Sales 不能自己维护价格表。
- Sales 不能绕过财务批准直接形成正式报价。
- QuotationLine 必须保存 FinanceApprovedPrice snapshot。
- SalesOrderLine 只能继承 CustomerAcceptedQuote / QuotationLine 的 approved snapshot，不能重新算价。

## 当前阶段 FinancePricing 只做

- 入口预留
- 架构文档
- 权限预留
- 不可点击模块

当前阶段不要实现真实 FinancePricing 功能。

## 未开放模块

未开放模块不仅按钮禁用，直接输入 URL 也只能看到未开放页面或权限拦截，不得进入真实业务功能。

当前未开放：

- 出口部查询价格真实功能
- 财务价格表真实功能
- 财务上传价格表
- 统一改价
- 报价
- 询盘
- 订单
- 国内部客户档案
- 技术部产品库
- 完整 CRM
- 完整 ERP
