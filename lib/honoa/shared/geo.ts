export type CustomerGeoInput = {
  countryCode?: string | null;
  countryName?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
  cityName?: string | null;
  country?: string | null;
  city?: string | null;
};

export function normalizeCustomerGeo(input: CustomerGeoInput) {
  const countryName = input.countryName?.trim() || input.country?.trim() || "";
  const cityName = input.cityName?.trim() || input.city?.trim() || "";
  return {
    countryCode: input.countryCode?.trim() || null,
    countryName: countryName || null,
    stateCode: input.stateCode?.trim() || null,
    stateName: input.stateName?.trim() || null,
    cityName: cityName || null,
    country: countryName,
    city: cityName
  };
}

export function customerGeoDisplay(input: CustomerGeoInput) {
  const country = input.countryName?.trim() || input.country?.trim() || "";
  const state = input.stateName?.trim() || "";
  const city = input.cityName?.trim() || input.city?.trim() || "";
  return {
    country,
    state,
    city,
    full: [country, state, city].filter(Boolean).join(" / ") || "-"
  };
}
