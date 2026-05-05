import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { customerGeoDisplay, normalizeCustomerGeo } from "@/lib/honoa/shared/geo";

const customerFormWizard = readFileSync(join(process.cwd(), "components/customer-form-wizard.tsx"), "utf8");
const customerGeoSelector = readFileSync(join(process.cwd(), "components/customer-geo-selector.tsx"), "utf8");
const customerDetailPage = readFileSync(join(process.cwd(), "app/export/customers/[id]/page.tsx"), "utf8");

describe("KingaOS export customer geo and step UI", () => {
  it("国家字段保存 countryCode / countryName", () => {
    const geo = normalizeCustomerGeo({ countryCode: "CN", countryName: "中国" });

    expect(geo.countryCode).toBe("CN");
    expect(geo.countryName).toBe("中国");
    expect(geo.country).toBe("中国");
  });

  it("州省字段保存 stateCode / stateName", () => {
    const geo = normalizeCustomerGeo({ countryCode: "CN", countryName: "中国", stateCode: "ZJ", stateName: "Zhejiang" });

    expect(geo.stateCode).toBe("ZJ");
    expect(geo.stateName).toBe("Zhejiang");
  });

  it("城市字段保存 cityName 并兼容旧 city 字段", () => {
    const geo = normalizeCustomerGeo({ cityName: "Hangzhou" });
    const fallback = normalizeCustomerGeo({ city: "Ningbo" });

    expect(geo.cityName).toBe("Hangzhou");
    expect(geo.city).toBe("Hangzhou");
    expect(fallback.cityName).toBe("Ningbo");
  });

  it("没有 state 的国家也可以保存，手动输入城市可以保存", () => {
    const geo = normalizeCustomerGeo({ countryCode: "SG", countryName: "新加坡", cityName: "Singapore" });

    expect(geo.stateCode).toBeNull();
    expect(geo.stateName).toBeNull();
    expect(geo.cityName).toBe("Singapore");
  });

  it("详情页优先显示新国家 / 州省 / 城市字段", () => {
    const display = customerGeoDisplay({
      country: "旧国家",
      city: "旧城市",
      countryName: "中国",
      stateName: "Zhejiang",
      cityName: "Hangzhou"
    });

    expect(display).toEqual({
      country: "中国",
      state: "Zhejiang",
      city: "Hangzhou",
      full: "中国 / Zhejiang / Hangzhou"
    });
  });

  it("如果新字段为空，fallback 显示旧 country / city", () => {
    const display = customerGeoDisplay({ country: "Japan", city: "Tokyo" });

    expect(display.country).toBe("Japan");
    expect(display.city).toBe("Tokyo");
    expect(display.full).toBe("Japan / Tokyo");
  });

  it("新建客户页使用步骤条，默认从基础信息开始，并保留返回联系人信息文案", () => {
    expect(customerFormWizard).toContain("客户档案填写步骤");
    expect(customerFormWizard).toContain("基础信息");
    expect(customerFormWizard).toContain("联系人信息");
    expect(customerFormWizard).toContain("上一步");
    expect(customerFormWizard).toContain("下一步");
  });

  it("国家选择后按需加载州省和城市，不把全量城市数据直接放进客户端", () => {
    expect(customerGeoSelector).toContain("/api/geo/countries");
    expect(customerGeoSelector).toContain("/api/geo/states?countryCode=");
    expect(customerGeoSelector).toContain("/api/geo/cities?countryCode=");
    expect(customerGeoSelector).toContain("没有找到城市？手动输入");
    expect(customerGeoSelector).not.toContain("@countrystatecity/countries");
  });

  it("客户详情页采用分区 tab，避免一页无限下拉", () => {
    expect(customerDetailPage).toContain("CustomerDetailTabs");
    expect(customerDetailPage).toContain("操作记录");
  });
});
