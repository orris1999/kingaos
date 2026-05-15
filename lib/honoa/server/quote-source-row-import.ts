import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "./auth";
import { prisma } from "./db";
import { isFinanceQuoteSourceRowImportEnabled } from "./feature-flags";
import { readQuoteSourceUploadObjectBuffer } from "./quote-source-upload-dry-run";
import {
  createQuoteSourceStagingRows,
  FINANCE_QUOTE_SOURCE_ROW_IMPORT_UAT_REASON,
  mapQuoteSourceWorkbookRowsToStagingRows,
  parseQuoteSourceWorkbookRowsFromBuffer
} from "../quote-draft";
import type { CreateQuoteSourceStagingRowInput } from "../quote-draft";

export type ImportQuoteSourceRowsInput = {
  batchId: string;
};

type QuoteSourceRowImportPrisma = Pick<
  PrismaClient,
  "quoteSourceStagingBatch" | "quoteSourceStagingRow" | "quoteSourceUpload" | "auditLog" | "$transaction"
>;

type ImportQuoteSourceRowsOptions = {
  db?: QuoteSourceRowImportPrisma;
  databaseUrl?: string;
  rowImportEnabled?: boolean;
  readObjectBuffer?: (upload: { storageKey: string }) => Promise<Buffer>;
};

const SUPPORTED_ADAPTER_ID = "condenser-cost-2026";
const SUPPORTED_CATEGORY = "冷凝器";

const FORBIDDEN_ROW_IMPORT_METADATA_KEYS = [
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
  "officialQuote",
  "excelRows",
  "rawRow",
  "fullRow",
  "columns",
  "signedUrl",
  "accessKey",
  "storageKey"
];

function assertNoForbiddenRowImportMetadataKeys(value: unknown) {
  const stack = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    for (const [key, nested] of Object.entries(current)) {
      const normalized = key.toLowerCase();
      const forbidden = FORBIDDEN_ROW_IMPORT_METADATA_KEYS.find((field) => normalized.includes(field.toLowerCase()));
      if (forbidden) {
        throw new Error(`row import metadata cannot include forbidden field key: ${forbidden}`);
      }
      stack.push(nested);
    }
  }
}

function countRows(rows: CreateQuoteSourceStagingRowInput[], rowStatus: string) {
  return rows.filter((row) => row.rowStatus === rowStatus).length;
}

function assertCanImportQuoteSourceRows(actor: AuthUser) {
  if (actor.role !== "super_admin") {
    throw new Error("当前账号不能执行报价表行级导入。");
  }
}

function assertBatchCanImportRows(batch: {
  id: string;
  status: string;
  adapterId: string;
  category: string | null;
  rows: unknown[];
}) {
  if (batch.status !== "dry_run_passed") {
    throw new Error("只有 dry_run_passed 状态的 staging batch 可以导入 rows。");
  }
  if (batch.adapterId !== SUPPORTED_ADAPTER_ID) {
    throw new Error("009I 第一版只支持 condenser-cost-2026 adapter。");
  }
  if (batch.category !== SUPPORTED_CATEGORY) {
    throw new Error("009I 第一版只支持冷凝器 category。");
  }
  if (batch.rows.length > 0) {
    throw new Error("当前 staging batch 已有 rows，不能重复导入。");
  }
}

function assertUploadCanImportRows(upload: {
  uploadStatus: string;
  dryRunStatus: string | null;
  stagingBatchId: string | null;
  storageKey: string;
}, batchId: string) {
  if (upload.uploadStatus !== "uploaded") {
    throw new Error("只有 uploaded 状态的报价表上传记录可以导入 rows。");
  }
  if (upload.dryRunStatus !== "completed") {
    throw new Error("只有 dryRunStatus=completed 的报价表上传记录可以导入 rows。");
  }
  if (upload.stagingBatchId !== batchId) {
    throw new Error("报价表上传记录未关联到当前 staging batch。");
  }
  if (!upload.storageKey) {
    throw new Error("报价表上传记录缺少 storageKey，不能导入 rows。");
  }
}

function assertRowsSafeForImport(rows: CreateQuoteSourceStagingRowInput[]) {
  if (rows.length === 0) {
    throw new Error("未识别到可导入的行级候选 metadata。");
  }
  assertNoForbiddenRowImportMetadataKeys(rows);
  for (const row of rows) {
    if (row.visibility !== "finance_only") {
      throw new Error("row import 只能创建 finance_only rows。");
    }
  }
}

async function getQuoteSourceUploadByStagingBatchId(stagingBatchId: string, db: QuoteSourceRowImportPrisma) {
  return db.quoteSourceUpload.findFirst({
    where: { stagingBatchId },
    select: {
      id: true,
      sourceFileName: true,
      originalFileName: true,
      fileExt: true,
      mimeType: true,
      fileSize: true,
      storageProvider: true,
      storageKey: true,
      uploadStatus: true,
      dryRunStatus: true,
      dryRunAdapterId: true,
      dryRunCategory: true,
      stagingBatchId: true
    }
  });
}

export async function importQuoteSourceRows(
  actor: AuthUser,
  input: ImportQuoteSourceRowsInput,
  options: ImportQuoteSourceRowsOptions = {}
) {
  assertCanImportQuoteSourceRows(actor);
  if (!(options.rowImportEnabled ?? isFinanceQuoteSourceRowImportEnabled())) {
    throw new Error("财务报价表 row import 暂未开放。");
  }

  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  const db = options.db ?? prisma;
  const batch = await db.quoteSourceStagingBatch.findUnique({
    where: { id: input.batchId },
    include: {
      rows: {
        select: { id: true }
      }
    }
  });
  if (!batch) throw new Error("staging batch 不存在。");
  assertBatchCanImportRows(batch);

  const upload = await getQuoteSourceUploadByStagingBatchId(batch.id, db);
  if (!upload) {
    throw new Error("未找到与该 staging batch 关联的报价表上传记录。");
  }
  assertUploadCanImportRows(upload, batch.id);

  const readObjectBuffer = options.readObjectBuffer ?? readQuoteSourceUploadObjectBuffer;
  const fileBuffer = await readObjectBuffer(upload);
  const workbookRows = parseQuoteSourceWorkbookRowsFromBuffer({
    sourceFileName: upload.sourceFileName,
    fileBuffer,
    adapterId: batch.adapterId
  });
  const rows = mapQuoteSourceWorkbookRowsToStagingRows({
    batchId: batch.id,
    adapterId: batch.adapterId,
    category: batch.category ?? "",
    sourceFileName: batch.sourceFileName,
    rows: workbookRows
  });

  assertRowsSafeForImport(rows);

  const auditMetadata = {
    batchId: batch.id,
    adapterId: batch.adapterId,
    category: batch.category,
    rowCount: rows.length,
    candidateRows: countRows(rows, "candidate"),
    needsManualReviewRows: countRows(rows, "needs_manual_review"),
    actorUserId: actor.id,
    actorName: actor.name
  };
  assertNoForbiddenRowImportMetadataKeys(auditMetadata);

  return db.$transaction(async (tx) => {
    const currentBatch = await tx.quoteSourceStagingBatch.findUnique({
      where: { id: batch.id },
      include: {
        rows: {
          select: { id: true }
        }
      }
    });
    if (!currentBatch) throw new Error("staging batch 不存在。");
    assertBatchCanImportRows(currentBatch);

    const createdRows = await createQuoteSourceStagingRows(
      tx,
      currentBatch.id,
      rows,
      {
        databaseUrl,
        allowControlledProductionWrite: true,
        productionWriteReason: FINANCE_QUOTE_SOURCE_ROW_IMPORT_UAT_REASON
      }
    );
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "quote_source_staging.rows_imported",
        entityType: "QuoteSourceStagingBatch",
        entityId: currentBatch.id,
        metadata: auditMetadata
      }
    });

    return {
      batch: currentBatch,
      rows: createdRows,
      auditMetadata
    };
  });
}
