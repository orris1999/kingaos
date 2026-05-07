import type { CompanyReceiptAccount, Customer, CustomerAttachment, CustomerContact, CustomerFieldConfig as DbFieldConfig, User } from "@prisma/client";
import type { ReactNode } from "react";
import { CustomerFormWizard } from "@/components/customer-form-wizard";
import { CustomerGeoSelector } from "@/components/customer-geo-selector";
import { CustomerContactEditor } from "@/components/customer-contact-editor";
import { CustomerMultiselectField } from "@/components/customer-multiselect-field";
import { CustomerAttachmentField } from "@/components/customer-attachment-field";
import { CustomerAttachmentsPanel } from "@/components/customer-attachments-panel";
import { CustomerReceiptAccountSelector, type ReceiptAccountOption } from "@/components/customer-receipt-account-selector";
import { createExportCustomerAction, updateExportCustomerAction, canAssignOwnerServer, canManageDuplicateReviewServer } from "@/lib/honoa/server/customers";
import { mapFieldConfig } from "@/lib/honoa/server/field-config";
import { hasServerPermission, type AuthUser } from "@/lib/honoa/server/auth";
import {
  CUSTOMER_FIELD_GROUPS,
  CUSTOMER_COMPANY_DUPLICATE_FIELD_KEYS,
  CUSTOMER_GEO_FIELD_KEYS,
  CUSTOMER_LEGACY_CONTACT_FIELD_KEYS,
  CUSTOMER_READONLY_FORM_FIELDS,
  CUSTOMER_SYSTEM_FIELD_KEYS,
  CUSTOMER_TYPES,
  customerCompanyDisplay,
  customerStatusCompatibilityOptions,
  customerStatusLabel
} from "@/lib/honoa/shared/constants";
import type { CustomerFieldConfig } from "@/lib/honoa/shared/domain-types";
import { booleanFieldValueLabel } from "@/lib/honoa/shared/field-types";
import { activeFieldOptions, fieldOptionLabel, normalizeFieldOptions } from "@/lib/honoa/shared/field-options";
import { fieldValueCompatibilityMessage, isSafeUrl, normalizeMultiValue, normalizeUrlFieldValue } from "@/lib/honoa/shared/field-values";

export function ServerCustomerForm({
  actor,
  customer,
  fields,
  owners,
  receiptAccounts,
  attachmentTypes = [],
  ossConfigured = false
}: {
  actor: AuthUser;
  customer?: Customer & { contacts?: CustomerContact[]; attachments?: CustomerAttachment[]; defaultReceiptAccount?: CompanyReceiptAccount | null };
  fields: DbFieldConfig[];
  owners: User[];
  receiptAccounts: CompanyReceiptAccount[];
  attachmentTypes?: string[];
  ossConfigured?: boolean;
}) {
  const activeFields = fields
    .map(mapFieldConfig)
    .filter((field) =>
      field.isActive &&
      !CUSTOMER_READONLY_FORM_FIELDS.has(field.fieldKey) &&
      !CUSTOMER_LEGACY_CONTACT_FIELD_KEYS.has(field.fieldKey) &&
      !CUSTOMER_GEO_FIELD_KEYS.has(field.fieldKey) &&
      !CUSTOMER_COMPANY_DUPLICATE_FIELD_KEYS.has(field.fieldKey)
    );
  const action = customer ? updateExportCustomerAction.bind(null, customer.id) : createExportCustomerAction;
  const canChooseOwner = canAssignOwnerServer(actor);
  const canApproveDuplicate = canManageDuplicateReviewServer(actor);
  const contacts = customer?.contacts?.length
    ? customer.contacts
    : customer && [customer.contactName, customer.contactTitle, customer.phone, customer.email, customer.wechatOrWhatsapp].some(Boolean)
      ? [{
          id: "",
          name: customer.contactName,
          title: customer.contactTitle,
          phone: customer.phone,
          email: customer.email,
          wechatOrWhatsapp: customer.wechatOrWhatsapp,
          isPrimary: true,
          notes: "",
          sortOrder: 0
        }]
      : [];
  return (
    <form className="stack customer-form-shell" action={action}>
      <div>
        <div className="breadcrumbs">KingaOS / 出口部 / 客户档案 / {customer ? "编辑客户" : "新建客户"}</div>
        <h1>{customer ? `编辑客户：${customerCompanyDisplay(customer)}` : "新建客户"}</h1>
        {customer ? (
          <p className="actions">
            <span className="tag">客户编号：{customer.customerCode}</span>
            <a href={`/export/customers/${customer.id}?tab=history`}>查看修改历史</a>
          </p>
        ) : null}
      </div>
      <CustomerFormWizard isEdit={Boolean(customer)}>
        <CustomerStep group="基础信息" fields={activeFields} customer={customer} actor={actor} owners={owners} canChooseOwner={canChooseOwner} attachmentTypes={attachmentTypes} ossConfigured={ossConfigured}>
          <label>
            客户编号
            <div className="readonly" data-testid="readonly-field"><span>{customer?.customerCode || "保存后系统自动生成"}</span><span className="readonly-badge">系统生成</span></div>
          </label>
          <CustomerGeoSelector initialValue={customer} />
        </CustomerStep>
        <section className="stack">
          <CustomerContactEditor contacts={contacts} />
          <CustomerStep group="联系人信息" fields={activeFields} customer={customer} actor={actor} owners={owners} canChooseOwner={canChooseOwner} attachmentTypes={attachmentTypes} ossConfigured={ossConfigured} hideEmpty />
        </section>
        <CustomerStep group="公司信息" fields={activeFields} customer={customer} actor={actor} owners={owners} canChooseOwner={canChooseOwner} attachmentTypes={attachmentTypes} ossConfigured={ossConfigured} />
        <CustomerStep group="合作信息" fields={activeFields} customer={customer} actor={actor} owners={owners} canChooseOwner={canChooseOwner} attachmentTypes={attachmentTypes} ossConfigured={ossConfigured}>
          <CustomerReceiptAccountSelector
            accounts={receiptAccounts.map(toReceiptAccountOption)}
            selectedAccountId={customer?.defaultReceiptAccountId}
            selectedNote={customer?.defaultReceiptAccountNote}
            canSelect={hasServerPermission(actor, "export.customers.receipt_account.select")}
          />
        </CustomerStep>
        <CustomerStep group="备注 / 特殊提醒" fields={activeFields} customer={customer} actor={actor} owners={owners} canChooseOwner={canChooseOwner} attachmentTypes={attachmentTypes} ossConfigured={ossConfigured} title="附件与备注">
          {customer ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <CustomerAttachmentsPanel
                customerId={customer.id}
                attachments={customer.attachments || []}
                editable
                attachmentTypes={attachmentTypes}
                ossConfigured={ossConfigured}
              />
            </div>
          ) : (
            <div className="notice" style={{ gridColumn: "1 / -1" }}>
              <strong>通用客户附件请在客户保存后上传。</strong>
              <p>保存客户后，可在客户详情 / 编辑页面添加名片、营业执照、聊天记录、报价资料等附件。</p>
            </div>
          )}
        </CustomerStep>
        <section className="panel stack">
          <h2>确认并保存</h2>
          <p className="muted">请确认公司名称、客户类型、国家 / 州省 / 城市、主要联系人、主要产品需求、附件数量和备注信息。确认无误后点击“保存客户”。</p>
          <label>
            重复客户审核申请原因
            <textarea name="duplicateReviewReason" placeholder="如果系统检测到公司名称已存在，请填写为什么仍需建档或改名。业务员提交后由业务经理审核；经理 / 管理员直接确认例外时也必须填写。" />
          </label>
          {canApproveDuplicate ? (
            <label className="checkrow">
              <input name="duplicateApprovalConfirmed" type="checkbox" value="1" />
              <span>如果系统检测到重名客户，我确认按“重复客户例外”建档，并记录审核人、审核时间和审核原因。</span>
            </label>
          ) : null}
          {customer ? (
            <p className="muted">附件可在保存客户后，通过编辑页下方的附件区域继续上传或删除。</p>
          ) : (
            <div className="notice">
              <strong>附件请在客户保存后上传。</strong>
              <p>保存客户后，可在客户详情 / 编辑页面添加名片、营业执照、聊天记录、报价资料等附件。</p>
            </div>
          )}
        </section>
      </CustomerFormWizard>
      <a className="button ghost" href={customer ? `/export/customers/${customer.id}` : "/export/customers"}>返回</a>
    </form>
  );
}

function toReceiptAccountOption(account: CompanyReceiptAccount): ReceiptAccountOption {
  return {
    id: account.id,
    accountCode: account.accountCode,
    displayName: account.displayName,
    scenarioName: account.scenarioName,
    paymentMethod: account.paymentMethod,
    currency: account.currency,
    companyName: account.companyName,
    accountNo: account.accountNo,
    bankName: account.bankName,
    swiftCode: account.swiftCode,
    bankAddress: account.bankAddress,
    usageNotes: account.usageNotes,
    riskNotes: account.riskNotes,
    isActive: account.isActive,
    disabledAt: account.disabledAt?.toISOString() || null,
    disabledReason: account.disabledReason,
    updatedAt: account.updatedAt.toISOString()
  };
}

function CustomerStep({
  group,
  fields,
  customer,
  actor,
  owners,
  canChooseOwner,
  attachmentTypes,
  ossConfigured,
  children,
  hideEmpty,
  title
}: {
  group: CustomerFieldConfig["fieldGroup"];
  fields: CustomerFieldConfig[];
  customer?: Customer & { attachments?: CustomerAttachment[] };
  actor: AuthUser;
  owners: User[];
  canChooseOwner: boolean;
  attachmentTypes: string[];
  ossConfigured: boolean;
  children?: ReactNode;
  hideEmpty?: boolean;
  title?: string;
}) {
  const groupFields = fields.filter((field) => field.fieldGroup === group);
  if (hideEmpty && groupFields.length === 0 && !children) return null;
  return (
    <section className="panel stack customer-step-panel">
      <h2>{title || group}</h2>
      <div className="form-grid customer-step-grid">
        {groupFields.map((field) => (
          <CustomerInput
            key={field.id}
            field={field}
            customer={customer}
            actor={actor}
            owners={owners}
            canChooseOwner={canChooseOwner}
            attachmentTypes={attachmentTypes}
            ossConfigured={ossConfigured}
          />
        ))}
        {children}
      </div>
    </section>
  );
}

function CustomerInput({
  field,
  customer,
  actor,
  owners,
  canChooseOwner,
  attachmentTypes,
  ossConfigured
}: {
  field: CustomerFieldConfig;
  customer?: Customer & { attachments?: CustomerAttachment[] };
  actor: AuthUser;
  owners: User[];
  canChooseOwner: boolean;
  attachmentTypes: string[];
  ossConfigured: boolean;
}) {
  const value = fieldValue(customer, field);
  const label = field.fieldLabel;
  const compatibilityOptions = field.fieldKey === "status" ? customerStatusCompatibilityOptions(field.options) : field.options;
  const compatibilityMessage = fieldValueCompatibilityMessage(value, field.fieldType, compatibilityOptions);
  if (field.fieldKey === "customerType") {
    const selected = customerTypeValues(customer);
    const options = activeFieldOptions(field.options).length ? activeFieldOptions(field.options) : CUSTOMER_TYPES.map((type, index) => ({ value: type, label: type, internalNote: "", isActive: true, sortOrder: index }));
    return (
      <div className={fieldLabelClass(field.required)}>
        <FieldLabel label={label} required={field.required} />
        <CustomerMultiselectField
          name="customerTypes"
          options={options.map((option) => ({ value: option.value, label: option.label, internalNote: option.internalNote }))}
          placeholder="请选择客户类型"
          required={field.required}
          selectedValues={selected}
          testId="customer-type-multiselect"
        />
      </div>
    );
  }
  if (field.fieldKey === "ownerUserId") {
    const selectedOwner = customer?.ownerUserId || actor.id;
    if (!canChooseOwner) {
      return (
        <label className={fieldLabelClass(field.required)}>
          <FieldLabel label={label} required={field.required} />
          <div className="readonly" data-testid="readonly-field"><span>{actor.name}</span><span className="readonly-badge">只读</span></div>
          <input type="hidden" name="ownerUserId" value={actor.id} />
        </label>
      );
    }
    return (
      <label className={fieldLabelClass(field.required)}>
        <FieldLabel label={label} required={field.required} />
        <select className={fieldControlClass(field.required)} name="ownerUserId" defaultValue={selectedOwner} required={field.required}>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>{owner.name} ({owner.email})</option>
          ))}
        </select>
      </label>
    );
  }
  if (field.fieldType === "textarea") {
    return (
      <label className={fieldLabelClass(field.required)}>
        <FieldLabel label={label} required={field.required} />
        <textarea className={fieldControlClass(field.required)} name={field.fieldKey} defaultValue={String(value || "")} required={field.required} placeholder={fieldPlaceholder(field)} />
        {compatibilityMessage ? <span className="tiny warn-text">{compatibilityMessage}</span> : null}
      </label>
    );
  }
  if (field.fieldType === "select") {
    const stringValue = String(value || "");
    const selectValue = field.fieldKey === "status" ? customerStatusLabel(stringValue) : stringValue;
    const renderedOptions = selectOptionsForField(field, true);
    const hasLegacyOption = Boolean(selectValue && !renderedOptions.some((option) => option.value === selectValue));
    return (
      <label className={fieldLabelClass(field.required)}>
        <FieldLabel label={label} required={field.required} />
        <select className={fieldControlClass(field.required)} name={field.fieldKey} defaultValue={selectValue} required={field.required}>
          <option value="">请选择</option>
          {hasLegacyOption ? <option value={selectValue}>历史值：{selectValue}</option> : null}
          {renderedOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <OptionInternalNotes options={renderedOptions} />
        {compatibilityMessage ? <span className="tiny warn-text">{compatibilityMessage}</span> : null}
      </label>
    );
  }
  if (field.fieldType === "multiselect") {
    const selected = normalizeMultiValue(value);
    const options = selectOptionsForField(field, true);
    return (
      <div className={fieldLabelClass(field.required)}>
        <FieldLabel label={label} required={field.required} />
        <CustomerMultiselectField
          name={field.fieldKey}
          options={options}
          placeholder={`请选择${field.fieldLabel}`}
          required={field.required}
          selectedValues={selected}
        />
        {compatibilityMessage ? <span className="tiny warn-text">{compatibilityMessage}</span> : null}
      </div>
    );
  }
  if (field.fieldType === "url") {
    const link = normalizeUrlFieldValue(value);
    return (
      <div className={fieldLabelClass(field.required)}>
        <FieldLabel label={label} required={field.required} />
        <div className="form-grid compact-grid">
          <label>链接标题<input className={fieldControlClass(field.required)} name={`${field.fieldKey}__label`} defaultValue={link?.label || ""} placeholder="例如：到访汇总" /></label>
          <label>链接地址<input className={fieldControlClass(field.required)} name={`${field.fieldKey}__url`} defaultValue={link?.url || ""} placeholder="https://... 或 /internal/path" required={field.required} /></label>
        </div>
        {link?.url && !isSafeUrl(link.url) ? <span className="tiny warn-text">链接地址无效或不安全，请重新确认。</span> : null}
      </div>
    );
  }
  if (field.fieldType === "attachment") {
    return (
      <AttachmentFieldInput
        field={field}
        customer={customer}
        attachmentTypes={attachmentTypes}
        ossConfigured={ossConfigured}
      />
    );
  }
  if (field.fieldType === "boolean") {
    if (compatibilityMessage) {
      return (
        <label className={fieldLabelClass(field.required)}>
          <FieldLabel label={label} required={field.required} />
          <input className={fieldControlClass(field.required)} name={field.fieldKey} defaultValue={String(value || "")} placeholder={fieldPlaceholder(field)} />
          <span className="tiny warn-text">{compatibilityMessage}</span>
        </label>
      );
    }
    return (
      <label className={fieldLabelClass(field.required)}>
        <FieldLabel label={label} required={field.required} />
        <select className={fieldControlClass(field.required)} name={field.fieldKey} defaultValue={booleanSelectValue(value)}>
          <option value="">未填写</option>
          <option value="1">{booleanFieldValueLabel(true)}</option>
          <option value="0">{booleanFieldValueLabel(false)}</option>
        </select>
      </label>
    );
  }
  const inputType = field.fieldType === "number" && !compatibilityMessage ? "number" : field.fieldType === "date" && !compatibilityMessage ? "date" : "text";
  return (
    <label className={fieldLabelClass(field.required)}>
      <FieldLabel label={label} required={field.required} />
      <input
        className={fieldControlClass(field.required)}
        name={field.fieldKey}
        type={inputType}
        defaultValue={String(value || "")}
        required={field.required}
        placeholder={fieldPlaceholder(field)}
      />
      {compatibilityMessage ? <span className="tiny warn-text">{compatibilityMessage}</span> : null}
    </label>
  );
}

function FieldLabel({ label, required }: { label: string; required: boolean }) {
  return (
    <span className="field-label-text">
      {label}
      {required ? <span className="required-mark" aria-label="必填">*</span> : null}
      {required ? <span className="required-badge" data-testid="required-field">必填</span> : null}
    </span>
  );
}

function fieldLabelClass(required: boolean) {
  return required ? "required-field" : undefined;
}

function fieldControlClass(required: boolean) {
  return required ? "required-control" : undefined;
}

function fieldPlaceholder(field: CustomerFieldConfig) {
  if (!field.required) return undefined;
  if (field.fieldKey === "name") return "请填写公司名称";
  if (field.fieldKey === "customerType") return "请选择客户类型";
  return `请填写${field.fieldLabel}`;
}

function selectOptionsForField(field: CustomerFieldConfig, activeOnly = false) {
  const source = activeOnly ? activeFieldOptions(field.options) : normalizeFieldOptions(field.options);
  const options = source.map((option) => {
    const value = field.fieldKey === "status" ? customerStatusLabel(option.value) : option.value;
    const label = field.fieldKey === "status" ? customerStatusLabel(option.label) : option.label;
    return { value, label, internalNote: option.internalNote };
  });
  return Array.from(new Map(options.map((option) => [option.value, option])).values());
}

function OptionInternalNotes({ options }: { options: Array<{ value: string; label: string; internalNote?: string }> }) {
  const notes = options.filter((option) => option.internalNote);
  if (notes.length === 0) return null;
  return (
    <span className="tiny muted">
      {notes.map((option) => `${option.label}：${option.internalNote}`).join("；")}
    </span>
  );
}

function booleanSelectValue(value: unknown) {
  const normalized = String(value).trim().toLowerCase();
  if (value === true || ["1", "true", "yes", "是"].includes(normalized)) return "1";
  if (value === false || ["0", "false", "no", "否"].includes(normalized)) return "0";
  return "";
}

function fieldValue(customer: Customer | undefined, field: CustomerFieldConfig): unknown {
  if (!customer) return "";
  if (CUSTOMER_SYSTEM_FIELD_KEYS.has(field.fieldKey)) {
    return (customer as unknown as Record<string, unknown>)[field.fieldKey] ?? "";
  }
  const customFields = customer.customFields as Record<string, unknown>;
  return customFields[field.fieldKey] ?? "";
}

function customerTypeValues(customer?: Customer) {
  const customerTypes = (customer as unknown as { customerTypes?: unknown })?.customerTypes;
  const values = normalizeMultiValue(customerTypes);
  if (values.length) return values;
  return normalizeMultiValue(customer?.customerType || "");
}

function AttachmentFieldInput({
  field,
  customer,
  attachmentTypes,
  ossConfigured
}: {
  field: CustomerFieldConfig;
  customer?: Customer & { attachments?: CustomerAttachment[] };
  attachmentTypes: string[];
  ossConfigured: boolean;
}) {
  return (
    <div className={fieldLabelClass(field.required)} style={{ gridColumn: "1 / -1" }}>
      <CustomerAttachmentField
        field={field}
        customer={customer}
        label={<FieldLabel label={field.fieldLabel} required={field.required} />}
        attachmentTypes={attachmentTypes}
        ossConfigured={ossConfigured}
      />
    </div>
  );
}
