export function isFinanceStagingConfirmEnabled() {
  return process.env.KINGA_ENABLE_FINANCE_STAGING_CONFIRM?.trim().toLowerCase() === "true";
}

export function isExportStagingQuoteDraftEnabled() {
  return process.env.KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT?.trim().toLowerCase() === "true";
}

export function isExportQuoteDraftExcelEnabled() {
  return process.env.KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL?.trim().toLowerCase() === "true";
}

export function isExportManagerQuoteDraftTrialEnabled() {
  return process.env.KINGA_ENABLE_EXPORT_MANAGER_QUOTE_DRAFT_TRIAL?.trim().toLowerCase() === "true";
}

export function isFinanceQuoteSourceDryRunEnabled() {
  return process.env.KINGA_ENABLE_FINANCE_QUOTE_SOURCE_DRY_RUN?.trim().toLowerCase() === "true";
}

export type QuoteDraftWorkbenchAccessUser = {
  department: string;
  role: string;
  isActive?: boolean;
};

export function isExportManagerQuoteDraftTrialUser(user: QuoteDraftWorkbenchAccessUser) {
  return user.department === "export" && user.role === "manager" && user.isActive !== false;
}

export function canAccessExportQuoteDraftWorkbench(
  user: QuoteDraftWorkbenchAccessUser,
  exportManagerTrialEnabled = isExportManagerQuoteDraftTrialEnabled()
) {
  return user.role === "super_admin" || (exportManagerTrialEnabled && isExportManagerQuoteDraftTrialUser(user));
}
