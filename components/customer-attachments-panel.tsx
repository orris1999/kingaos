import type { CustomerAttachment } from "@prisma/client";
import {
  createCustomerAttachmentAction,
  deleteCustomerAttachmentAction,
  updateCustomerAttachmentAction
} from "@/lib/honoa/server/customers";
import { CUSTOMER_ATTACHMENT_TYPES } from "@/lib/honoa/shared/constants";

function formatDate(value: Date) {
  return value.toLocaleString("zh-CN", { hour12: false });
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
  return (
    <section className="panel stack">
      <div>
        <h2>附件</h2>
        <p className="muted">文件上传暂未配置对象存储。请先使用附件链接，后续接入 OSS 后开放上传。</p>
      </div>
      {attachments.length === 0 ? <p className="muted">暂无附件</p> : null}
      {attachments.map((attachment) => (
        <div className="subpanel stack" key={attachment.id}>
          {editable ? (
            <form className="form-grid" action={updateCustomerAttachmentAction.bind(null, customerId, attachment.id)}>
              <label>附件名称<input name="attachmentName" defaultValue={attachment.attachmentName} required /></label>
              <label>附件类型<AttachmentTypeSelect defaultValue={attachment.attachmentType} /></label>
              <label>附件链接<input name="fileUrl" type="url" defaultValue={attachment.fileUrl || ""} required /></label>
              <label style={{ gridColumn: "1 / -1" }}>附件说明<textarea name="description" defaultValue={attachment.description || ""} /></label>
              <div className="actions">
                <button type="submit">保存附件</button>
              </div>
            </form>
          ) : (
            <div className="detail-grid">
              <div className="kv"><b>附件名称</b><span>{attachment.attachmentName}</span></div>
              <div className="kv"><b>附件类型</b><span>{attachment.attachmentType || "其他"}</span></div>
              <div className="kv"><b>上传人</b><span>{attachment.uploadedByName || "-"}</span></div>
              <div className="kv"><b>创建时间</b><span>{formatDate(attachment.createdAt)}</span></div>
              <div className="kv" style={{ gridColumn: "1 / -1" }}>
                <b>附件链接</b>
                {attachment.fileUrl ? <a href={attachment.fileUrl} target="_blank" rel="noreferrer">{attachment.fileUrl}</a> : <span>-</span>}
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
      ) : null}
    </section>
  );
}
