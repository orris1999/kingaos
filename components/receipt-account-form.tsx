import type { CompanyReceiptAccount } from "@prisma/client";
import { RECEIPT_ACCOUNT_CURRENCIES, RECEIPT_ACCOUNT_PAYMENT_METHODS } from "@/lib/honoa/shared/constants";

export function ReceiptAccountForm({
  account,
  action
}: {
  account?: CompanyReceiptAccount;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const isActive = account?.isActive ?? true;
  return (
    <form className="form-grid" action={action}>
      <input name="isActive" type="hidden" value={isActive ? "1" : "0"} />
      <label>收款方案<input name="displayName" defaultValue={account?.displayName || ""} required /></label>
      <label>收款场景<input name="scenarioName" defaultValue={account?.scenarioName || ""} /></label>
      <label>
        支付方式
        <select name="paymentMethod" defaultValue={account?.paymentMethod || "bank_transfer"}>
          {RECEIPT_ACCOUNT_PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>
        币种
        <select name="currency" defaultValue={account?.currency || "USD"}>
          {RECEIPT_ACCOUNT_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
        </select>
      </label>
      <label>收款主体<input name="companyName" defaultValue={account?.companyName || ""} required /></label>
      <label>账号<input name="accountNo" defaultValue={account?.accountNo || ""} required /></label>
      <label>开户行<input name="bankName" defaultValue={account?.bankName || ""} required /></label>
      <label>SWIFT CODE<input name="swiftCode" defaultValue={account?.swiftCode || ""} /></label>
      <label style={{ gridColumn: "1 / -1" }}>银行地址<textarea name="bankAddress" defaultValue={account?.bankAddress || ""} /></label>
      <label>生效日期<input name="effectiveFrom" type="date" defaultValue={account?.effectiveFrom?.toISOString().slice(0, 10) || ""} /></label>
      <label>失效日期<input name="effectiveTo" type="date" defaultValue={account?.effectiveTo?.toISOString().slice(0, 10) || ""} /></label>
      <label style={{ gridColumn: "1 / -1" }}>使用说明<textarea name="usageNotes" defaultValue={account?.usageNotes || ""} /></label>
      <label style={{ gridColumn: "1 / -1" }}>风险提醒<textarea name="riskNotes" defaultValue={account?.riskNotes || ""} /></label>
      <div className="kv"><b>状态</b><span>{isActive ? "有效" : "已停用"}。停用 / 启用请在账号详情页操作。</span></div>
      <div><button type="submit">{account ? "保存收款账号" : "新增收款账号"}</button></div>
    </form>
  );
}
