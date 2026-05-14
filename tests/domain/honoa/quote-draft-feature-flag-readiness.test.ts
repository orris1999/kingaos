import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildExportQuoteDraftExcelFileName,
  buildExportQuoteDraftPreviewLines,
  buildExportQuoteDraftWorkbookRows,
  summarizeExportQuoteDraftPreviewLines,
  type ExportQuoteDraftSourceCandidate
} from "@/lib/honoa/quote-draft";
import {
  canAccessExportQuoteDraftWorkbench,
  isExportManagerQuoteDraftTrialEnabled,
  isExportQuoteDraftExcelEnabled,
  isExportStagingQuoteDraftEnabled
} from "@/lib/honoa/server/feature-flags";

function readRepoFile(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

function withMissingEnv(name: string, assertion: () => void) {
  const previous = process.env[name];
  delete process.env[name];
  try {
    assertion();
  } finally {
    if (previous === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = previous;
    }
  }
}

function makeStagingCandidate(overrides: Partial<ExportQuoteDraftSourceCandidate> = {}): ExportQuoteDraftSourceCandidate {
  return {
    source: "finance_confirmed_staging",
    stagingBatchId: "batch-uat-readiness",
    stagingRowId: "row-uat-readiness",
    standardKjCode: "KJMOCK-COND-001",
    productNameCandidate: "Mock condenser",
    category: "冷凝器",
    tradeMode: "export_usd",
    priceCandidateStatus: "not_finance_approved",
    hasCostCandidate: true,
    hasQuoteCandidate: false,
    hasPackagingInfo: false,
    hasOemInfo: false,
    warnings: ["价格候选不是财务批准价格。"],
    ...overrides
  };
}

const SENSITIVE_OUTPUT_TERMS = [
  "amount",
  "costPrice",
  "unitPrice",
  "grossMargin",
  "financeApprovedPrice",
  "officialQuote",
  "sentToCustomer"
];

describe("Quote Task 008G quote draft feature flag readiness", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("verifies staging feature flag missing, false, and true states", () => {
    withMissingEnv("KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT", () => {
      expect(isExportStagingQuoteDraftEnabled()).toBe(false);
    });

    vi.stubEnv("KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT", "false");
    expect(isExportStagingQuoteDraftEnabled()).toBe(false);

    vi.stubEnv("KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT", "true");
    expect(isExportStagingQuoteDraftEnabled()).toBe(true);
  });

  it("verifies Excel export feature flag missing, false, and true states", () => {
    withMissingEnv("KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL", () => {
      expect(isExportQuoteDraftExcelEnabled()).toBe(false);
    });

    vi.stubEnv("KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL", "false");
    expect(isExportQuoteDraftExcelEnabled()).toBe(false);

    vi.stubEnv("KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL", "true");
    expect(isExportQuoteDraftExcelEnabled()).toBe(true);
  });

  it("verifies export manager trial feature flag missing, false, and true states", () => {
    withMissingEnv("KINGA_ENABLE_EXPORT_MANAGER_QUOTE_DRAFT_TRIAL", () => {
      expect(isExportManagerQuoteDraftTrialEnabled()).toBe(false);
    });

    vi.stubEnv("KINGA_ENABLE_EXPORT_MANAGER_QUOTE_DRAFT_TRIAL", "false");
    expect(isExportManagerQuoteDraftTrialEnabled()).toBe(false);

    vi.stubEnv("KINGA_ENABLE_EXPORT_MANAGER_QUOTE_DRAFT_TRIAL", "true");
    expect(isExportManagerQuoteDraftTrialEnabled()).toBe(true);
  });

  it("keeps quote draft workbench manager access behind the dedicated trial flag", () => {
    const superAdmin = { department: "admin", role: "super_admin", isActive: true };
    const exportManager = { department: "export", role: "manager", isActive: true };
    const exportStaff = { department: "export", role: "staff", isActive: true };
    const regularAdmin = { department: "admin", role: "admin", isActive: true };
    const financeManager = { department: "finance", role: "manager", isActive: true };

    expect(canAccessExportQuoteDraftWorkbench(superAdmin, false)).toBe(true);
    expect(canAccessExportQuoteDraftWorkbench(exportManager, false)).toBe(false);
    expect(canAccessExportQuoteDraftWorkbench(exportManager, true)).toBe(true);
    expect(canAccessExportQuoteDraftWorkbench(exportStaff, true)).toBe(false);
    expect(canAccessExportQuoteDraftWorkbench(regularAdmin, true)).toBe(false);
    expect(canAccessExportQuoteDraftWorkbench(financeManager, true)).toBe(false);
    expect(canAccessExportQuoteDraftWorkbench({ ...exportManager, isActive: false }, true)).toBe(false);
  });

  it("keeps feature flags server-side and not exposed with NEXT_PUBLIC", () => {
    const flagHelper = readRepoFile("lib/honoa/server/feature-flags.ts");
    const page = readRepoFile("app/export/quote-draft-workbench/page.tsx");
    const component = readRepoFile("components/quote-draft-workbench.tsx");
    const combined = `${flagHelper}\n${page}\n${component}`;

    expect(flagHelper).toContain("KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT");
    expect(flagHelper).toContain("KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL");
    expect(flagHelper).toContain("KINGA_ENABLE_EXPORT_MANAGER_QUOTE_DRAFT_TRIAL");
    expect(page).toContain("isExportStagingQuoteDraftEnabled");
    expect(page).toContain("isExportQuoteDraftExcelEnabled");
    expect(page).toContain("isExportManagerQuoteDraftTrialEnabled");
    expect(page).toContain("canAccessExportQuoteDraftWorkbench");
    expect(page).toContain("excelExportEnabled={excelExportEnabled}");
    expect(combined).not.toContain("NEXT_PUBLIC_");
  });

  it("verifies mock preview can build draft Excel rows with non-formal warnings", () => {
    vi.stubEnv("KINGA_ENABLE_EXPORT_QUOTE_DRAFT_EXCEL", "true");
    const lines = buildExportQuoteDraftPreviewLines({
      inputText: "KJMOCK-COND-001 100pcs",
      tradeMode: "export_usd",
      sourceMode: "mock"
    });
    const summary = summarizeExportQuoteDraftPreviewLines(lines);
    const rows = buildExportQuoteDraftWorkbookRows(lines, summary);
    const serialized = JSON.stringify(rows);

    expect(isExportQuoteDraftExcelEnabled()).toBe(true);
    expect(lines[0].previewStatus).toBe("ready_for_draft_preview");
    expect(lines[0].quantity).toBe(100);
    expect(serialized).toContain("非正式报价");
    expect(serialized).toContain("价格候选不是财务批准价格");
    expect(buildExportQuoteDraftExcelFileName(new Date("2026-05-14T10:30:00+08:00"))).toContain("草稿");

    for (const term of SENSITIVE_OUTPUT_TERMS) {
      expect(serialized).not.toContain(term);
    }
  });

  it("verifies staging fixture preview keeps only draft-safe warnings", () => {
    vi.stubEnv("KINGA_ENABLE_EXPORT_STAGING_QUOTE_DRAFT", "true");
    const lines = buildExportQuoteDraftPreviewLines({
      inputText: "KJMOCK-COND-001 100pcs",
      tradeMode: "export_usd",
      sourceMode: "finance_confirmed_staging",
      stagingEnabled: true,
      stagingCandidatesByLine: {
        1: [makeStagingCandidate()]
      }
    });
    const serialized = JSON.stringify(lines);

    expect(isExportStagingQuoteDraftEnabled()).toBe(true);
    expect(lines[0].previewStatus).toBe("ready_for_draft_preview");
    expect(lines[0].priceCandidateStatus).toBe("not_finance_approved");
    expect(lines[0].warnings.join(" ")).toContain("不是正式报价");
    expect(lines[0].warnings.join(" ")).toContain("价格候选不是财务批准价格");

    for (const term of SENSITIVE_OUTPUT_TERMS) {
      expect(serialized).not.toContain(term);
    }
  });

  it("verifies feature flag closed UI cannot trigger staging lookup or Excel export", () => {
    const component = readRepoFile("components/quote-draft-workbench.tsx");

    expect(component).toContain('disabled={!stagingCandidatesEnabled}');
    expect(component).toContain("财务确认 staging 候选暂未开放。默认只使用 Mock 数据。");
    expect(component).toContain("disabled={!excelExportEnabled || previewLines.length === 0 || isExcelExportPending}");
    expect(component).toContain("Excel 导出暂未开放。");
    expect(component).toContain("暂无可导出内容。请先生成草稿预览。");
  });

  it("verifies the page does not add persistence, API routes, or Prisma schema", () => {
    const component = readRepoFile("components/quote-draft-workbench.tsx");
    const page = readRepoFile("app/export/quote-draft-workbench/page.tsx");
    const prismaSchema = readRepoFile("prisma/schema.prisma");

    expect(component).not.toContain("fetch(");
    expect(component).not.toContain("action=");
    expect(component).not.toContain("createQuoteDraft");
    expect(page).not.toContain("PrismaClient");
    expect(prismaSchema).not.toContain("model QuoteDraft");
    expect(prismaSchema).not.toContain("model QuoteDraftLine");
    expect(existsSync("app/api/export/quote-draft")).toBe(false);
    expect(existsSync("app/api/export/quote-draft-workbench")).toBe(false);
  });
});
