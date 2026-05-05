import Link from "next/link";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { requireCurrentUser } from "@/lib/honoa/server/auth";
import { canEditCustomerServer, getExportCustomerForActor } from "@/lib/honoa/server/customers";
import { listCustomerFieldConfigsForActor } from "@/lib/honoa/server/field-config";
import { CUSTOMER_FIELD_GROUPS, CUSTOMER_SYSTEM_FIELD_KEYS } from "@/lib/honoa/shared/constants";
import type { CustomerFieldConfig } from "@/lib/honoa/shared/domain-types";
import type { Customer } from "@prisma/client";

function formatDate(value: Date) {
  return value.toLocaleString("zh-CN", { hour12: false });
}

function fieldValue(customer: Customer, field: CustomerFieldConfig) {
  if (field.fieldKey === "createdAt") return formatDate(customer.createdAt);
  if (field.fieldKey === "updatedAt") return formatDate(customer.updatedAt);
  if (field.fieldKey === "ownerUserId") return customer.ownerName;
  if (CUSTOMER_SYSTEM_FIELD_KEYS.has(field.fieldKey)) {
    return String((customer as unknown as Record<string, unknown>)[field.fieldKey] || "-");
  }
  const customFields = customer.customFields as Record<string, string | number | boolean>;
  const value = customFields[field.fieldKey];
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value || "-");
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  try {
    const customer = await getExportCustomerForActor(user, id);
    const fields = await listCustomerFieldConfigsForActor(undefined, false);
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
              {canEditCustomerServer(user, customer) ? <Link className="button" href={`/export/customers/${customer.id}/edit`}>编辑客户</Link> : null}
              <Link className="button ghost" href="/export/customers">返回列表</Link>
            </div>
          </div>
          <section className="panel detail-grid">
            <div className="kv"><b>负责人</b><span>{customer.ownerName}</span></div>
            <div className="kv"><b>创建时间</b><span>{formatDate(customer.createdAt)}</span></div>
            <div className="kv"><b>更新时间</b><span>{formatDate(customer.updatedAt)}</span></div>
          </section>
          {CUSTOMER_FIELD_GROUPS.map((group) => {
            const groupFields = fields.filter((field) => field.fieldGroup === group);
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
