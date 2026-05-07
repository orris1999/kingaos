"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type UploadResponse = {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
  mimeType: string;
  fileSize: number;
  error?: string;
};

export function CustomerOssUpload({
  customerId,
  attachmentTypes,
  defaultAttachmentType,
  ossConfigured,
  fieldKey,
  fieldLabel
}: {
  customerId: string;
  attachmentTypes: string[];
  defaultAttachmentType?: string;
  ossConfigured: boolean;
  fieldKey?: string;
  fieldLabel?: string;
}) {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [attachmentName, setAttachmentName] = React.useState("");
  const [attachmentType, setAttachmentType] = React.useState(defaultAttachmentType || attachmentTypes[0] || "其他");
  const [description, setDescription] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function upload() {
    if (!file) {
      setMessage("请选择要上传的文件。");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const uploadRes = await fetch(`/api/export/customers/${customerId}/attachments/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          attachmentType,
          description,
          fieldKey,
          fieldLabel
        })
      });
      const uploadPayload = (await uploadRes.json()) as UploadResponse;
      if (!uploadRes.ok) throw new Error(uploadPayload.error || "附件上传地址生成失败。");

      const ossRes = await fetch(uploadPayload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": uploadPayload.mimeType || file.type },
        body: file
      });
      if (!ossRes.ok) throw new Error("附件上传失败，请稍后重试。");

      const saveRes = await fetch(`/api/export/customers/${customerId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachmentName: attachmentName.trim() || file.name,
          attachmentType,
          objectKey: uploadPayload.objectKey,
          mimeType: uploadPayload.mimeType || file.type,
          fileSize: uploadPayload.fileSize || file.size,
          description,
          fieldKey,
          fieldLabel
        })
      });
      const savePayload = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) throw new Error(savePayload.error || "附件保存失败。");
      setFile(null);
      setAttachmentName("");
      setDescription("");
      setMessage("附件上传成功。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "附件上传失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="subpanel stack">
      <h3>{fieldLabel ? `上传${fieldLabel}` : "上传文件"}</h3>
      {!ossConfigured ? <p className="muted">OSS 尚未配置，暂时不能上传文件。请联系管理员配置阿里云 OSS。</p> : null}
      <div className="form-grid">
        <label>
          选择文件
          <input
            disabled={!ossConfigured || busy}
            type="file"
            onChange={(event) => {
              const nextFile = event.currentTarget.files?.[0] || null;
              setFile(nextFile);
              if (nextFile && !attachmentName) setAttachmentName(nextFile.name);
            }}
          />
        </label>
        <label>附件名称<input disabled={!ossConfigured || busy} value={attachmentName} onChange={(event) => setAttachmentName(event.target.value)} /></label>
        <label>
          附件类型
          <select disabled={!ossConfigured || busy} value={attachmentType} onChange={(event) => setAttachmentType(event.target.value)}>
            {attachmentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label style={{ gridColumn: "1 / -1" }}>附件说明<textarea disabled={!ossConfigured || busy} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <div><button disabled={!ossConfigured || busy} type="button" onClick={upload}>{busy ? "上传中..." : "上传文件"}</button></div>
      </div>
      {message ? <p className={message.includes("成功") ? "tiny ok-text" : "tiny warn-text"}>{message}</p> : null}
      <p className="tiny muted">支持图片、PDF、Word、Excel、文本文件，单个文件最大 20MB。文件直接上传到私有 OSS，数据库只保存附件元数据。</p>
    </div>
  );
}

export function CustomerAttachmentDownloadButton({
  customerId,
  attachmentId
}: {
  customerId: string;
  attachmentId: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");

  async function openSignedUrl() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/export/customers/${customerId}/attachments/${attachmentId}/download-url`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "附件下载地址生成失败。");
      if (!payload.downloadUrl) throw new Error("附件地址为空。");
      window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "附件下载地址生成失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-stack">
      <button className="ghost" disabled={busy} type="button" onClick={openSignedUrl}>{busy ? "生成中..." : "下载 / 预览"}</button>
      {message ? <span className="tiny warn-text">{message}</span> : null}
    </span>
  );
}
