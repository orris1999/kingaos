import type { Customer, CustomerAttachment } from "@prisma/client";
import type { ReactNode } from "react";
import { CustomerAttachmentDownloadButton, CustomerOssUpload } from "@/components/customer-oss-upload";
import {
  createCustomerFieldAttachmentAction,
  deleteCustomerAttachmentAction
} from "@/lib/honoa/server/customers";
import type { CustomerFieldConfig } from "@/lib/honoa/shared/domain-types";
import { normalizeMultiValue } from "@/lib/honoa/shared/field-values";

function preferredAttachmentType(types: string[], fieldLabel: string) {
  if (types.includes(fieldLabel)) return fieldLabel;
  if (types.includes("客户资料")) return "客户资料";
  if (types.includes("其他")) return "其他";
  return types[0] || "其他";
}

function fieldAttachmentOptions(types: string[], selected: string) {
  const options = [...types];
  if (!options.includes(selected)) options.push(selected);
  return options;
}

function fieldAttachmentIds(customer: Customer | undefined, fieldKey: string) {
  if (!customer) return [];
  const customFields = customer.customFields as Record<string, unknown>;
  return normalizeMultiValue(customFields[fieldKey]);
}

function attachmentsForField(customer: (Customer & { attachments?: CustomerAttachment[] }) | undefined, fieldKey: string) {
  const attachmentIds = fieldAttachmentIds(customer, fieldKey);
  return (customer?.attachments || []).filter((attachment) =>
    !attachment.deletedAt &&
    (attachment.fieldKey === fieldKey || attachmentIds.includes(attachment.id))
  );
}

export function CustomerAttachmentField({
  field,
  customer,
  label,
  attachmentTypes,
  ossConfigured
}: {
  field: CustomerFieldConfig;
  customer?: Customer & { attachments?: CustomerAttachment[] };
  label: ReactNode;
  attachmentTypes: string[];
  ossConfigured: boolean;
}) {
  if (!customer) {
    return (
      <div className="attachment-field-compact" data-testid="attachment-field-compact">
        {label}
        <div className="notice">
          <strong>附件请在客户保存后上传。</strong>
          <p>保存客户后，可在客户详情 / 编辑页面上传联系人名片、照片或其他附件。</p>
        </div>
      </div>
    );
  }

  const attachments = attachmentsForField(customer, field.fieldKey);
  const defaultType = preferredAttachmentType(attachmentTypes, field.fieldLabel);
  const typeOptions = fieldAttachmentOptions(attachmentTypes, defaultType);
  const prefix = `${field.fieldKey}__`;

  return (
    <div className="attachment-field-compact" data-testid="attachment-field-compact">
      <div className="attachment-field-header">
        <div>
          {label}
          <p className="tiny muted">
            {attachments.length === 0 ? "暂无附件" : `已上传 ${attachments.length} 个附件`}
          </p>
        </div>
        <div className="actions attachment-field-actions">
          <details className="attachment-field-action">
            <summary>上传文件</summary>
            <CustomerOssUpload
              customerId={customer.id}
              attachmentTypes={typeOptions}
              defaultAttachmentType={defaultType}
              ossConfigured={ossConfigured}
              fieldKey={field.fieldKey}
              fieldLabel={field.fieldLabel}
            />
          </details>
          <details className="attachment-field-action">
            <summary>添加链接</summary>
            <div className="subpanel stack">
              <h3>添加{field.fieldLabel}链接</h3>
              <div className="form-grid compact-grid">
                <label>附件名称<input name={`${prefix}attachmentName`} /></label>
                <label>
                  附件类型
                  <select name={`${prefix}attachmentType`} defaultValue={defaultType}>
                    {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label>附件链接<input name={`${prefix}fileUrl`} type="url" placeholder="https://..." /></label>
                <label style={{ gridColumn: "1 / -1" }}>附件说明<textarea name={`${prefix}description`} /></label>
                <div>
                  <button type="submit" formAction={createCustomerFieldAttachmentAction.bind(null, customer.id, field.fieldKey, field.fieldLabel)}>添加链接</button>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>

      {attachments.length === 0 ? <p className="muted">暂无附件</p> : (
        <div className="attachment-field-list">
          {attachments.map((attachment) => (
            <div className="attachment-field-item" key={attachment.id}>
              <input type="hidden" name={`${field.fieldKey}__attachmentId`} value={attachment.id} />
              <div>
                <strong>{attachment.attachmentName}</strong>
                <span className="tiny muted">{attachment.attachmentType || defaultType}</span>
              </div>
              <div className="actions">
                <CustomerAttachmentDownloadButton customerId={customer.id} attachmentId={attachment.id} />
                <button className="ghost" type="submit" formAction={deleteCustomerAttachmentAction.bind(null, customer.id, attachment.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="tiny muted">该字段附件复用客户附件与 OSS；数据库只保存附件元数据和附件引用。</p>
    </div>
  );
}

export function CustomerAttachmentFieldValue({
  customer,
  field
}: {
  customer: Customer & { attachments?: CustomerAttachment[] };
  field: CustomerFieldConfig;
}) {
  const attachments = attachmentsForField(customer, field.fieldKey);
  if (attachments.length === 0) return <span className="muted">暂无附件</span>;
  return (
    <div className="attachment-field-list readonly">
      {attachments.map((attachment) => (
        <div className="attachment-field-item" key={attachment.id}>
          <div>
            <strong>{attachment.attachmentName}</strong>
            <span className="tiny muted">{attachment.attachmentType || field.fieldLabel || "其他"}</span>
          </div>
          <CustomerAttachmentDownloadButton customerId={customer.id} attachmentId={attachment.id} />
        </div>
      ))}
    </div>
  );
}
