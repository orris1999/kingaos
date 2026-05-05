import {
  getCitiesOfState,
  getCountries,
  getCountryByCode,
  getStatesOfCountry,
  isValidCountryCode,
  isValidStateCode
} from "@countrystatecity/countries";

export type GeoCountryOption = {
  code: string;
  name: string;
};

export type GeoStateOption = {
  code: string;
  name: string;
};

export type GeoCityOption = {
  name: string;
};

let countriesCache: GeoCountryOption[] | null = null;
const statesCache = new Map<string, GeoStateOption[]>();
const citiesCache = new Map<string, GeoCityOption[]>();

function countryDisplayName(country: { name: string; native?: string | null; translations?: Record<string, string> }) {
  return country.translations?.["zh-CN"] || country.native || country.name;
}

export async function listGeoCountries(): Promise<GeoCountryOption[]> {
  if (countriesCache) return countriesCache;
  const countries = await getCountries();
  const enriched = await Promise.all(
    countries.map(async (country) => {
      const meta = await getCountryByCode(country.iso2).catch(() => null);
      return {
        code: country.iso2,
        name: countryDisplayName(meta || country)
      };
    })
  );
  countriesCache = enriched.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  return countriesCache;
}

export async function getGeoCountryName(countryCode: string) {
  const country = await getCountryByCode(countryCode);
  return country ? countryDisplayName(country) : null;
}

export async function listGeoStates(countryCode: string): Promise<GeoStateOption[]> {
  const normalizedCountry = countryCode.trim().toUpperCase();
  if (!normalizedCountry || !(await isValidCountryCode(normalizedCountry))) return [];
  const cached = statesCache.get(normalizedCountry);
  if (cached) return cached;
  const states = await getStatesOfCountry(normalizedCountry);
  const options = states
    .map((state) => ({ code: state.iso2, name: state.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  statesCache.set(normalizedCountry, options);
  return options;
}

export async function listGeoCities(countryCode: string, stateCode: string): Promise<GeoCityOption[]> {
  const normalizedCountry = countryCode.trim().toUpperCase();
  const normalizedState = stateCode.trim();
  if (!normalizedCountry || !normalizedState || !(await isValidStateCode(normalizedCountry, normalizedState))) return [];
  const cacheKey = `${normalizedCountry}:${normalizedState}`;
  const cached = citiesCache.get(cacheKey);
  if (cached) return cached;
  const cities = await getCitiesOfState(normalizedCountry, normalizedState);
  const options = Array.from(new Set(cities.map((city) => city.name).filter(Boolean)))
    .map((name) => ({ name }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  citiesCache.set(cacheKey, options);
  return options;
}

export async function validateCustomerGeoInput(input: {
  countryCode?: string | null;
  countryName?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
  cityName?: string | null;
}) {
  const countryCode = input.countryCode?.trim().toUpperCase() || "";
  const stateCode = input.stateCode?.trim() || "";
  const cityName = input.cityName?.trim() || "";
  if (!countryCode && !input.countryName && !stateCode && !input.stateName && !cityName) return;
  if (!countryCode) throw new Error("请选择国家 / 地区。");
  if (!(await isValidCountryCode(countryCode))) throw new Error("国家 / 地区无效。");
  if (stateCode && !(await isValidStateCode(countryCode, stateCode))) throw new Error("州 / 省 / 地区不属于所选国家 / 地区。");
}

export async function resolveCustomerGeoInput(input: {
  countryCode?: string | null;
  countryName?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
  cityName?: string | null;
  country?: string | null;
  city?: string | null;
}) {
  await validateCustomerGeoInput(input);
  const countryCode = input.countryCode?.trim().toUpperCase() || null;
  const stateCode = input.stateCode?.trim() || null;
  const cityName = input.cityName?.trim() || input.city?.trim() || null;
  if (!countryCode) {
    return {
      countryCode: null,
      countryName: input.countryName?.trim() || input.country?.trim() || null,
      stateCode: null,
      stateName: null,
      cityName,
      country: input.countryName?.trim() || input.country?.trim() || "",
      city: cityName || ""
    };
  }
  const countryName = (await getGeoCountryName(countryCode)) || input.countryName?.trim() || input.country?.trim() || "";
  const stateName = stateCode
    ? (await listGeoStates(countryCode)).find((state) => state.code === stateCode)?.name || input.stateName?.trim() || null
    : null;
  return {
    countryCode,
    countryName,
    stateCode,
    stateName,
    cityName,
    country: countryName,
    city: cityName || ""
  };
}
