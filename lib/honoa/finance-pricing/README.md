# FinancePricing Reserved Domain

当前阶段只保留 FinancePricing 入口、权限 key 和架构红线，不实现真实价格功能。

红线：

- FinancePricing 必须独立建域。
- Quotation 只能使用财务批准后的价格快照。
- Sales 不能自己设置底价。
- Sales 不能自己维护价格表。
- Sales 不能绕过财务批准直接形成正式报价。
- QuotationLine 必须保存 FinanceApprovedPrice snapshot。
- SalesOrderLine 只能继承 CustomerAcceptedQuote / QuotationLine 的 approved snapshot，不能重新算价。
