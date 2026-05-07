import type { CustomerAttachment } from "@prisma/client";
import { CustomerAttachmentDownloadButton, CustomerOssUpload } from "@/components/customer-oss-upload";
import {
  deleteCustomerAttachmentAction,
  updateCustomerAttachmentAction
} from "@/lib/honoa/server/customers";

function formatDate(value: Date) {
  return value.toLocaleString("zh-CN", { hour12: false });
}

function formatFileSize(value?: number | null) {
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function attachmentTypeOptions(types: string[], defaultValue?: string | null) {
  const options = [...types];
  const value = defaultValue?.trim();
  if (value && !options.includes(value)) options.push(value);
  return options;
}

function AttachmentTypeSelect({ types, defaultValue, namePrefix = "" }: { types: string[]; defaultValue?: string | null; namePrefix?: string }) {
  return (
    <select name={`${namePrefix}attachmentType`} defaultValue={defaultValue || "其他"}>
      {attachmentTypeOptions(types, defaultValue).map((type) => <option key={type} value={type}>{type}</option>)}
    </select>
  );
}

export function CustomerAttachmentsPanel({
  customerId,
  attachments,
  editable,
  attachmentTypes = [],
  ossConfigured = false
}: {
  customerId: string;
  attachments: CustomerAttachment[];
  editable: boolean;
  attachmentTypes?: string[];
  ossConfigured?: boolean;
}) {
  const generalAttachments = attachments.filter((attachment) => !attachment.fieldKey && !attachment.deletedAt);
  return (
    <section className="subpanel stack general-attachments-panel" data-testid="general-attachments-panel">
      <div>
        <h2>通用客户附件</h2>
        <p className="muted">支持上传文件到私有阿里云 OSS。数据库只保存附件元数据，不保存文件二进制。</p>
      </div>
      {generalAttachments.length === 0 ? <p className="muted">暂无通用客户附件</p> : null}
      {generalAttachments.map((attachment) => (
        <div className="subpanel stack" key={attachment.id}>
          {editable ? (
            <div className="form-grid">
              <label>附件名称<input name={`${attachment.id}__attachmentName`} defaultValue={attachment.attachmentName} required /></label>
              <label>附件类型<AttachmentTypeSelect namePrefix={`${attachment.id}__`} types={attachmentTypes} defaultValue={attachment.attachmentType} /></label>
              {attachment.storageProvider === "aliyun_oss" ? (
                <div className="readonly">
                  阿里云 OSS 文件<br />
                  文件大小：{formatFileSize(attachment.fileSize)}<br />
                  MIME：{attachment.mimeType || "-"}
                </div>
              ) : (
                <label>附件链接<input name={`${attachment.id}__fileUrl`} type="url" defaultValue={attachment.fileUrl || ""} required /></label>
              )}
              <label style={{ gridColumn: "1 / -1" }}>附件说明<textarea name={`${attachment.id}__description`} defaultValue={attachment.description || ""} /></label>
              <div className="actions">
                <button type="submit" formAction={updateCustomerAttachmentAction.bind(null, customerId, attachment.id)}>保存附件</button>
                <CustomerAttachmentDownloadButton customerId={customerId} attachmentId={attachment.id} />
              </div>
            </div>
          ) : (
            <div className="detail-grid">
              <div className="kv"><b>附件名称</b><span>{attachment.attachmentName}</span></div>
              <div className="kv"><b>附件类型</b><span>{attachment.attachmentType || "其他"}</span></div>
              {attachment.fieldLabel ? <div className="kv"><b>归属字段</b><span>{attachment.fieldLabel}</span></div> : null}
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
            <button className="ghost" type="submit" formAction={deleteCustomerAttachmentAction.bind(null, customerId, attachment.id)}>删除附件</button>
          ) : null}
        </div>
      ))}
      {editable ? (
        <CustomerOssUpload customerId={customerId} attachmentTypes={attachmentTypes} ossConfigured={ossConfigured} />
      ) : null}
    </section>
  );
}
