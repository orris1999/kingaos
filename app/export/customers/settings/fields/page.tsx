import { CustomerFieldConfigForm } from "@/components/customer-field-config-form";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { hasServerPermission, requireCurrentUser } from "@/lib/honoa/server/auth";
import {
  createCustomerFieldConfigAction,
  getCustomerAttachmentTypes,
  listCustomerFieldConfigsForActor,
  updateCustomerAttachmentTypesAction,
  updateCustomerFieldConfigAction
} from "@/lib/honoa/server/field-config";
import { CUSTOMER_FIELD_GROUPS, CUSTOMER_FIELD_TYPES, CUSTOMER_GEO_FIELD_KEYS } from "@/lib/honoa/shared/constants";
import type { CustomerFieldGroup, CustomerFieldType } from "@/lib/honoa/shared/domain-types";
import { FIELD_TYPE_DESCRIPTIONS, fieldTypeLabel } from "@/lib/honoa/shared/field-types";
import { serializeFieldOptions } from "@/lib/honoa/shared/field-options";

export default async function FieldSettingsPage() {
  const user = await requireCurrentUser();
  if (!hasServerPermission(user, "export.customers.fields.manage")) {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能配置出口部客户档案字段。" />
      </KingaShell>
    );
  }
  const fields = (await listCustomerFieldConfigsForActor(user, true))
    .filter((field) => !CUSTOMER_GEO_FIELD_KEYS.has(field.fieldKey))
    .sort((a, b) => Number(a.isSystemField) - Number(b.isSystemField) || a.sortOrder - b.sortOrder);
  const customFields = fields.filter((field) => !field.isSystemField);
  const systemFields = fields.filter((field) => field.isSystemField);
  const attachmentTypes = await getCustomerAttachmentTypes();
  return (
    <KingaShell user={user}>
      <div className="stack">
        <div>
          <div className="breadcrumbs">KingaOS / 出口部 / 客户档案 / 字段配置</div>
          <h1>客户档案字段配置</h1>
          <p className="muted">系统字段不允许删除；新增字段会保存到客户 customFields。客户来源按自定义字段配置管理，但旧数据仍保留兼容。业务员只能填写字段值，不能修改字段结构。</p>
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
            <label style={{ gridColumn: "1 / -1" }}>
              选项配置
              <textarea name="options" placeholder="下拉选择 / 多选使用。格式：选项值 | 显示名称 | 内部说明 | disabled" />
              <span className="tiny muted">内部说明只在新建 / 编辑客户页面显示，详情页不显示。</span>
            </label>
            <div><button type="submit">添加字段</button></div>
          </CustomerFieldConfigForm>
        </section>
        <section className="panel stack">
          <h2>附件类型配置</h2>
          <p className="muted">这里维护客户附件上传框里的“附件类型”下拉选项。每行一个类型；系统会自动保留“其他”。</p>
          <form className="form-grid" action={updateCustomerAttachmentTypesAction}>
            <label style={{ gridColumn: "1 / -1" }}>
              附件类型
              <textarea name="attachmentTypes" defaultValue={attachmentTypes.join("\n")} rows={7} />
            </label>
            <div><button type="submit">保存附件类型</button></div>
          </form>
        </section>
        <section className="panel stack">
          <h2>自定义字段</h2>
          <p className="muted">自定义字段可以修改字段类型。客户来源也在这里配置。修改类型前系统会提示确认，不会清空历史客户数据。</p>
          <FieldConfigTable fields={customFields} />
        </section>
        <section className="panel stack">
          <h2>系统字段</h2>
          <p className="muted">系统字段类型不可修改，避免影响客户档案基础结构。地址字段已由国家 / 州 / 城市联动控件维护，不在这里单独配置。</p>
          <FieldConfigTable fields={systemFields} />
        </section>
      </div>
    </KingaShell>
  );
}

function FieldConfigTable({ fields }: { fields: Awaited<ReturnType<typeof listCustomerFieldConfigsForActor>> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>字段配置</th></tr></thead>
        <tbody>
          {fields.length === 0 ? <tr><td>暂无字段</td></tr> : fields.map((field) => (
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
                      <label>
                        选项配置
                        <textarea name="options" defaultValue={serializeFieldOptions(field.options)} />
                        <span className="tiny muted">仅下拉选择 / 多选使用。格式：选项值 | 显示名称 | 内部说明 | disabled。</span>
                      </label>
                      <div><button type="submit">保存</button></div>
                    </CustomerFieldConfigForm>
                  </td>
                </tr>
          ))}
        </tbody>
      </table>
    </div>
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
        {CUSTOMER_FIELD_TYPES.map((type) => <option key={type} value={type}>{fieldTypeLabel(type)} - {FIELD_TYPE_DESCRIPTIONS[type]}</option>)}
      </select>
    </>
  );
}
