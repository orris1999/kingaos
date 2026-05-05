const COMMON_CUSTOMER_SUFFIXES = ["客户"];

export function normalizeCustomerName(input: string) {
  let value = input
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, "")
    .replace(/[\p{P}\p{S}]/gu, "");

  for (const suffix of COMMON_CUSTOMER_SUFFIXES) {
    if (value.endsWith(suffix) && value.length > suffix.length) {
      value = value.slice(0, -suffix.length);
    }
  }

  return value;
}
