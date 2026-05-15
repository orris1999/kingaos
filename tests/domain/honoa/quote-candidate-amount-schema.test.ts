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

function getFieldLine(modelBlock: string, fieldName: string) {
  return modelBlock
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${fieldName} `));
}

function getModelFieldNames(modelBlock: string) {
  return modelBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("model ") && !line.startsWith("@@") && line !== "}")
    .map((line) => line.split(/\s+/)[0]);
}

function findCandidateAmountMigrationSql() {
  const migrationsDir = path.join(repoRoot, "prisma/migrations");
  const migrationDir = readdirSync(migrationsDir).find((entry) =>
    entry.endsWith("_add_quote_candidate_amount_storage")
  );

  if (!migrationDir) {
    throw new Error("Missing add_quote_candidate_amount_storage migration");
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

describe("Quote Task 009N quote candidate amount Prisma schema", () => {
  it("contains QuoteCandidateAmount model and required source fields", () => {
    const block = getModelBlock("QuoteCandidateAmount");

    expect(block).toContain("model QuoteCandidateAmount");
    expect(getFieldLine(block, "stagingBatchId")).toContain("String");
    expect(getFieldLine(block, "stagingRowId")).toContain("String");
    expect(getFieldLine(block, "tradeMode")).toContain("String");
    expect(getFieldLine(block, "currency")).toContain("String");
  });

  it("stores candidateValue without formal price field names", () => {
    const block = getModelBlock("QuoteCandidateAmount");

    expect(getFieldLine(block, "candidateValue")).toContain("Decimal");
    expect(getFieldLine(block, "candidateValue")).toContain("@db.Decimal(18, 4)");
    expect(getModelFieldNames(block)).not.toContain("costPrice");
    expect(getModelFieldNames(block)).not.toContain("quotePrice");
    expect(getModelFieldNames(block)).not.toContain("approvedPrice");
    expect(getModelFieldNames(block)).not.toContain("financeApprovedPrice");
    expect(getModelFieldNames(block)).not.toContain("minimumPrice");
    expect(getModelFieldNames(block)).not.toContain("grossMargin");
    expect(getModelFieldNames(block)).not.toContain("margin");
    expect(getModelFieldNames(block)).not.toContain("profit");
  });

  it("defaults visibility, status, and finance approval boundary fields safely", () => {
    const block = getModelBlock("QuoteCandidateAmount");

    expect(getFieldLine(block, "visibility")).toContain('@default("finance_only")');
    expect(getFieldLine(block, "status")).toContain('@default("not_finance_approved")');
    expect(getFieldLine(block, "isFinanceApprovedPrice")).toContain("Boolean");
    expect(getFieldLine(block, "isFinanceApprovedPrice")).toContain("@default(false)");
    expect(getFieldLine(block, "canBeSentToCustomer")).toContain("@default(false)");
    expect(getFieldLine(block, "requiresFinancePricing")).toContain("@default(true)");
    expect(getFieldLine(block, "isFinanceApprovedPrice")).not.toContain("Decimal");
  });

  it("keeps candidate amount storage separate from QuoteSourceStagingRow", () => {
    const rowBlock = getModelBlock("QuoteSourceStagingRow");

    expect(getModelFieldNames(rowBlock)).not.toContain("candidateValue");
    expect(getModelFieldNames(rowBlock)).not.toContain("candidateValueDecimal");
    expect(getModelFieldNames(rowBlock)).not.toContain("costPrice");
    expect(getModelFieldNames(rowBlock)).not.toContain("quotePrice");
  });

  it("migration creates only additive candidate amount table and indexes", () => {
    const sql = findCandidateAmountMigrationSql();

    expect(sql).toContain('CREATE TABLE "QuoteCandidateAmount"');
    expect(sql).toContain('"candidateValue" DECIMAL(18,4) NOT NULL');
    expect(sql).toContain('CREATE INDEX "QuoteCandidateAmount_stagingBatchId_idx"');
    expect(sql).toContain('CREATE INDEX "QuoteCandidateAmount_stagingRowId_idx"');
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE[\s\S]*\bDROP\b/i);
  });

  it("does not add quote candidate amount API route or server action", () => {
    const apiFiles = listFiles(path.join(repoRoot, "app/api"));
    const candidateAmountApiFiles = apiFiles.filter((file) =>
      /candidate-amount|candidateAmount|quote-candidate-amount|quoteCandidateAmount/.test(file)
    );

    expect(candidateAmountApiFiles).toEqual([]);
  });
});
