export function isFinanceStagingConfirmEnabled() {
  return process.env.KINGA_ENABLE_FINANCE_STAGING_CONFIRM?.trim().toLowerCase() === "true";
}
