import type { Customer, CustomerContact, CustomerFieldConfig as DbFieldConfig, User } from "@prisma/client";
import type { ReactNode } from "react";
import { CustomerFormWizard } from "@/components/customer-form-wizard";
import { CustomerGeoSelector } from "@/components/customer-geo-selector";
import { CustomerContactEditor } from "@/components/customer-contact-editor";
import { createExportCustomerAction, updateExportCustomerAction, canAssignOwnerServer, canManageDuplicateReviewServer } from "@/lib/honoa/server/customers";
import { mapFieldConfig } from "@/lib/honoa/server/field-config";
import type { AuthUser } from "@/lib/honoa/server/auth";
import {
  CUSTOMER_FIELD_GROUPS,
  CUSTOMER_GEO_FIELD_KEYS,
  CUSTOMER_LEGACY_CONTACT_FIELD_KEYS,
  CUSTOMER_READONLY_FORM_FIELDS,
  CUSTOMER_SYSTEM_FIELD_KEYS
} from "@/lib/honoa/shared/constants";
import type { CustomerFieldConfig } from "@/lib/honoa/shared/domain-types";
import { booleanFieldValueLabel } from "@/lib/honoa/shared/field-types";
import { fieldValueCompatibilityMessage } from "@/lib/honoa/shared/field-values";

export function ServerCustomerForm({
  actor,
  customer,
  fields,
  owners
}: {
  actor: AuthUser;
  customer?: Customer & { contacts?: CustomerContact[] };
  fields: DbFieldConfig[];
  owners: User[];
}) {
  const activeFields = fields
    .map(mapFieldConfig)
    .filter((field) => field.isActive && !CUSTOMER_READONLY_FORM_FIELDS.has(field.fieldKey) && !CUSTOMER_LEGACY_CONTACT_FIELD_KEYS.has(field.fieldKey) && !CUSTOMER_GEO_FIELD_KEYS.has(field.fieldKey));
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
    <form className="stack" action={action}>
      <div>
        <div className="breadcrumbs">KingaOS / 出口部 / 客户档案 / {customer ? "编辑客户" : "新建客户"}</div>
        <h1>{customer ? `编辑客户：${customer.name}` : "新建客户"}</h1>
        {customer ? <p><span className="tag">客户编号：{customer.customerCode}</span></p> : null}
      </div>
      <CustomerFormWizard isEdit={Boolean(customer)}>
        <CustomerStep group="基础信息" fields={activeFields} customer={customer} actor={actor} owners={owners} canChooseOwner={canChooseOwner}>
          <label>
            客户编号
            <div className="readonly">{customer?.customerCode || "保存后系统自动生成"}</div>
          </label>
          <CustomerGeoSelector initialValue={customer} />
        </CustomerStep>
        <section className="stack">
          <CustomerContactEditor contacts={contacts} />
          <CustomerStep group="联系人信息" fields={activeFields} customer={customer} actor={actor} owners={owners} canChooseOwner={canChooseOwner} hideEmpty />
        </section>
        <CustomerStep group="公司信息" fields={activeFields} customer={customer} actor={actor} owners={owners} canChooseOwner={canChooseOwner} />
        <CustomerStep group="合作信息" fields={activeFields} customer={customer} actor={actor} owners={owners} canChooseOwner={canChooseOwner} />
        <CustomerStep group="备注 / 特殊提醒" fields={activeFields} customer={customer} actor={actor} owners={owners} canChooseOwner={canChooseOwner} title="附件与备注" />
        <section className="panel stack">
          <h2>确认并保存</h2>
          <p className="muted">请确认客户名称、客户类型、国家 / 州省 / 城市、主要联系人、公司名称、主要产品需求、附件数量和备注信息。确认无误后点击“保存客户”。</p>
          <label>
            重复客户审核申请原因
            <textarea name="duplicateReviewReason" placeholder="如果系统检测到客户名称已存在，请填写为什么仍需建档或改名。业务员提交后由业务经理审核；经理 / 管理员直接确认例外时也必须填写。" />
          </label>
          {canApproveDuplicate ? (
            <label className="checkrow">
              <input name="duplicateApprovalConfirmed" type="checkbox" value="1" />
              <span>如果系统检测到重名客户，我确认按“重复客户例外”建档，并记录审核人、审核时间和审核原因。</span>
            </label>
          ) : null}
          {customer ? <p className="muted">附件可在保存客户后，通过编辑页下方的附件区域继续上传或删除。</p> : <p className="muted">新建客户保存后，可在客户编辑页上传附件文件。</p>}
        </section>
      </CustomerFormWizard>
      <a className="button ghost" href={customer ? `/export/customers/${customer.id}` : "/export/customers"}>返回</a>
    </form>
  );
}

function CustomerStep({
  group,
  fields,
  customer,
  actor,
  owners,
  canChooseOwner,
  children,
  hideEmpty,
  title
}: {
  group: CustomerFieldConfig["fieldGroup"];
  fields: CustomerFieldConfig[];
  customer?: Customer;
  actor: AuthUser;
  owners: User[];
  canChooseOwner: boolean;
  children?: ReactNode;
  hideEmpty?: boolean;
  title?: string;
}) {
  const groupFields = fields.filter((field) => field.fieldGroup === group);
  if (hideEmpty && groupFields.length === 0 && !children) return null;
  return (
    <section className="panel stack">
      <h2>{title || group}</h2>
      <div className="form-grid">
        {groupFields.map((field) => (
          <CustomerInput
            key={field.id}
            field={field}
            customer={customer}
            actor={actor}
            owners={owners}
            canChooseOwner={canChooseOwner}
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
  canChooseOwner
}: {
  field: CustomerFieldConfig;
  customer?: Customer;
  actor: AuthUser;
  owners: User[];
  canChooseOwner: boolean;
}) {
  const value = fieldValue(customer, field);
  const label = `${field.fieldLabel}${field.required ? " *" : ""}`;
  const compatibilityMessage = fieldValueCompatibilityMessage(value, field.fieldType, field.options);
  if (field.fieldKey === "ownerUserId") {
    const selectedOwner = customer?.ownerUserId || actor.id;
    if (!canChooseOwner) {
      return (
        <label>
          {label}
          <div className="readonly">{actor.name}</div>
          <input type="hidden" name="ownerUserId" value={actor.id} />
        </label>
      );
    }
    return (
      <label>
        {label}
        <select name="ownerUserId" defaultValue={selectedOwner} required={field.required}>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>{owner.name} ({owner.email})</option>
          ))}
        </select>
      </label>
    );
  }
  if (field.fieldType === "textarea") {
    return (
      <label>
        {label}
        <textarea name={field.fieldKey} defaultValue={String(value || "")} required={field.required} />
        {compatibilityMessage ? <span className="tiny warn-text">{compatibilityMessage}</span> : null}
      </label>
    );
  }
  if (field.fieldType === "select") {
    const stringValue = String(value || "");
    const hasLegacyOption = Boolean(stringValue && !field.options.includes(stringValue));
    return (
      <label>
        {label}
        <select name={field.fieldKey} defaultValue={stringValue} required={field.required}>
          <option value="">请选择</option>
          {hasLegacyOption ? <option value={stringValue}>历史值：{stringValue}</option> : null}
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        {compatibilityMessage ? <span className="tiny warn-text">{compatibilityMessage}</span> : null}
      </label>
    );
  }
  if (field.fieldType === "boolean") {
    if (compatibilityMessage) {
      return (
        <label>
          {label}
          <input name={field.fieldKey} defaultValue={String(value || "")} />
          <span className="tiny warn-text">{compatibilityMessage}</span>
        </label>
      );
    }
    return (
      <label>
        {label}
        <select name={field.fieldKey} defaultValue={booleanSelectValue(value)}>
          <option value="">未填写</option>
          <option value="1">{booleanFieldValueLabel(true)}</option>
          <option value="0">{booleanFieldValueLabel(false)}</option>
        </select>
      </label>
    );
  }
  const inputType = field.fieldType === "number" && !compatibilityMessage ? "number" : field.fieldType === "date" && !compatibilityMessage ? "date" : "text";
  return (
    <label>
      {label}
      <input
        name={field.fieldKey}
        type={inputType}
        defaultValue={String(value || "")}
        required={field.required}
      />
      {compatibilityMessage ? <span className="tiny warn-text">{compatibilityMessage}</span> : null}
    </label>
  );
}

function booleanSelectValue(value: unknown) {
  const normalized = String(value).trim().toLowerCase();
  if (value === true || ["1", "true", "yes", "是"].includes(normalized)) return "1";
  if (value === false || ["0", "false", "no", "否"].includes(normalized)) return "0";
  return "";
}

function fieldValue(customer: Customer | undefined, field: CustomerFieldConfig): string | number | boolean {
  if (!customer) return "";
  if (CUSTOMER_SYSTEM_FIELD_KEYS.has(field.fieldKey)) {
    return (customer as unknown as Record<string, string | number | boolean>)[field.fieldKey] ?? "";
  }
  const customFields = customer.customFields as Record<string, string | number | boolean>;
  return customFields[field.fieldKey] ?? "";
}
