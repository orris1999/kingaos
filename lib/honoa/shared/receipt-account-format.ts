export type ReceiptAccountForContract = {
  displayName: string;
  currency: string;
  companyName: string;
  accountNo: string;
  bankName: string;
  swiftCode?: string | null;
  bankAddress?: string | null;
};

export function formatReceiptAccountForContract(account: ReceiptAccountForContract) {
  const currency = account.currency.trim().toUpperCase() || "ACCOUNT";
  return [
    `Bank Detail（${currency} ACCOUNT）`,
    `COMPANY NAME：${account.companyName}`,
    `${currency} ACCOUNT NO.：${account.accountNo}`,
    `BANK NAME：${account.bankName}`,
    account.swiftCode ? `SWIFT CODE：${account.swiftCode}` : "",
    account.bankAddress ? `BANK ADDRESS：${account.bankAddress}` : ""
  ].filter(Boolean).join("\n");
}
