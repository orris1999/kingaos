"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type UploadUrlResponse = {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
  sourceFileName: string;
  originalFileName: string;
  fileExt: string;
  mimeType: string;
  fileSize: number;
  error?: string;
};

export function FinanceQuoteSourceUpload({ ossConfigured }: { ossConfigured: boolean }) {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [adapterId, setAdapterId] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");

  async function upload() {
    if (!file) {
      setMessage("请选择 .xls / .xlsx 报价表文件。");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const uploadRes = await fetch("/api/finance/quote-source-upload/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type
        })
      });
      const uploadPayload = (await uploadRes.json()) as UploadUrlResponse;
      if (!uploadRes.ok) throw new Error(uploadPayload.error || "报价表上传地址生成失败。");

      const ossRes = await fetch(uploadPayload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": uploadPayload.mimeType || file.type },
        body: file
      });
      if (!ossRes.ok) throw new Error("报价表文件上传失败，请稍后重试。");

      const saveRes = await fetch("/api/finance/quote-source-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceFileName: uploadPayload.sourceFileName,
          originalFileName: file.name,
          objectKey: uploadPayload.objectKey,
          mimeType: uploadPayload.mimeType,
          fileSize: uploadPayload.fileSize || file.size,
          adapterId,
          category,
          notes
        })
      });
      const savePayload = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) throw new Error(savePayload.error || "报价表上传记录保存失败。");

      setFile(null);
      setAdapterId("");
      setCategory("");
      setNotes("");
      setMessage("报价表文件上传成功，已保存文件元数据。当前不会导入价格或生成报价。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "报价表上传失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel stack">
      <div>
        <h2>上传报价表文件</h2>
        <p className="muted">仅支持 .xls / .xlsx，单个文件最大 50MB。文件上传到私有 OSS，数据库只保存文件元数据。</p>
      </div>
      {!ossConfigured ? <p className="warn-text">OSS 尚未配置，暂时不能上传文件。请联系管理员配置阿里云 OSS。</p> : null}
      <div className="form-grid">
        <label>
          文件
          <input
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={!ossConfigured || busy}
            type="file"
            onChange={(event) => setFile(event.currentTarget.files?.[0] || null)}
          />
        </label>
        <label>
          adapterId（可选）
          <input disabled={!ossConfigured || busy} value={adapterId} onChange={(event) => setAdapterId(event.target.value)} />
        </label>
        <label>
          品类（可选）
          <input disabled={!ossConfigured || busy} value={category} onChange={(event) => setCategory(event.target.value)} />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          备注（可选）
          <textarea disabled={!ossConfigured || busy} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <div>
          <button disabled={!ossConfigured || busy} type="button" onClick={upload}>
            {busy ? "上传中..." : "上传报价表"}
          </button>
        </div>
      </div>
      {message ? <p className={message.includes("成功") ? "tiny ok-text" : "tiny warn-text"}>{message}</p> : null}
      <p className="tiny muted">本页面不解析 Excel、不保存 KJ 行、不保存金额、不创建 staging rows，也不生成报价草稿或正式报价。</p>
    </section>
  );
}

export function FinanceQuoteSourceUploadDryRunButton({
  uploadId,
  dryRunEnabled,
  uploadStatus
}: {
  uploadId: string;
  dryRunEnabled: boolean;
  uploadStatus: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const canRun = dryRunEnabled && uploadStatus === "uploaded";

  async function runDryRun() {
    if (!canRun) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/finance/quote-source-upload/${uploadId}/dry-run`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "结构识别 dry-run 执行失败。");
      setMessage("结构识别 dry-run 已完成，仅保存 workbook / sheet / 表头元数据。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "结构识别 dry-run 执行失败。");
    } finally {
      setBusy(false);
    }
  }

  if (!dryRunEnabled) {
    return (
      <div className="stack compact">
        <button disabled type="button">dry-run 暂未开放</button>
        <span className="tiny muted">production 默认关闭，不会读取文件结构。</span>
      </div>
    );
  }

  return (
    <div className="stack compact">
      <button disabled={!canRun || busy} type="button" onClick={runDryRun}>
        {busy ? "识别中..." : "执行结构识别 dry-run"}
      </button>
      {uploadStatus !== "uploaded" ? <span className="tiny muted">仅 uploaded 状态可执行。</span> : null}
      {message ? <span className={message.includes("完成") ? "tiny ok-text" : "tiny warn-text"}>{message}</span> : null}
    </div>
  );
}

export function FinanceQuoteSourceUploadDryRunConfirmButton({
  uploadId,
  confirmEnabled,
  dryRunStatus,
  stagingBatchId
}: {
  uploadId: string;
  confirmEnabled: boolean;
  dryRunStatus: string;
  stagingBatchId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const alreadyConfirmed = Boolean(stagingBatchId);
  const canConfirm = confirmEnabled && dryRunStatus === "completed" && !alreadyConfirmed;

  async function confirmDryRun() {
    if (!canConfirm) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/finance/quote-source-upload/${uploadId}/confirm-dry-run`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "dry-run 确认失败。");
      setMessage("dry-run 已确认进入 staging batch metadata；未创建 rows，未导入价格。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "dry-run 确认失败。");
    } finally {
      setBusy(false);
    }
  }

  if (!confirmEnabled) {
    return (
      <div className="stack compact">
        <button disabled type="button">dry-run 确认暂未开放</button>
        <span className="tiny muted">production 默认关闭，不会创建 staging batch。</span>
      </div>
    );
  }

  return (
    <div className="stack compact">
      <button disabled={!canConfirm || busy} type="button" onClick={confirmDryRun}>
        {busy ? "确认中..." : alreadyConfirmed ? "dry-run 已确认" : "确认 dry-run 结果进入 staging"}
      </button>
      {dryRunStatus !== "completed" ? <span className="tiny muted">仅 completed dry-run 可确认。</span> : null}
      {alreadyConfirmed ? <span className="tiny ok-text">stagingBatchId: {stagingBatchId}</span> : null}
      {message ? <span className={message.includes("已确认") ? "tiny ok-text" : "tiny warn-text"}>{message}</span> : null}
    </div>
  );
}
