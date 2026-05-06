import type { CustomerAttachment } from "@prisma/client";
import { CustomerAttachmentDownloadButton, CustomerOssUpload } from "@/components/customer-oss-upload";
import {
  createCustomerAttachmentAction,
  deleteCustomerAttachmentAction,
  updateCustomerAttachmentAction
} from "@/lib/honoa/server/customers";
import { isOssConfigured } from "@/lib/honoa/server/oss";
import { CUSTOMER_ATTACHMENT_TYPES } from "@/lib/honoa/shared/constants";

function formatDate(value: Date) {
  return value.toLocaleString("zh-CN", { hour12: false });
}

function formatFileSize(value?: number | null) {
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentTypeSelect({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <select name="attachmentType" defaultValue={defaultValue || "其他"}>
      {CUSTOMER_ATTACHMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
    </select>
  );
}

export function CustomerAttachmentsPanel({
  customerId,
  attachments,
  editable
}: {
  customerId: string;
  attachments: CustomerAttachment[];
  editable: boolean;
}) {
  const ossReady = isOssConfigured();
  return (
    <section className="panel stack">
      <div>
        <h2>附件</h2>
        <p className="muted">支持上传文件到私有阿里云 OSS，也可以继续添加附件链接。数据库只保存附件元数据，不保存文件二进制。</p>
      </div>
      {attachments.length === 0 ? <p className="muted">暂无附件</p> : null}
      {attachments.map((attachment) => (
        <div className="subpanel stack" key={attachment.id}>
          {editable ? (
            <form className="form-grid" action={updateCustomerAttachmentAction.bind(null, customerId, attachment.id)}>
              <label>附件名称<input name="attachmentName" defaultValue={attachment.attachmentName} required /></label>
              <label>附件类型<AttachmentTypeSelect defaultValue={attachment.attachmentType} /></label>
              {attachment.storageProvider === "aliyun_oss" ? (
                <div className="readonly">
                  阿里云 OSS 文件<br />
                  文件大小：{formatFileSize(attachment.fileSize)}<br />
                  MIME：{attachment.mimeType || "-"}
                </div>
              ) : (
                <label>附件链接<input name="fileUrl" type="url" defaultValue={attachment.fileUrl || ""} required /></label>
              )}
              <label style={{ gridColumn: "1 / -1" }}>附件说明<textarea name="description" defaultValue={attachment.description || ""} /></label>
              <div className="actions">
                <button type="submit">保存附件</button>
                <CustomerAttachmentDownloadButton customerId={customerId} attachmentId={attachment.id} />
              </div>
            </form>
          ) : (
            <div className="detail-grid">
              <div className="kv"><b>附件名称</b><span>{attachment.attachmentName}</span></div>
              <div className="kv"><b>附件类型</b><span>{attachment.attachmentType || "其他"}</span></div>
              <div className="kv"><b>存储方式</b><span>{attachment.storageProvider === "aliyun_oss" ? "阿里云 OSS" : "附件链接"}</span></div>
              <div className="kv"><b>文件大小</b><span>{formatFileSize(attachment.fileSize)}</span></div>
              <div className="kv"><b>上传人</b><span>{attachment.uploadedByName || "-"}</span></div>
              <div className="kv"><b>创建时间</b><span>{formatDate(attachment.createdAt)}</span></div>
              <div className="kv" style={{ gridColumn: "1 / -1" }}>
                <b>下载 / 预览</b>
                <CustomerAttachmentDownloadButton customerId={customerId} attachmentId={attachment.id} />
              </div>
              <div className="kv" style={{ gridColumn: "1 / -1" }}><b>附件说明</b><span>{attachment.description || "-"}</span></div>
            </div>
          )}
          {editable ? (
            <form action={deleteCustomerAttachmentAction.bind(null, customerId, attachment.id)}>
              <button className="ghost" type="submit">删除附件</button>
            </form>
          ) : null}
        </div>
      ))}
      {editable ? (
        <>
          <CustomerOssUpload customerId={customerId} attachmentTypes={CUSTOMER_ATTACHMENT_TYPES} ossConfigured={ossReady} />
          <div className="subpanel stack">
            <h3>添加附件链接</h3>
            <form className="form-grid" action={createCustomerAttachmentAction.bind(null, customerId)}>
              <label>附件名称<input name="attachmentName" required /></label>
              <label>附件类型<AttachmentTypeSelect /></label>
              <label>附件链接<input name="fileUrl" type="url" placeholder="https://..." required /></label>
              <label style={{ gridColumn: "1 / -1" }}>附件说明<textarea name="description" /></label>
              <div><button type="submit">添加附件</button></div>
            </form>
          </div>
        </>
      ) : null}
    </section>
  );
}
