import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import xlsx from "xlsx";

const SCRIPT_PATH = path.join(process.cwd(), "scripts/quote-source-dry-run.mjs");

function createMockWorkbook() {
  const dir = mkdtempSync(path.join(tmpdir(), "kingaos-quote-source-"));
  const filePath = path.join(dir, "mock-冷凝器成本报价表.xlsx");
  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet([
    ["KJ编码", "OE", "出口成本", "车型车系"],
    ["KJMOCK001", "OEM-MOCK", 0, "Mock Model"]
  ]);

  xlsx.utils.book_append_sheet(workbook, sheet, "2026年冷凝器成本核算");
  xlsx.writeFile(workbook, filePath);

  return filePath;
}

function runCli(args: string[]) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

describe("Quote Task 003C quote source dry-run CLI", () => {
  it("没有 --file 时拒绝执行", () => {
    const result = runCli([]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("必须显式传入 --file");
  });

  it("不会默认扫描目录", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kingaos-quote-source-dir-"));
    const result = runCli(["--file", dir]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("不能传目录");
  });

  it("help 能说明必须显式传 --file", () => {
    const result = runCli(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--file");
    expect(result.stdout).toContain("不会默认扫描目录");
  });

  it("metadata extraction 不输出真实价格值", () => {
    const filePath = createMockWorkbook();
    const result = runCli(["--file", filePath, "--json"]);

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("12345.67");
    expect(result.stdout).not.toContain("Mock Model");
    expect(result.stdout).not.toContain("KJMOCK001");
  });

  it("price / cost 列只显示是否检测到，不显示数值", () => {
    const filePath = createMockWorkbook();
    const result = runCli(["--file", filePath, "--json"]);
    const output = JSON.parse(result.stdout);

    expect(output.priceColumnDetection.hasCostCandidate).toBe(true);
    expect(output.priceColumnDetection.hasQuoteCandidate).toBe(false);
    expect(JSON.stringify(output)).not.toContain('"amount"');
  });

  it("dry-run summary 包含 finance 提交和 export 消费", () => {
    const filePath = createMockWorkbook();
    const result = runCli(["--file", filePath, "--json"]);
    const output = JSON.parse(result.stdout);

    expect(output.dryRunSummary.submittedByRole).toBe("finance");
    expect(output.dryRunSummary.consumerDepartment).toBe("export");
  });

  it("warnings 包含价格和出口部维护边界", () => {
    const filePath = createMockWorkbook();
    const result = runCli(["--file", filePath, "--json"]);
    const output = JSON.parse(result.stdout);
    const warnings = output.dryRunSummary.warnings.join(" ");

    expect(warnings).toContain("成本价不是财务批准价格");
    expect(warnings).toContain("出口部不能上传或维护报价表");
  });

  it("不写数据库、不读取 production 数据、不生成正式报价", () => {
    const source = readFileSync(SCRIPT_PATH, "utf8");

    expect(source).not.toContain("PrismaClient");
    expect(source).not.toContain("DATABASE_URL");
    expect(source).not.toContain("createMany");
    expect(source).not.toContain("sent" + "To" + "Customer");
  });

  it("输出不包含正式报价误导字段", () => {
    const filePath = createMockWorkbook();
    const result = runCli(["--file", filePath, "--json"]);
    const text = result.stdout;

    expect(text).not.toContain("finance" + "Approved" + "Price");
    expect(text).not.toContain("official" + "Quote");
    expect(text).not.toContain("sent" + "_to" + "_customer");
  });
});
