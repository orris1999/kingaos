import type { QuoteDraftCatalogItem } from "./types";

export const QUOTE_DRAFT_MOCK_CATALOG: QuoteDraftCatalogItem[] = [
  {
    kjCode: "KJMOCK001",
    productName: "Mock Radiator",
    category: "水箱",
    oemCodes: ["MOCK-OEM-001"],
    imageStatus: "available",
    imageRef: "mock://kjmock001-main",
    unit: "pcs",
    priceCandidate: {
      currency: "USD",
      sourceType: "cost_candidate",
      sourceFile: "mock-cost-table",
      sourceSheet: "mock-sheet",
      sourceRow: 10
    },
    warnings: ["mock 数据，仅用于内部 workbench 演示。"]
  },
  {
    kjCode: "KJMOCK002",
    productName: "Mock Heater",
    category: "暖风",
    imageStatus: "missing",
    unit: "pcs",
    warnings: ["mock 数据，仅用于内部 workbench 演示。"]
  },
  {
    kjCode: "KJMOCK-DUP",
    productName: "Mock Duplicate A",
    category: "冷凝器",
    imageStatus: "embedded_only",
    unit: "pcs",
    warnings: ["mock 重复 KJ 候选 A。"]
  },
  {
    kjCode: "KJMOCK-DUP",
    productName: "Mock Duplicate B",
    category: "冷凝器",
    imageStatus: "available",
    unit: "pcs",
    warnings: ["mock 重复 KJ 候选 B。"]
  }
];

export const QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT = [
  "KJMOCK001 100pcs",
  "KJMOCK002*200",
  "KJMOCK-DUP, 50, 客户要中性包装",
  "16400-XXXXX 300"
].join("\n");
