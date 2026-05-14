import Link from "next/link";
import { FinanceQuoteSourceUpload } from "@/components/finance-quote-source-upload";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { requireCurrentUser } from "@/lib/honoa/server/auth";
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
              <p className="muted">这里只展示文件 metadata，不展示 Excel 内容、KJ 明细、OEM 明细或任何金额。</p>
            </div>
            <span className="tag">{uploads.length} 条</span>
          </div>
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
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="muted" colSpan={7}>暂无报价表上传记录。</td>
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
