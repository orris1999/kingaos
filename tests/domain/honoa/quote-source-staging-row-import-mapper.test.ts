import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createQuoteSourceStagingBatch,
  createQuoteSourceStagingRows,
  getQuoteSourceStagingBatchById,
  mapQuoteSourceWorkbookRowsToStagingRows,
  parseQuoteSourceWorkbookRowsFromBuffer,
  type QuoteSourceWorkbookRowLike
} from "@/lib/honoa/quote-draft";

const testDatabaseUrl = process.env.QUOTE_SOURCE_STAGING_REPOSITORY_TEST_DATABASE_URL;
const resolvedTestDatabaseUrl =
  testDatabaseUrl ?? "postgresql://missing@127.0.0.1:1/missing_quote_source_row_import_mapper_test";
const describeWithDb = testDatabaseUrl ? describe : describe.skip;
const sourcePrefix = `row-import-mapper-test-${Date.now()}`;

function repositoryOptions() {
  return { databaseUrl: resolvedTestDatabaseUrl };
}

function makeInput(rows: QuoteSourceWorkbookRowLike[]) {
  return {
    batchId: "batch-row-import-mapper-test",
    adapterId: "condenser-cost-2026",
    category: "冷凝器",
    sourceFileName: `${sourcePrefix}.xlsx`,
    rows
  };
}

function mapRows(rows: QuoteSourceWorkbookRowLike[]) {
  return mapQuoteSourceWorkbookRowsToStagingRows(makeInput(rows));
}

function makeWorkbookBuffer(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "2026年冷凝器成本核算");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

describe("Quote Task 009H condenser row import mapper", () => {
  it("maps KJ + product name + cost candidate to a finance-only candidate row", () => {
    const [row] = mapRows([
      {
        sourceRowNumber: 2,
        columns: {
          "KJ编码": "KJMOCK-COND-001",
          "车型车系": "Mock condenser",
          "出口成本报价": true,
          "纸箱尺寸": "Mock carton"
        }
      }
    ]);

    expect(row?.rowStatus).toBe("candidate");
    expect(row?.rawKjCode).toBe("KJMOCK-COND-001");
    expect(row?.standardKjCode).toBe("KJMOCK-COND-001");
    expect(row?.productNameCandidate).toBe("Mock condenser");
    expect(row?.category).toBe("冷凝器");
    expect(row?.hasCostCandidate).toBe(true);
    expect(row?.hasQuoteCandidate).toBe(false);
    expect(row?.hasPackagingInfo).toBe(true);
    expect(row?.visibility).toBe("finance_only");
    expect(row?.visibility).not.toBe("export_draft_candidate");
    expect(row?.warnings?.join(" ")).toContain("candidate 仍然只表示财务侧候选");
  });

  it("stores only quote candidate presence and never the quote value", () => {
    const [row] = mapRows([
      {
        sourceRowNumber: 2,
        columns: {
          "KJ编码": "KJMOCK-COND-002",
          "产品名称": "Mock condenser quote",
          "报价": "MOCK_PRICE"
        }
      }
    ]);
    const serialized = JSON.stringify(row);

    expect(row?.hasQuoteCandidate).toBe(true);
    expect(row?.priceCandidateStatus).toBe("quote_candidate_available");
    expect(serialized).not.toContain("MOCK_PRICE");
  });

  it("marks missing KJ as needs_manual_review", () => {
    const [row] = mapRows([
      {
        sourceRowNumber: 3,
        columns: {
          "产品名称": "Mock condenser without KJ",
          "出口成本": true
        }
      }
    ]);

    expect(row?.rowStatus).toBe("needs_manual_review");
    expect(row?.warnings?.join(" ")).toContain("缺少 KJ 编码");
  });

  it("marks missing product name as needs_manual_review", () => {
    const [row] = mapRows([
      {
        sourceRowNumber: 4,
        columns: {
          "KJ编码": "KJMOCK-COND-004",
          "出口成本": true
        }
      }
    ]);

    expect(row?.rowStatus).toBe("needs_manual_review");
    expect(row?.warnings?.join(" ")).toContain("缺少产品名称");
  });

  it("marks missing price candidate as needs_manual_review", () => {
    const [row] = mapRows([
      {
        sourceRowNumber: 5,
        columns: {
          "KJ编码": "KJMOCK-COND-005",
          "产品名称": "Mock condenser without candidate"
        }
      }
    ]);

    expect(row?.rowStatus).toBe("needs_manual_review");
    expect(row?.priceCandidateStatus).toBe("missing");
    expect(row?.warnings?.join(" ")).toContain("缺少成本 / 报价候选列");
  });

  it("keeps packaging and OEM as boolean metadata without automatic OEM matching", () => {
    const [row] = mapRows([
      {
        sourceRowNumber: 6,
        columns: {
          "KJ编码": "KJMOCK-COND-006",
          "产品名称": "Mock condenser with OEM",
          "出口成本": true,
          "纸箱尺寸": "Mock carton",
          OEM: "OEM-MOCK-001"
        }
      }
    ]);
    const serialized = JSON.stringify(row);

    expect(row?.hasPackagingInfo).toBe(true);
    expect(row?.hasOemInfo).toBe(true);
    expect(row?.warnings?.join(" ")).toContain("不做 OEM 自动匹配");
    expect(serialized).not.toContain("OEM-MOCK-001");
  });

  it("does not output sensitive price or formal quote fields", () => {
    const rows = mapRows([
      {
        sourceRowNumber: 2,
        columns: {
          "KJ编码": "KJMOCK-COND-007",
          "产品名称": "Mock condenser",
          "出口成本报价": true,
          "报价": true
        }
      }
    ]);
    const serialized = JSON.stringify(rows);

    expect(serialized).not.toContain("amount");
    expect(serialized).not.toContain("unitPrice");
    expect(serialized).not.toContain("costPrice");
    expect(serialized).not.toContain("quotePrice");
    expect(serialized).not.toContain("financeApprovedPrice");
    expect(serialized).not.toContain("minimumPrice");
    expect(serialized).not.toContain("grossMargin");
    expect(serialized).not.toContain("officialQuote");
    expect(serialized).not.toContain("sentToCustomer");
  });

  it("parses a mock workbook without retaining concrete candidate values", () => {
    const buffer = makeWorkbookBuffer([
      ["KJ编码", "产品名称", "出口成本报价", "纸箱尺寸", "OEM"],
      ["KJMOCK-COND-008", "Mock parsed condenser", "MOCK_PRICE", "Mock carton", "OEM-MOCK-008"],
      ["", "Missing KJ parsed condenser", 123.45, "", ""]
    ]);
    const parsedRows = parseQuoteSourceWorkbookRowsFromBuffer({
      sourceFileName: "mock-condenser.xlsx",
      fileBuffer: buffer,
      adapterId: "condenser-cost-2026"
    });
    const mappedRows = mapQuoteSourceWorkbookRowsToStagingRows(makeInput(parsedRows));
    const serializedMappedRows = JSON.stringify(mappedRows);

    expect(parsedRows).toHaveLength(2);
    expect(mappedRows[0]?.hasCostCandidate).toBe(true);
    expect(mappedRows[0]?.rowStatus).toBe("candidate");
    expect(mappedRows[1]?.rowStatus).toBe("needs_manual_review");
    expect(serializedMappedRows).not.toContain("MOCK_PRICE");
    expect(serializedMappedRows).not.toContain("123.45");
  });
});

describeWithDb("Quote Task 009H row import mapper local/test DB integration", () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: resolvedTestDatabaseUrl
      }
    }
  });

  beforeAll(async () => {
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: "row-import-mapper-test-" } }
    });
  });

  afterAll(async () => {
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: "row-import-mapper-test-" } }
    });
    await prisma.$disconnect();
  });

  it("creates and reads back sanitized staging rows in a local/test DB", async () => {
    const batch = await createQuoteSourceStagingBatch(
      prisma,
      {
        sourceFileName: `${sourcePrefix}-integration.xlsx`,
        adapterId: "condenser-cost-2026",
        category: "冷凝器",
        dryRunDecisionStatus: "manual_review_required",
        status: "dry_run_passed",
        warnings: ["009H local/test mapper integration。"]
      },
      repositoryOptions()
    );
    const mappedRows = mapQuoteSourceWorkbookRowsToStagingRows({
      batchId: batch.id,
      adapterId: "condenser-cost-2026",
      category: "冷凝器",
      sourceFileName: batch.sourceFileName,
      rows: [
        {
          sourceRowNumber: 2,
          columns: {
            "KJ编码": "KJMOCK-COND-009",
            "产品名称": "Mock DB condenser",
            "出口成本": true
          }
        }
      ]
    });
    const createdRows = await createQuoteSourceStagingRows(
      prisma,
      batch.id,
      mappedRows,
      repositoryOptions()
    );
    const found = await getQuoteSourceStagingBatchById(prisma, batch.id, repositoryOptions());

    expect(createdRows).toHaveLength(1);
    expect(found?.rows).toHaveLength(1);
    expect(found?.rows[0]?.rowStatus).toBe("candidate");
    expect(found?.rows[0]?.visibility).toBe("finance_only");
    expect(JSON.stringify(found)).not.toContain("MOCK_PRICE");
  });

  it("cleans local/test staging rows and batch", async () => {
    await prisma.quoteSourceStagingBatch.deleteMany({
      where: { sourceFileName: { startsWith: sourcePrefix } }
    });

    const batchCount = await prisma.quoteSourceStagingBatch.count({
      where: { sourceFileName: { startsWith: sourcePrefix } }
    });
    const rowCount = await prisma.quoteSourceStagingRow.count({
      where: {
        batch: {
          sourceFileName: { startsWith: sourcePrefix }
        }
      }
    });

    expect(batchCount).toBe(0);
    expect(rowCount).toBe(0);
  });
});
