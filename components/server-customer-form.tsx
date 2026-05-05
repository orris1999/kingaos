import type { Customer, CustomerFieldConfig as DbFieldConfig, User } from "@prisma/client";
import { createExportCustomerAction, updateExportCustomerAction, canAssignOwnerServer } from "@/lib/honoa/server/customers";
import { mapFieldConfig } from "@/lib/honoa/server/field-config";
import type { AuthUser } from "@/lib/honoa/server/auth";
import {
  CUSTOMER_FIELD_GROUPS,
  CUSTOMER_READONLY_FORM_FIELDS,
  CUSTOMER_SYSTEM_FIELD_KEYS
} from "@/lib/honoa/shared/constants";
import type { CustomerFieldConfig } from "@/lib/honoa/shared/domain-types";

export function ServerCustomerForm({
  actor,
  customer,
  fields,
  owners
}: {
  actor: AuthUser;
  customer?: Customer;
  fields: DbFieldConfig[];
  owners: User[];
}) {
  const activeFields = fields.map(mapFieldConfig).filter((field) => field.isActive && !CUSTOMER_READONLY_FORM_FIELDS.has(field.fieldKey));
  const action = customer ? updateExportCustomerAction.bind(null, customer.id) : createExportCustomerAction;
  const canChooseOwner = canAssignOwnerServer(actor);
  return (
    <form className="stack" action={action}>
      <div>
        <div className="breadcrumbs">KingaOS / 出口部 / 客户档案 / {customer ? "编辑客户" : "新建客户"}</div>
        <h1>{customer ? `编辑客户：${customer.name}` : "新建客户"}</h1>
        {customer ? <p><span className="tag">客户编号：{customer.customerCode}</span></p> : null}
      </div>
      {CUSTOMER_FIELD_GROUPS.map((group) => {
        const groupFields = activeFields.filter((field) => field.fieldGroup === group);
        if (groupFields.length === 0) return null;
        return (
          <section className="panel stack" key={group}>
            <h2>{group}</h2>
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
            </div>
          </section>
        );
      })}
      <div className="actions">
        <button type="submit">{customer ? "保存修改" : "保存客户"}</button>
        <a className="button ghost" href={customer ? `/export/customers/${customer.id}` : "/export/customers"}>返回</a>
      </div>
    </form>
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
    return <label>{label}<textarea name={field.fieldKey} defaultValue={String(value || "")} required={field.required} /></label>;
  }
  if (field.fieldType === "select") {
    return (
      <label>
        {label}
        <select name={field.fieldKey} defaultValue={String(value || "")} required={field.required}>
          <option value="">请选择</option>
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }
  if (field.fieldType === "boolean") {
    return <label className="checkrow"><input name={field.fieldKey} type="checkbox" value="1" defaultChecked={value === true || value === "1"} /><span>{label}</span></label>;
  }
  return (
    <label>
      {label}
      <input
        name={field.fieldKey}
        type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"}
        defaultValue={String(value || "")}
        required={field.required}
      />
    </label>
  );
}

function fieldValue(customer: Customer | undefined, field: CustomerFieldConfig): string | number | boolean {
  if (!customer) return "";
  if (CUSTOMER_SYSTEM_FIELD_KEYS.has(field.fieldKey)) {
    return (customer as unknown as Record<string, string | number | boolean>)[field.fieldKey] ?? "";
  }
  const customFields = customer.customFields as Record<string, string | number | boolean>;
  return customFields[field.fieldKey] ?? "";
}
