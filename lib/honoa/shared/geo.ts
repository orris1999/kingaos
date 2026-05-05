export type CustomerGeoInput = {
  countryCode?: string | null;
  countryName?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
  cityName?: string | null;
  country?: string | null;
  city?: string | null;
};

let zhCountryNames: Intl.DisplayNames | null = null;

export function chineseCountryName(countryCode?: string | null) {
  const normalized = countryCode?.trim().toUpperCase();
  if (!normalized) return null;
  try {
    zhCountryNames ||= new Intl.DisplayNames(["zh-CN"], { type: "region" });
    const name = zhCountryNames.of(normalized);
    return name && name !== normalized ? name : null;
  } catch {
    return null;
  }
}

export function normalizeCustomerGeo(input: CustomerGeoInput) {
  const countryName = chineseCountryName(input.countryCode) || input.countryName?.trim() || input.country?.trim() || "";
  const cityName = input.cityName?.trim() || input.city?.trim() || "";
  return {
    countryCode: input.countryCode?.trim().toUpperCase() || null,
    countryName: countryName || null,
    stateCode: input.stateCode?.trim() || null,
    stateName: input.stateName?.trim() || null,
    cityName: cityName || null,
    country: countryName,
    city: cityName
  };
}

export function customerGeoDisplay(input: CustomerGeoInput) {
  const country = chineseCountryName(input.countryCode) || input.countryName?.trim() || input.country?.trim() || "";
  const state = input.stateName?.trim() || "";
  const city = input.cityName?.trim() || input.city?.trim() || "";
  return {
    country,
    state,
    city,
    full: [country, state, city].filter(Boolean).join(" / ") || "-"
  };
}
