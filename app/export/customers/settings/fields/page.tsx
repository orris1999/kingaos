import { CustomerFieldConfigForm } from "@/components/customer-field-config-form";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import {
  createCustomerFieldConfigAction,
  listCustomerFieldConfigsForActor,
  updateCustomerFieldConfigAction
} from "@/lib/honoa/server/field-config";
import { CUSTOMER_FIELD_GROUPS, CUSTOMER_FIELD_TYPES } from "@/lib/honoa/shared/constants";
import type { CustomerFieldGroup, CustomerFieldType } from "@/lib/honoa/shared/domain-types";
import { fieldTypeLabel } from "@/lib/honoa/shared/field-types";

export default async function FieldSettingsPage() {
  const user = await requireCurrentUser();
  if (!hasServerPermission(user, "export.customers.fields.manage")) {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能配置出口部客户档案字段。" />
      </KingaShell>
    );
  }
  const fields = await listCustomerFieldConfigsForActor(user, true);
  return (
    <KingaShell user={user}>
      <div className="stack">
        <div>
          <div className="breadcrumbs">KingaOS / 出口部 / 客户档案 / 字段配置</div>
          <h1>客户档案字段配置</h1>
          <p className="muted">系统字段不允许删除；新增字段会保存到客户 customFields。业务员只能填写字段值，不能修改字段结构。</p>
        </div>
        <section className="panel stack">
          <h2>添加字段</h2>
          <CustomerFieldConfigForm action={createCustomerFieldConfigAction}>
            <label>字段名称<input name="fieldLabel" required /></label>
            <label>分组<FieldGroupSelect /></label>
            <label>类型<FieldTypeSelect /></label>
            <label>排序<input name="sortOrder" type="number" defaultValue="300" /></label>
            <label className="checkrow"><input name="required" type="checkbox" value="1" /><span>必填</span></label>
            <label className="checkrow"><input name="isActive" type="checkbox" value="1" defaultChecked /><span>启用</span></label>
            <label style={{ gridColumn: "1 / -1" }}>下拉选项<textarea name="options" placeholder="select 类型使用，一行一个" /></label>
            <div><button type="submit">添加字段</button></div>
          </CustomerFieldConfigForm>
        </section>
        <div className="table-wrap">
          <table>
            <thead><tr><th>字段配置</th></tr></thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id}>
                  <td>
                    <CustomerFieldConfigForm action={updateCustomerFieldConfigAction.bind(null, field.id)} confirmTypeChange={!field.isSystemField}>
                      <input type="hidden" name="initialFieldType" value={field.fieldType} />
                      <label>字段名称<input name="fieldLabel" defaultValue={field.fieldLabel} required /></label>
                      <label>字段 key<div className="readonly">{field.fieldKey}{field.isSystemField ? " / 系统字段" : ""}</div></label>
                      <label>分组<FieldGroupSelect defaultValue={field.fieldGroup} /></label>
                      <label>
                        类型
                        <FieldTypeSelect defaultValue={field.fieldType} disabled={field.isSystemField} />
                        <span className="tiny muted">当前类型：{fieldTypeLabel(field.fieldType)}</span>
                        {field.isSystemField ? <span className="tiny muted">系统字段类型不可修改，避免影响客户档案基础结构。</span> : null}
                      </label>
                      <label>排序<input name="sortOrder" type="number" defaultValue={field.sortOrder} /></label>
                      <label className="checkrow"><input name="required" type="checkbox" value="1" defaultChecked={field.required} /><span>必填</span></label>
                      <label className="checkrow"><input name="isActive" type="checkbox" value="1" defaultChecked={field.isActive} /><span>启用</span></label>
                      <label>下拉选项<textarea name="options" defaultValue={field.options.join("\n")} /></label>
                      <div><button type="submit">保存</button></div>
                    </CustomerFieldConfigForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </KingaShell>
  );
}

function FieldGroupSelect({ defaultValue }: { defaultValue?: CustomerFieldGroup }) {
  return (
    <select name="fieldGroup" defaultValue={defaultValue || CUSTOMER_FIELD_GROUPS[0]}>
      {CUSTOMER_FIELD_GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}
    </select>
  );
}

function FieldTypeSelect({ defaultValue, disabled }: { defaultValue?: CustomerFieldType; disabled?: boolean }) {
  return (
    <>
      {disabled ? <input type="hidden" name="fieldType" value={defaultValue || "text"} /> : null}
      <select name="fieldType" defaultValue={defaultValue || "text"} disabled={disabled}>
        {CUSTOMER_FIELD_TYPES.map((type) => <option key={type} value={type}>{fieldTypeLabel(type)}</option>)}
      </select>
    </>
  );
}
