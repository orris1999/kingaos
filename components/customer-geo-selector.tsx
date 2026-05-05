"use client";

import * as React from "react";

type CountryOption = {
  code: string;
  name: string;
};

type StateOption = {
  code: string;
  name: string;
};

type CityOption = {
  name: string;
};

export type CustomerGeoValue = {
  countryCode?: string | null;
  countryName?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
  cityName?: string | null;
  country?: string | null;
  city?: string | null;
};

export function CustomerGeoSelector({ initialValue }: { initialValue?: CustomerGeoValue }) {
  const [countries, setCountries] = React.useState<CountryOption[]>([]);
  const [states, setStates] = React.useState<StateOption[]>([]);
  const [cities, setCities] = React.useState<CityOption[]>([]);
  const [countryCode, setCountryCode] = React.useState(initialValue?.countryCode || "");
  const [countryName, setCountryName] = React.useState(initialValue?.countryName || initialValue?.country || "");
  const [stateCode, setStateCode] = React.useState(initialValue?.stateCode || "");
  const [stateName, setStateName] = React.useState(initialValue?.stateName || "");
  const [cityName, setCityName] = React.useState(initialValue?.cityName || initialValue?.city || "");
  const [citySearch, setCitySearch] = React.useState("");
  const [manualCity, setManualCity] = React.useState(Boolean(initialValue?.cityName || initialValue?.city));
  const [loadingStates, setLoadingStates] = React.useState(false);
  const [loadingCities, setLoadingCities] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/geo/countries")
      .then((response) => (response.ok ? response.json() : []))
      .then((data: CountryOption[]) => {
        setCountries(data);
        if (countryCode && !countryName) setCountryName(data.find((country) => country.code === countryCode)?.name || "");
      })
      .catch(() => setCountries([]));
  }, [countryCode, countryName]);

  React.useEffect(() => {
    if (!countryCode) {
      setStates([]);
      return;
    }
    setLoadingStates(true);
    fetch(`/api/geo/states?countryCode=${encodeURIComponent(countryCode)}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: StateOption[]) => {
        setStates(data);
        if (stateCode && !data.some((state) => state.code === stateCode)) {
          setStateCode("");
          setStateName("");
        }
      })
      .catch(() => setStates([]))
      .finally(() => setLoadingStates(false));
  }, [countryCode, stateCode]);

  React.useEffect(() => {
    if (!countryCode || !stateCode) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    fetch(`/api/geo/cities?countryCode=${encodeURIComponent(countryCode)}&stateCode=${encodeURIComponent(stateCode)}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: CityOption[]) => setCities(data))
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [countryCode, stateCode]);

  const filteredCities = cities
    .filter((city) => city.name.toLowerCase().includes(citySearch.trim().toLowerCase()))
    .slice(0, 200);
  const hasStates = states.length > 0;
  const canPickCity = Boolean(countryCode && (!hasStates || stateCode));

  function chooseCountry(nextCode: string) {
    const country = countries.find((item) => item.code === nextCode);
    setCountryCode(nextCode);
    setCountryName(country?.name || "");
    setStateCode("");
    setStateName("");
    setCityName("");
    setCitySearch("");
    setManualCity(false);
  }

  function chooseState(nextCode: string) {
    const state = states.find((item) => item.code === nextCode);
    setStateCode(nextCode);
    setStateName(state?.name || "");
    setCityName("");
    setCitySearch("");
    setManualCity(false);
  }

  return (
    <div className="form-grid" style={{ gridColumn: "1 / -1" }}>
      <input type="hidden" name="country" value={countryName} />
      <input type="hidden" name="city" value={cityName} />
      <input type="hidden" name="countryCode" value={countryCode} />
      <input type="hidden" name="countryName" value={countryName} />
      <input type="hidden" name="stateCode" value={stateCode} />
      <input type="hidden" name="stateName" value={stateName} />
      <input type="hidden" name="cityName" value={cityName} />

      <label>
        国家 / 地区
        <select value={countryCode} onChange={(event) => chooseCountry(event.target.value)}>
          <option value="">请选择国家 / 地区</option>
          {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
        </select>
      </label>

      <label>
        州 / 省 / 地区
        {!countryCode ? (
          <div className="readonly">请先选择国家 / 地区</div>
        ) : loadingStates ? (
          <div className="readonly">加载中...</div>
        ) : hasStates ? (
          <select value={stateCode} onChange={(event) => chooseState(event.target.value)}>
            <option value="">请选择州 / 省 / 地区</option>
            {states.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
          </select>
        ) : (
          <div className="readonly">该国家 / 地区暂无州省数据，可直接填写城市。</div>
        )}
      </label>

      <label>
        城市
        {!countryCode ? (
          <div className="readonly">请先选择国家 / 地区</div>
        ) : hasStates && !stateCode ? (
          <div className="readonly">请先选择州 / 省 / 地区</div>
        ) : manualCity || !canPickCity || (!loadingCities && cities.length === 0) ? (
          <input value={cityName} onChange={(event) => setCityName(event.target.value)} placeholder="手动输入城市" />
        ) : (
          <div className="stack">
            <input value={citySearch} onChange={(event) => setCitySearch(event.target.value)} placeholder="搜索城市" />
            <select value={cityName} onChange={(event) => setCityName(event.target.value)}>
              <option value="">{loadingCities ? "加载中..." : "请选择城市"}</option>
              {filteredCities.map((city) => <option key={city.name} value={city.name}>{city.name}</option>)}
            </select>
          </div>
        )}
      </label>

      <div style={{ alignSelf: "end" }}>
        <button type="button" className="ghost" onClick={() => setManualCity(true)}>没有找到城市？手动输入</button>
      </div>
    </div>
  );
}
