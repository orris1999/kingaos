export function isFinanceStagingConfirmEnabled() {
  return process.env.KINGA_ENABLE_FINANCE_STAGING_CONFIRM?.trim().toLowerCase() === "true";
}

export function isExportStagingQuoteDraftEnabled() {
  return process.env.KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT?.trim().toLowerCase() === "true";
}
