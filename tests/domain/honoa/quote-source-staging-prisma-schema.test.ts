import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const schemaPath = path.join(repoRoot, "prisma/schema.prisma");

function readSchema() {
  return readFileSync(schemaPath, "utf8");
}

function getModelBlock(modelName: string) {
  const match = readSchema().match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`));

  if (!match) {
    throw new Error(`Missing Prisma model ${modelName}`);
  }

  return match[0];
}

function findQuoteSourceMigrationSql() {
  const migrationsDir = path.join(repoRoot, "prisma/migrations");
  const migrationDir = readdirSync(migrationsDir).find((entry) =>
    entry.endsWith("_add_quote_source_staging_metadata")
  );

  if (!migrationDir) {
    throw new Error("Missing add_quote_source_staging_metadata migration");
  }

  return readFileSync(path.join(migrationsDir, migrationDir, "migration.sql"), "utf8");
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);

    return stats.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

describe("Quote Task 006B Finance quote source staging Prisma schema", () => {
  it("contains QuoteSourceStagingBatch and QuoteSourceStagingRow models", () => {
    expect(getModelBlock("QuoteSourceStagingBatch")).toContain("model QuoteSourceStagingBatch");
    expect(getModelBlock("QuoteSourceStagingRow")).toContain("model QuoteSourceStagingRow");
  });

  it("Batch model has finance/export metadata defaults", () => {
    const block = getModelBlock("QuoteSourceStagingBatch");

    expect(block).toContain('submittedByRole');
    expect(block).toContain('@default("finance")');
    expect(block).toContain('consumerDepartment');
    expect(block).toContain('@default("export")');
    expect(block).toContain("dryRunDecisionStatus");
    expect(block).toContain("status");
  });

  it("Row model has staging status, visibility, and candidate status metadata", () => {
    const block = getModelBlock("QuoteSourceStagingRow");

    expect(block).toContain("visibility");
    expect(block).toContain("rowStatus");
    expect(block).toContain("priceCandidateStatus");
    expect(block).toContain("hasCostCandidate");
    expect(block).toContain("hasQuoteCandidate");
  });

  it("Row model does not store concrete amounts or formal price fields", () => {
    const block = getModelBlock("QuoteSourceStagingRow");
    const forbiddenFields = [
      "amount",
      "unitPrice",
      "costPrice",
      "quotePrice",
      "salesPrice",
      "approvedPrice",
      "financeApprovedPrice",
      "minimumPrice",
      "grossMargin",
      "margin",
      "profit",
      "sentToCustomer",
      "officialQuote"
    ];

    for (const field of forbiddenFields) {
      expect(block).not.toMatch(new RegExp(`\\b${field}\\b`));
    }
  });

  it("migration creates only additive quote source staging tables and indexes", () => {
    const sql = findQuoteSourceMigrationSql();

    expect(sql).toContain('CREATE TABLE "QuoteSourceStagingBatch"');
    expect(sql).toContain('CREATE TABLE "QuoteSourceStagingRow"');
    expect(sql).toContain('CREATE INDEX "QuoteSourceStagingBatch_adapterId_idx"');
    expect(sql).toContain('CREATE INDEX "QuoteSourceStagingRow_batchId_idx"');
    expect(sql).toContain('FOREIGN KEY ("batchId")');
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE[\s\S]*\bDROP\b/i);
  });

  it("no quote source staging import or quote draft API route was added", () => {
    const apiFiles = listFiles(path.join(repoRoot, "app/api"));
    const quoteSourceApiFiles = apiFiles.filter((file) =>
      /quote-source|quoteSource|quote-draft|quoteDraft/.test(file)
    ).filter((file) => !file.includes("quote-source-upload"));

    expect(quoteSourceApiFiles).toEqual([]);
  });
});
