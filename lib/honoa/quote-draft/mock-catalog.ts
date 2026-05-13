import type { QuoteDraftCatalogItem } from "./types";

export const QUOTE_DRAFT_MOCK_CATALOG: QuoteDraftCatalogItem[] = [
  {
    kjCode: "KJMOCK-COND-001",
    productName: "Mock Condenser",
    category: "冷凝器",
    imageStatus: "available",
    imageRef: "mock://kjmock-cond-001-main",
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
    kjCode: "KJMOCK-RAD-PA16-A",
    productName: "Mock Radiator Standard",
    category: "水箱",
    imageStatus: "available",
    imageRef: "mock://kjmock-rad-pa16-a-main",
    unit: "pcs",
    priceCandidate: {
      currency: "USD",
      sourceType: "cost_candidate",
      sourceFile: "mock-radiator-cost-table",
      sourceSheet: "mock-primary-sheet",
      sourceRow: 20
    },
    warnings: ["mock 数据，仅用于内部 workbench 演示。"]
  },
  {
    kjCode: "KJMOCK-RAD-BASE-001",
    productName: "Mock Radiator Base Candidate A",
    category: "水箱",
    imageStatus: "available",
    unit: "pcs",
    warnings: ["mock 基础 KJ 多候选 A。"]
  },
  {
    kjCode: "KJMOCK-RAD-BASE-001",
    productName: "Mock Radiator Base Candidate B",
    category: "水箱",
    imageStatus: "available",
    unit: "pcs",
    warnings: ["mock 基础 KJ 多候选 B。"]
  },
  {
    kjCode: "KJMOCK-IC-001",
    productName: "Mock Intercooler Standard",
    category: "中冷器",
    imageStatus: "available",
    imageRef: "mock://kjmock-ic-001-main",
    unit: "pcs",
    priceCandidate: {
      currency: "USD",
      sourceType: "cost_candidate",
      sourceFile: "mock-intercooler-cost-table",
      sourceSheet: "mock-primary-sheet",
      sourceRow: 30
    },
    warnings: ["mock 数据，仅用于内部 workbench 演示。"]
  },
  {
    kjCode: "KJMOCK-IC-OLD-001",
    rawKjCode: "旧 KJ.NO: KJMOCK-IC-OLD-001",
    sourceCodeType: "old_code",
    productName: "Mock Intercooler Old Code",
    category: "中冷器",
    imageStatus: "available",
    unit: "pcs",
    priceCandidate: {
      currency: "USD",
      sourceType: "cost_candidate",
      sourceFile: "mock-intercooler-cost-table",
      sourceSheet: "mock-primary-sheet",
      sourceRow: 31
    },
    warnings: ["mock 旧 KJ.NO 映射演示。"]
  },
  {
    kjCode: "KJMOCK-PACK-001",
    productName: "Mock Packaging Addon",
    category: "特殊包装及其他",
    imageStatus: "missing",
    unit: "pcs",
    priceCandidate: {
      currency: "USD",
      sourceType: "cost_candidate",
      sourceFile: "mock-packaging-cost-table",
      sourceSheet: "mock-addon-sheet",
      sourceRow: 40
    },
    warnings: ["mock 包装附加项演示。"]
  }
];

export const QUOTE_DRAFT_WORKBENCH_SAMPLE_INPUT = [
  "KJMOCK-COND-001 100pcs",
  "KJMOCK-RAD-PA16-A 80",
  "KJMOCK-RAD-BASE-001 50",
  "KJMOCK-IC-001 60",
  "KJMOCK-IC-OLD-001 30",
  "KJMOCK-PACK-001 20",
  "16400-XXXXX 300",
  "UNKNOWN123"
].join("\n");
