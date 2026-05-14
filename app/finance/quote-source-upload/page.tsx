import Link from "next/link";
import {
  FinanceQuoteSourceUpload,
  FinanceQuoteSourceUploadDryRunButton,
  FinanceQuoteSourceUploadDryRunConfirmButton
} from "@/components/finance-quote-source-upload";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { requireCurrentUser } from "@/lib/honoa/server/auth";
import {
  isFinanceQuoteSourceDryRunConfirmEnabled,
  isFinanceQuoteSourceDryRunEnabled
} from "@/lib/honoa/server/feature-flags";
import { isOssConfigured } from "@/lib/honoa/server/oss";
import { listQuoteSourceUploads, quoteSourceUploadViewModel } from "@/lib/honoa/server/quote-source-upload";

function formatFileSize(size?: number | null) {
  if (!size || size <= 0) return "-";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDryRunStatus(status?: string | null) {
  switch (status) {
    case "completed":
      return "结构识别完成";
    case "needs_review":
      return "需人工复核";
    case "failed":
      return "识别失败";
    case "not_run":
    default:
      return "未执行";
  }
}

export default async function FinanceQuoteSourceUploadPage() {
  const user = await requireCurrentUser();
  if (user.role !== "super_admin") {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能上传财务报价表文件。" />
      </KingaShell>
    );
  }

  const uploads = (await listQuoteSourceUploads(50)).map(quoteSourceUploadViewModel);
  const dryRunEnabled = isFinanceQuoteSourceDryRunEnabled();
  const dryRunConfirmEnabled = isFinanceQuoteSourceDryRunConfirmEnabled();
  return (
    <KingaShell user={user}>
      <div className="stack">
        <section className="page-hero">
          <div>
            <div className="breadcrumbs">
              <Link href="/finance">KingaOS / 财务部</Link> / 报价表上传
            </div>
            <h1>报价表上传</h1>
            <p className="muted">
              财务报价表文件上传试点。当前只保存文件和上传元数据，不导入价格，不生成正式报价。
            </p>
          </div>
          <span className="tag warn">Pilot</span>
        </section>

        <section className="notice warn-notice">
          <h2>上传边界</h2>
          <p>本页面只上传财务报价表文件。</p>
          <p>当前不导入价格，不生成报价草稿，不生成正式报价。</p>
          <p>上传文件不是财务批准价格，也不是正式价格表。</p>
          <p>出口部不能上传或维护报价表。</p>
        </section>

        <FinanceQuoteSourceUpload ossConfigured={isOssConfigured()} />

        <section className="panel stack">
          <div className="split">
            <div>
              <h2>上传记录</h2>
              <p className="muted">这里只展示文件 metadata 和 dry-run 结构摘要，不展示 Excel 内容、KJ 明细、OEM 明细或任何金额。</p>
            </div>
            <span className="tag">{uploads.length} 条</span>
          </div>
          {!dryRunEnabled ? (
            <p className="warn-text">dry-run 暂未开放。当前页面只展示已上传文件 metadata，不读取文件结构。</p>
          ) : (
            <p className="muted">dry-run 开启后仅执行 workbook / sheet / 表头结构识别，不导入价格、不创建 staging rows。</p>
          )}
          {!dryRunConfirmEnabled ? (
            <p className="warn-text">dry-run 确认暂未开放。当前不会创建 staging batch metadata。</p>
          ) : (
            <p className="muted">dry-run 确认开启后仅创建 staging batch metadata，不创建 staging rows、不导入价格。</p>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>文件名</th>
                  <th>大小</th>
                  <th>上传人</th>
                  <th>上传时间</th>
                  <th>状态</th>
                  <th>adapterId</th>
                  <th>品类</th>
                  <th>dry-run</th>
                  <th>确认</th>
                  <th>结构摘要</th>
                  <th>字段检测</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {uploads.length > 0 ? (
                  uploads.map((upload) => (
                    <tr key={upload.id}>
                      <td>{upload.sourceFileName}</td>
                      <td>{formatFileSize(upload.fileSize)}</td>
                      <td>{upload.uploadedByName || "-"}</td>
                      <td>{formatDate(upload.uploadedAt)}</td>
                      <td><span className="tag ok">{upload.uploadStatus}</span></td>
                      <td>{upload.adapterId || "-"}</td>
                      <td>{upload.category || "-"}</td>
                      <td>
                        <span className={upload.dryRunStatus === "completed" ? "tag ok" : upload.dryRunStatus === "needs_review" ? "tag warn" : "tag"}>
                          {formatDryRunStatus(upload.dryRunStatus)}
                        </span>
                        {upload.dryRunAt ? <div className="tiny muted">{formatDate(upload.dryRunAt)}</div> : null}
                      </td>
                      <td>
                        {upload.stagingBatchId ? (
                          <div className="stack compact">
                            <span className="tag ok">dry-run 已确认</span>
                            <span className="tiny">stagingBatchId: {upload.stagingBatchId}</span>
                            {upload.dryRunConfirmedAt ? <span className="tiny muted">{formatDate(upload.dryRunConfirmedAt)}</span> : null}
                            {upload.dryRunConfirmedByName ? <span className="tiny muted">{upload.dryRunConfirmedByName}</span> : null}
                          </div>
                        ) : (
                          <span className="tag">未确认</span>
                        )}
                      </td>
                      <td>
                        <div className="tiny">adapter: {upload.dryRunAdapterId || "-"}</div>
                        <div className="tiny">品类: {upload.dryRunCategory || "-"}</div>
                        <div className="tiny">sheet 数量: {upload.dryRunSheetCount ?? "-"}</div>
                        <div className="tiny">mappedColumns: {upload.dryRunMappedColumnKeys.length > 0 ? upload.dryRunMappedColumnKeys.join(", ") : "-"}</div>
                      </td>
                      <td>
                        <div className="tiny">KJ: {upload.dryRunFieldDetection.hasKjColumn ? "已检测" : "-"}</div>
                        <div className="tiny">OEM / OE: {upload.dryRunFieldDetection.hasOemOrOeColumn ? "已检测" : "-"}</div>
                        <div className="tiny">产品名称: {upload.dryRunFieldDetection.hasProductNameColumn ? "已检测" : "-"}</div>
                        <div className="tiny">成本候选: {upload.dryRunFieldDetection.hasCostCandidateColumn ? "已检测" : "-"}</div>
                        <div className="tiny">报价候选: {upload.dryRunFieldDetection.hasQuoteCandidateColumn ? "已检测" : "-"}</div>
                        <div className="tiny">包装: {upload.dryRunFieldDetection.hasPackagingColumn ? "已检测" : "-"}</div>
                        {upload.dryRunWarnings.length > 0 ? (
                          <div className="tiny warn-text">{upload.dryRunWarnings.slice(0, 3).join(" / ")}</div>
                        ) : null}
                      </td>
                      <td>
                        <FinanceQuoteSourceUploadDryRunButton
                          dryRunEnabled={dryRunEnabled}
                          uploadId={upload.id}
                          uploadStatus={upload.uploadStatus}
                        />
                        <FinanceQuoteSourceUploadDryRunConfirmButton
                          confirmEnabled={dryRunConfirmEnabled}
                          dryRunStatus={upload.dryRunStatus}
                          stagingBatchId={upload.stagingBatchId}
                          uploadId={upload.id}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="muted" colSpan={12}>暂无报价表上传记录。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </KingaShell>
  );
}
