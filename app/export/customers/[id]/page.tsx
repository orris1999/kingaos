import Link from "next/link";
import { CustomerAttachmentsPanel } from "@/components/customer-attachments-panel";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { requireCurrentUser } from "@/lib/honoa/server/auth";
import { canEditCustomerServer, contactsForDisplay, getExportCustomerForActor } from "@/lib/honoa/server/customers";
import { listCustomerFieldConfigsForActor } from "@/lib/honoa/server/field-config";
import { CUSTOMER_FIELD_GROUPS, CUSTOMER_LEGACY_CONTACT_FIELD_KEYS, CUSTOMER_SYSTEM_FIELD_KEYS } from "@/lib/honoa/shared/constants";
import type { CustomerFieldConfig } from "@/lib/honoa/shared/domain-types";
import { displayFieldValue } from "@/lib/honoa/shared/field-values";
import type { Customer, CustomerAttachment } from "@prisma/client";

function formatDate(value: Date) {
  return value.toLocaleString("zh-CN", { hour12: false });
}

function fieldValue(customer: Customer, field: CustomerFieldConfig) {
  if (field.fieldKey === "createdAt") return formatDate(customer.createdAt);
  if (field.fieldKey === "updatedAt") return formatDate(customer.updatedAt);
  if (field.fieldKey === "ownerUserId") return customer.ownerName;
  if (CUSTOMER_SYSTEM_FIELD_KEYS.has(field.fieldKey)) {
    return displayFieldValue((customer as unknown as Record<string, unknown>)[field.fieldKey], field.fieldType);
  }
  const customFields = customer.customFields as Record<string, string | number | boolean>;
  const value = customFields[field.fieldKey];
  return displayFieldValue(value, field.fieldType);
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  try {
    const customer = await getExportCustomerForActor(user, id);
    const fields = await listCustomerFieldConfigsForActor(undefined, false);
    const contacts = contactsForDisplay(customer);
    const canEdit = canEditCustomerServer(user, customer);
    return (
      <KingaShell user={user}>
        <div className="stack">
          <div className="split">
            <div>
              <div className="breadcrumbs">KingaOS / 出口部 / 客户档案 / 客户详情</div>
              <h1>{customer.name}</h1>
              <p><span className="tag">客户编号：{customer.customerCode}</span></p>
            </div>
            <div className="actions">
              {canEdit ? <Link className="button" href={`/export/customers/${customer.id}/edit`}>编辑客户</Link> : null}
              <Link className="button ghost" href="/export/customers">返回列表</Link>
            </div>
          </div>
          <section className="panel detail-grid">
            <div className="kv"><b>负责人</b><span>{customer.ownerName}</span></div>
            <div className="kv"><b>创建时间</b><span>{formatDate(customer.createdAt)}</span></div>
            <div className="kv"><b>更新时间</b><span>{formatDate(customer.updatedAt)}</span></div>
          </section>
          {CUSTOMER_FIELD_GROUPS.map((group) => {
            const groupFields = fields.filter((field) => field.fieldGroup === group && !CUSTOMER_LEGACY_CONTACT_FIELD_KEYS.has(field.fieldKey));
            if (groupFields.length === 0) return null;
            return (
              <section className="panel" key={group}>
                <h2>{group}</h2>
                <div className="detail-grid">
                  {groupFields.map((field) => (
                    <div className="kv" key={field.id}>
                      <b>{field.fieldLabel}</b>
                      <span>{fieldValue(customer, field)}</span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          <section className="panel stack">
            <h2>联系人信息</h2>
            {contacts.length === 0 ? <p className="muted">暂无联系人</p> : null}
            {contacts.map((contact) => (
              <div className="subpanel detail-grid" key={contact.id}>
                <div className="kv">
                  <b>联系人姓名</b>
                  <span>{contact.name} {contact.isPrimary ? <span className="tag ok">主要联系人</span> : null}</span>
                </div>
                <div className="kv"><b>职位</b><span>{contact.title || "-"}</span></div>
                <div className="kv"><b>电话</b><span>{contact.phone || "-"}</span></div>
                <div className="kv"><b>邮箱</b><span>{contact.email || "-"}</span></div>
                <div className="kv"><b>WhatsApp / 微信</b><span>{contact.wechatOrWhatsapp || "-"}</span></div>
                <div className="kv"><b>备注</b><span>{contact.notes || "-"}</span></div>
              </div>
            ))}
          </section>
          <CustomerAttachmentsPanel
            customerId={customer.id}
            attachments={(customer.attachments || []) as CustomerAttachment[]}
            editable={canEdit}
          />
        </div>
      </KingaShell>
    );
  } catch (error) {
    return (
      <KingaShell user={user}>
        <Forbidden message={error instanceof Error ? error.message : "当前账号不能查看该客户。"} />
      </KingaShell>
    );
  }
}
